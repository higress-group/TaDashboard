#!/usr/bin/env bash
# Apply the deploy/k3s manifests to the current k3s cluster context.
#
# Usage:
#   scripts/deploy-k3s.sh                   # uses default kubeconfig
#   K3S_KUBECONFIG=/path/k3s.yaml scripts/deploy-k3s.sh
#   NAMESPACE=hiclaw-test scripts/deploy-k3s.sh
#
# Assumes scripts/build-and-load-image.sh has been run first.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f .env.k3s.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.local; set +a
elif [ -f .env.k3s.example ]; then
  echo "info: .env.k3s.local not found; falling back to .env.k3s.example" >&2
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.example; set +a
fi

export KUBECONFIG="${K3S_KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if ! command -v kubectl >/dev/null 2>&1; then
  if [ -x /usr/local/bin/k3s ]; then
    shopt -s expand_aliases
    alias kubectl='k3s kubectl'
  else
    echo "kubectl (or k3s) not found on PATH" >&2
    exit 1
  fi
fi

echo "==> Verifying IngressClass 'higress' is installed"
if ! kubectl get ingressclass higress >/dev/null 2>&1; then
  echo "Higress IngressClass not found." >&2
  echo "Run scripts/install-higress.sh first (and disable Traefik in k3s)." >&2
  exit 1
fi

if kubectl -n kube-system get deploy traefik >/dev/null 2>&1; then
  replicas=$(kubectl -n kube-system get deploy traefik -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "?")
  echo "warning: Traefik is still installed in kube-system (replicas=${replicas})." >&2
  echo "         Port 80/443 conflicts with Higress. Scale it down before continuing:" >&2
  echo "           kubectl -n kube-system scale deploy traefik --replicas=0" >&2
  read -r -p "Continue anyway? [y/N] " ans
  case "$ans" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "aborted" >&2; exit 1 ;;
  esac
fi

echo "==> Applying manifests under deploy/k3s/"
kubectl apply -k "${ROOT}/deploy/k3s"

echo "==> Waiting for controller rollout"
kubectl -n "${NAMESPACE:-hiclaw-system}" rollout status deploy/hiclaw-controller --timeout=180s
echo "==> Waiting for dashboard rollout"
kubectl -n "${NAMESPACE:-hiclaw-system}" rollout status deploy/hiclaw-dashboard --timeout=180s

echo
echo "Cluster state:"
kubectl -n "${NAMESPACE:-hiclaw-system}" get pods,svc,ingress,pvc

HOST="${INGRESS_HOST:-hiclaw.localhost}"
echo
echo "Open https://${HOST} once Higress has picked up the Ingress."
echo "Add '${HOST}' to /etc/hosts pointing at the k3s node IP if needed."