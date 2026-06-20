#!/usr/bin/env bash
# Uninstall Higress. Does NOT touch k3s or the HICLAW_NAMESPACE resources.

set -euo pipefail

if [ -f .env.k3s.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.local; set +a
elif [ -f .env.k3s.example ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.example; set +a
fi

export KUBECONFIG="${K3S_KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
HIGRESS_NAMESPACE="${HIGRESS_NAMESPACE:-higress-system}"
HIGRESS_RELEASE="${HIGRESS_RELEASE:-higress}"

if ! command -v helm >/dev/null 2>&1; then
  echo "helm not found on PATH" >&2
  exit 1
fi

echo "==> Removing Helm release ${HIGRESS_RELEASE}"
helm uninstall "${HIGRESS_RELEASE}" --namespace "${HIGRESS_NAMESPACE}" --ignore-not-found

echo "==> Deleting namespace ${HIGRESS_NAMESPACE}"
if ! command -v kubectl >/dev/null 2>&1 && [ -x /usr/local/bin/k3s ]; then
  alias kubectl='k3s kubectl'
  shopt -s expand_aliases
fi
kubectl delete namespace "${HIGRESS_NAMESPACE}" --ignore-not-found

echo "Done."