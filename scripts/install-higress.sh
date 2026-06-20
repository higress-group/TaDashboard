#!/usr/bin/env bash
# Install Higress as the cluster's ingress controller.
#
# HiClaw routes external traffic through Higress (Consumer credential
# injection, TLS, rate limiting). k3s installs Traefik by default, which
# binds the same ports and CRDs; disable Traefik at k3s install time
# (`curl ... | sh -s - --disable=traefik`) before running this script.
#
# Usage:
#   scripts/install-higress.sh                      # latest chart, global registry
#   HIGRESS_CHART_VERSION=1.0.0 scripts/install-higress.sh
#   HIGRESS_HUB=... scripts/install-higress.sh      # mirror registry
#
# Requires: helm 3+, kubectl (or k3s) on PATH, cluster reachable.

set -euo pipefail

if [ -f .env.k3s.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.local; set +a
elif [ -f .env.k3s.example ]; then
  echo "info: .env.k3s.local not found; falling back to .env.k3s.example" >&2
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.example; set +a
fi

export KUBECONFIG="${K3S_KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
HIGRESS_NAMESPACE="${HIGRESS_NAMESPACE:-higress-system}"
HIGRESS_RELEASE="${HIGRESS_RELEASE:-higress}"
HIGRESS_HUB="${HIGRESS_HUB:-higress.io}"
HIGRESS_CHART_REPO="${HIGRESS_CHART_REPO:-https://${HIGRESS_HUB}/helm-charts}"
HIGRESS_CHART_VERSION="${HIGRESS_CHART_VERSION:-}"

if ! command -v helm >/dev/null 2>&1; then
  echo "helm not found on PATH; install helm 3+ first: https://helm.sh/docs/intro/install/" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1 && [ -x /usr/local/bin/k3s ]; then
  alias kubectl='k3s kubectl'
  shopt -s expand_aliases
fi

# Pre-flight: warn if Traefik is still running. Traefik binds ports 80/443
# by default in k3s, which collides with Higress.
if kubectl -n kube-system get deploy traefik >/dev/null 2>&1; then
  echo "warning: Traefik is still installed in kube-system." >&2
  echo "         Higress will fail to bind 80/443 until Traefik is removed." >&2
  echo "         To remove Traefik from k3s:" >&2
  echo "           kubectl -n kube-system scale deploy traefik --replicas=0" >&2
  echo "           # or, permanently: edit /etc/rancher/k3s/config.yaml to add" >&2
  echo "           #   disable: [traefik]" >&2
  echo "           # then 'sudo systemctl restart k3s'" >&2
  read -r -p "Continue anyway? [y/N] " ans
  case "$ans" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "aborted" >&2; exit 1 ;;
  esac
fi

echo "==> Adding Helm repo ${HIGRESS_CHART_REPO}"
helm repo add higress.io "${HIGRESS_CHART_REPO}" 2>/dev/null || true
helm repo update

CHART="higress.io/higress"
VERSION_FLAG=""
if [ -n "${HIGRESS_CHART_VERSION}" ]; then
  VERSION_FLAG="--version ${HIGRESS_CHART_VERSION}"
fi

echo "==> Installing ${CHART} into ${HIGRESS_NAMESPACE}"
helm upgrade --install "${HIGRESS_RELEASE}" "${CHART}" \
  --namespace "${HIGRESS_NAMESPACE}" --create-namespace \
  ${VERSION_FLAG}

echo "==> Waiting for Higress controller to be Ready"
kubectl -n "${HIGRESS_NAMESPACE}" rollout status deploy/higress-controller --timeout=180s

echo "==> Verifying IngressClass 'higress' is registered"
kubectl get ingressclass higress

echo "Higress is up. The dashboard Ingress in deploy/k3s/41-hiclaw-ingress.yaml can now be applied."