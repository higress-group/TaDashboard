#!/usr/bin/env bash
# Remove everything the deploy/k3s manifests created.
#
# Usage:
#   scripts/teardown-k3s.sh                 # removes kustomize-managed resources
#   scripts/teardown-k3s.sh --purge-pvc     # also delete PVCs (DB + controller data)
#   scripts/teardown-k3s.sh --purge-all     # also delete the namespace

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f .env.k3s.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.local; set +a
elif [ -f .env.k3s.example ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.example; set +a
fi

export KUBECONFIG="${K3S_KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
NAMESPACE="${NAMESPACE:-hiclaw-system}"

PURGE_PVC=0
PURGE_NS=0
for arg in "$@"; do
  case "$arg" in
    --purge-pvc) PURGE_PVC=1 ;;
    --purge-all) PURGE_PVC=1; PURGE_NS=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1 && [ -x /usr/local/bin/k3s ]; then
  alias kubectl='k3s kubectl'
  shopt -s expand_aliases
fi

echo "==> Deleting kustomize-managed resources"
kubectl delete -k "${ROOT}/deploy/k3s" --ignore-not-found

if [ "$PURGE_PVC" = "1" ]; then
  echo "==> Deleting PVCs"
  kubectl -n "$NAMESPACE" delete pvc --all --ignore-not-found
fi

if [ "$PURGE_NS" = "1" ]; then
  echo "==> Deleting namespace ${NAMESPACE}"
  kubectl delete namespace "$NAMESPACE" --ignore-not-found
fi

echo "Done."