#!/usr/bin/env bash
# ============================================================================
#  Demarre un conducteur Holochain (0.6.x) et y installe le hApp hREA.
#  Syntaxe validee sur Holochain 0.6.3 / hc sandbox.
#
#  Notes de comportement de `hc sandbox` (verifiees) :
#   - `run` remet le port admin a 0 (aleatoire) : il FAUT passer -f a chaque run.
#   - `run` preserve en revanche `danger_bind_addr` ecrit dans la config.
#   - `danger_bind_addr` attend une IP seule (0.0.0.0), le port etant separe.
# ============================================================================
set -euo pipefail

DATA_DIR="${DATA_DIR:-/data}"
ADMIN_PORT="${ADMIN_PORT:-4444}"
APP_PORT="${APP_PORT:-4445}"
APP_ID="${APP_ID:-hrea}"
LAIR_PASSPHRASE="${LAIR_PASSPHRASE:-hrea}"
HAPP="/happ/hrea.happ"

mkdir -p "$DATA_DIR"
cd "$DATA_DIR"   # hc sandbox ecrit/lit le fichier .hc dans le repertoire courant

echo "[entrypoint] holochain : $(holochain --version)"
echo "[entrypoint] hc        : $(hc --version)"

NEW_SANDBOX=0
if [ ! -e "$DATA_DIR/.hc" ]; then
  NEW_SANDBOX=1
  echo "[entrypoint] Generation de la sandbox + installation de hREA..."
  echo "$LAIR_PASSPHRASE" | hc sandbox --piped -f="$ADMIN_PORT" generate \
      --root "$DATA_DIR" \
      --app-id "$APP_ID" \
      "$HAPP"
fi

# Exposer les interfaces hors du container : bind 0.0.0.0 (idempotent, a chaque
# demarrage) au lieu de 127.0.0.1 (defaut quand danger_bind_addr est null).
echo "[entrypoint] Bind admin -> 0.0.0.0:$ADMIN_PORT"
find "$DATA_DIR" -name conductor-config.yaml -print0 | while IFS= read -r -d '' cfg; do
  sed -i "s#danger_bind_addr:.*#danger_bind_addr: 0.0.0.0#" "$cfg"
done

echo "[entrypoint] Sandboxes connues :"
hc sandbox list || true

# -f a chaque run pour figer le port admin. L'interface app (-p) n'est attachee
# qu'a la premiere execution ; elle est ensuite persistee et rouverte seule.
if [ "$NEW_SANDBOX" = "1" ]; then
  echo "[entrypoint] Demarrage du conducteur (admin=$ADMIN_PORT, +interface app=$APP_PORT)..."
  exec sh -c "echo \"$LAIR_PASSPHRASE\" | hc sandbox --piped -f=$ADMIN_PORT run -p=$APP_PORT 0"
else
  echo "[entrypoint] Demarrage du conducteur (admin=$ADMIN_PORT, interface app deja attachee)..."
  exec sh -c "echo \"$LAIR_PASSPHRASE\" | hc sandbox --piped -f=$ADMIN_PORT run 0"
fi
