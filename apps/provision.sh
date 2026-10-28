#!/usr/bin/env bash
# =============================================================================
# provision.sh — Reconstitue l'état complet de hello-holo après un `git clone`.
#
#   docker compose up -d        # démarre le conducteur + sidecars
#   bash apps/provision.sh      # installe les hApps + (re)génère les IHM patchées
#
# Les hApps supplémentaires et leurs UIs patchées sont `.gitignore` (lourdes /
# dérivées) ; ce script les re-télécharge (versions épinglées), les installe dans
# le conducteur en marche, puis extrait et patche leurs interfaces.
#
# IDEMPOTENT : ré-exécutable sans effet de bord (saute ce qui existe déjà).
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONDUCTOR="holochain-hrea"          # nom du container conducteur (docker-compose.yml)
ADMIN_URL="ws://127.0.0.1:4444"     # admin ws, joint via la pile réseau partagée
NODE_IMG="node:20-slim"
PY_IMG="python:3.12-slim"

# -----------------------------------------------------------------------------
# Catalogue des hApps à provisionner (hREA est déjà intégrée à l'image).
#   nom | url-release (.webhapp) | installed_app_id | network_seed | port_ui
# port_ui = "-"  => backend uniquement (pas d'IHM servie).
# -----------------------------------------------------------------------------
HAPPS=(
  "kando|https://github.com/holochain-apps/kando/releases/download/v0.17.5/kando.webhapp|kando|hello-holo-demo|4002"
  "talking-stickies|https://github.com/holochain-apps/talking-stickies/releases/download/v0.15.2/talking-stickies.webhapp|talking-stickies||4004"
  "emergence|https://github.com/holochain-apps/emergence/releases/download/v0.5.1/emergence.webhapp|emergence||4005"
  "gamez|https://github.com/holochain-apps/gamez/releases/download/v0.9.3/gamez.webhapp|gamez||-"
)

log()  { printf '\n\033[1;36m[provision]\033[0m %s\n' "$*"; }
step() { printf '\033[0;36m  ·\033[0m %s\n' "$*"; }

# -----------------------------------------------------------------------------
# 0. Pré-requis : docker dispo + conducteur en marche.
# -----------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || { echo "ERREUR : 'docker' est requis." >&2; exit 1; }

if [[ "$(docker inspect -f '{{.State.Running}}' "$CONDUCTOR" 2>/dev/null)" != "true" ]]; then
  echo "ERREUR : le conducteur '$CONDUCTOR' ne tourne pas." >&2
  echo "         Lance d'abord :  docker compose up -d" >&2
  exit 1
fi
log "Conducteur '$CONDUCTOR' en marche."

# -----------------------------------------------------------------------------
# 1. Bootstrap des dépendances Node du dossier client/ (extracteurs + installeur).
#    node_modules est .gitignore ; on l'installe une fois via npm ci (lock figé).
# -----------------------------------------------------------------------------
if [[ ! -d client/node_modules ]]; then
  log "Installation des dépendances client/ (npm ci)…"
  docker run --rm -v "$ROOT/client":/app -w /app "$NODE_IMG" npm ci
else
  log "Dépendances client/ déjà présentes."
fi

UI_SERVICES=()   # sidecars nginx à (re)démarrer en fin de script

# -----------------------------------------------------------------------------
# 2. Boucle principale sur le catalogue.
# -----------------------------------------------------------------------------
for entry in "${HAPPS[@]}"; do
  IFS='|' read -r NAME URL APPID SEED UIPORT <<<"$entry"
  log "hApp : $NAME  (app-id: $APPID)"

  WEBHAPP="apps/${NAME}.webhapp"
  HAPP="apps/${NAME}.happ"

  # 2a. Télécharger le .webhapp (idempotent : saute si déjà présent et non vide).
  if [[ -s "$WEBHAPP" ]]; then
    step "$WEBHAPP déjà présent."
  else
    step "Téléchargement $URL"
    curl -L -sS --fail -o "$WEBHAPP" "$URL"
  fi

  # 2b. Extraire le backend .happ du bundle (idempotent).
  if [[ -s "$HAPP" ]]; then
    step "$HAPP déjà extrait."
  else
    step "Extraction du .happ…"
    docker run --rm -v "$ROOT":/work -w /work "$NODE_IMG" \
      node client/extract-happ.mjs "$WEBHAPP" "$HAPP"
  fi

  # 2c. Installer + activer le backend (install-one.mjs saute si déjà installé).
  step "Installation/activation dans le conducteur…"
  docker cp "$HAPP" "$CONDUCTOR":/data/"${NAME}.happ"
  docker run --rm --network "container:$CONDUCTOR" \
    -e HREA_ADMIN_URL="$ADMIN_URL" \
    -e APP_ID="$APPID" -e HAPP_PATH="/data/${NAME}.happ" -e SEED="$SEED" \
    -v "$ROOT/client":/app -w /app "$NODE_IMG" node install-one.mjs

  # 2d. IHM (si port défini) : extraire dist.zip, dézipper, patcher UNE fois.
  if [[ "$UIPORT" != "-" ]]; then
    UIDIR="apps/${NAME}-ui"
    if [[ -f "$UIDIR/.patched" ]]; then
      step "IHM déjà extraite et patchée ($UIDIR)."
    else
      step "Extraction + patch de l'IHM…"
      rm -rf "$UIDIR"
      docker run --rm -v "$ROOT":/work -w /work "$NODE_IMG" \
        node client/extract-ui.mjs "$WEBHAPP" "apps/${NAME}-ui.zip"
      # Dézip + patch dans un conteneur python (zipfile + patch-ui.py), sans
      # dépendre d'outils de l'hôte (unzip/python).
      docker run --rm -v "$ROOT":/work -w /work "$PY_IMG" bash -c "
        set -e
        python -m zipfile -e 'apps/${NAME}-ui.zip' '$UIDIR'
        js=\$(ls $UIDIR/assets/index-*.js | head -n1)
        python client/patch-ui.py \"\$js\"
      "
      touch "$UIDIR/.patched"
    fi
    UI_SERVICES+=("${NAME}-ui")
  fi
done

# -----------------------------------------------------------------------------
# 3. (Re)démarrer les sidecars nginx des IHM (bind-mount des dossiers patchés).
# -----------------------------------------------------------------------------
if [[ ${#UI_SERVICES[@]} -gt 0 ]]; then
  log "Démarrage des sidecars IHM : ${UI_SERVICES[*]}"
  docker compose up -d "${UI_SERVICES[@]}"
fi

log "Provisioning terminé. Portail : http://localhost:4000"
