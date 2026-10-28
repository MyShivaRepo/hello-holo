#!/usr/bin/env bash
# Ajoute une hApp (backend) dans le conducteur en cours.
#   add-happ.sh <nom> <url-ou-fichier .webhapp|.happ> [app-id] [network-seed]
# Extrait le .happ si besoin, le copie dans le conducteur, puis installe+active.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NAME="$1"; SRC="$2"; APPID="${3:-$1}"; SEED="${4:-}"
mkdir -p apps
HAPP="apps/${NAME}.happ"

if [[ "$SRC" == *.happ ]]; then
  if [[ "$SRC" =~ ^https?:// ]]; then curl -L -sS -o "$HAPP" "$SRC"; else cp "$SRC" "$HAPP"; fi
else
  WEBHAPP="apps/${NAME}.webhapp"
  if [[ "$SRC" =~ ^https?:// ]]; then curl -L -sS -o "$WEBHAPP" "$SRC"; else cp "$SRC" "$WEBHAPP"; fi
  docker run --rm -v "$ROOT":/work -w /work node:20-slim \
    node client/extract-happ.mjs "$WEBHAPP" "$HAPP"
fi

docker cp "$HAPP" holochain-hrea:/data/"${NAME}.happ"

docker run --rm --network container:holochain-hrea \
  -e HREA_ADMIN_URL=ws://127.0.0.1:4444 \
  -e APP_ID="$APPID" -e HAPP_PATH="/data/${NAME}.happ" -e SEED="$SEED" \
  -v "$ROOT/client":/app -w /app node:20-slim node install-one.mjs
