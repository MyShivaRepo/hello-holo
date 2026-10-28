#!/usr/bin/env bash
# Lance le client CLI hREA dans un container Node ephemere qui PARTAGE la stack
# reseau du container holochain-hrea (donc 127.0.0.1:4444/4445 = celui du node,
# quel que soit le bind des interfaces).
set -euo pipefail
cd "$(dirname "$0")"

CONTAINER="${HOLOCHAIN_CONTAINER:-holochain-hrea}"

docker run --rm --network "container:${CONTAINER}" \
  -e HREA_ADMIN_URL=ws://127.0.0.1:4444 \
  -e HREA_APP_URL=ws://127.0.0.1:4445 \
  -e HREA_APP_ID=hrea -e HREA_ROLE=hrea \
  -v "$PWD":/app -w /app node:20-slim \
  sh -c "npm install --silent --no-audit --no-fund && node query.mjs"
