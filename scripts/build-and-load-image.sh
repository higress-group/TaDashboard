#!/usr/bin/env bash
# Load a TaDashboard image into the local k3s containerd and (optionally)
# tag/push it to a registry for cluster nodes to pull from.
#
# Usage:
#   scripts/build-and-load-image.sh                       # build dev image, import to k3s
#   IMAGE_TAG=v0.1.0 scripts/build-and-load-image.sh     # override tag
#   PUSH_REGISTRY=ghcr.io/you scripts/build-and-load-image.sh
#
# Requires: docker (or nerdctl) on the build host, k3s on the same host.
# On multi-node clusters, push to a registry instead of importing into the
# server node's containerd.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f .env.k3s.local ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.local; set +a
elif [ -f .env.k3s.example ]; then
  echo "info: .env.k3s.local not found; falling back to .env.k3s.example" >&2
  # shellcheck disable=SC1091
  set -a; . ./.env.k3s.example; set +a
fi

IMAGE="${DASHBOARD_IMAGE:-hiclaw-dashboard}"
TAG="${DASHBOARD_TAG:-dev}"
FULL="${IMAGE}:${TAG}"
REGISTRY="${DASHBOARD_REGISTRY:-}"
PUSH_REGISTRY="${PUSH_REGISTRY:-}"

echo "==> Building ${FULL}"
docker build -t "${FULL}" -f Dockerfile .

if [ -n "${REGISTRY}" ]; then
  TAGGED="${REGISTRY}/${FULL}"
  docker tag "${FULL}" "${TAGGED}"
  echo "==> Pushing ${TAGGED}"
  docker push "${TAGGED}"
  echo "Update deploy/k3s manifests to use ${TAGGED} or set DASHBOARD_IMAGE accordingly."
  exit 0
fi

if [ -n "${PUSH_REGISTRY}" ]; then
  TAGGED="${PUSH_REGISTRY}/${FULL}"
  docker tag "${FULL}" "${TAGGED}"
  echo "==> Pushing ${TAGGED}"
  docker push "${TAGGED}"
  exit 0
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "k3s not found on PATH; skipping containerd import." >&2
  echo "Build artifact: ${FULL}" >&2
  exit 0
fi

echo "==> Importing ${FULL} into k3s containerd"
TMP_TAR="$(mktemp -t dashboard-image-XXXXXX.tar)"
trap 'rm -f "${TMP_TAR}"' EXIT
docker save "${FULL}" -o "${TMP_TAR}"
k3s ctr images import "${TMP_TAR}"
echo "Imported. Cluster can now run ${FULL}."