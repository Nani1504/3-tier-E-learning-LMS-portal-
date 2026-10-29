#!/usr/bin/env bash
# =============================================================================
# Build the Aviz Academy LMS images and push them to Amazon ECR, then wire the
# pushed image URIs into k8s/full-deploy.yaml so it's ready for `kubectl apply`.
#
# Prereqs: awscli v2 (configured), docker (with buildx), and permissions to
# create/push to ECR repositories.
#
# Usage:
#   ./scripts/push-to-ecr.sh
#   AWS_REGION=ap-south-1 IMAGE_TAG=1.0.0 ./scripts/push-to-ecr.sh
#
# Configurable via environment variables:
#   AWS_REGION        AWS region                      (default: ap-south-1)
#   AWS_ACCOUNT_ID    12-digit account id             (default: auto-detected)
#   IMAGE_TAG         tag to build/push               (default: latest)
#   BACKEND_REPO      ECR repo name for the backend   (default: aviz-backend)
#   FRONTEND_REPO     ECR repo name for the frontend  (default: aviz-frontend)
#   PLATFORM          target platform                 (default: linux/amd64)
#   UPDATE_MANIFEST   rewrite full-deploy.yaml images (default: true)
# =============================================================================
set -euo pipefail

# --- resolve project paths (works regardless of where the script is called) --
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- configuration -----------------------------------------------------------
AWS_REGION="${AWS_REGION:-ap-south-1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BACKEND_REPO="${BACKEND_REPO:-aviz-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-aviz-frontend}"
PLATFORM="${PLATFORM:-linux/amd64}"
UPDATE_MANIFEST="${UPDATE_MANIFEST:-true}"
MANIFEST="$ROOT_DIR/k8s/full-deploy.yaml"

# --- helpers -----------------------------------------------------------------
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

command -v aws    >/dev/null || die "awscli not found on PATH"
command -v docker >/dev/null || die "docker not found on PATH"

# --- resolve account id ------------------------------------------------------
if [[ -z "${AWS_ACCOUNT_ID:-}" ]]; then
  log "Detecting AWS account id via STS..."
  AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)" \
    || die "could not detect account id — set AWS_ACCOUNT_ID or configure the AWS CLI"
fi

REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BACKEND_IMAGE="${REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
FRONTEND_IMAGE="${REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"

log "Account : $AWS_ACCOUNT_ID"
log "Region  : $AWS_REGION"
log "Registry: $REGISTRY"
log "Backend : $BACKEND_IMAGE"
log "Frontend: $FRONTEND_IMAGE"

# --- ensure ECR repositories exist -------------------------------------------
for repo in "$BACKEND_REPO" "$FRONTEND_REPO"; do
  if aws ecr describe-repositories --region "$AWS_REGION" \
        --repository-names "$repo" >/dev/null 2>&1; then
    log "ECR repo '$repo' already exists"
  else
    log "Creating ECR repo '$repo'"
    aws ecr create-repository --region "$AWS_REGION" \
        --repository-name "$repo" \
        --image-scanning-configuration scanOnPush=true >/dev/null
  fi
done

# --- authenticate docker to ECR ----------------------------------------------
log "Logging docker in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"

# --- build & push ------------------------------------------------------------
# `docker buildx build --push` builds for the target platform (EKS nodes are
# typically linux/amd64) and pushes in one step.
log "Building & pushing backend image..."
docker buildx build --platform "$PLATFORM" \
  -t "$BACKEND_IMAGE" "$ROOT_DIR/backend" --push

log "Building & pushing frontend image..."
docker buildx build --platform "$PLATFORM" \
  -t "$FRONTEND_IMAGE" "$ROOT_DIR/frontend" --push

# --- wire image URIs into the combined manifest ------------------------------
if [[ "$UPDATE_MANIFEST" == "true" && -f "$MANIFEST" ]]; then
  log "Updating image references in k8s/full-deploy.yaml"
  # Idempotent: matches any current value ending in the repo name + tag.
  perl -0pi -e "s|image: \\S*${BACKEND_REPO}:\\S+|image: ${BACKEND_IMAGE}|g"  "$MANIFEST"
  perl -0pi -e "s|image: \\S*${FRONTEND_REPO}:\\S+|image: ${FRONTEND_IMAGE}|g" "$MANIFEST"
fi

cat <<EOF

$(log "Done.")
Pushed:
  $BACKEND_IMAGE
  $FRONTEND_IMAGE

Next:
  kubectl apply -f k8s/full-deploy.yaml
  kubectl get pods -n lms -w
EOF
