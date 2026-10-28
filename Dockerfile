# syntax=docker/dockerfile:1

# ============================================================================
#  Node Holochain faisant tourner le hApp hREA (release happ-0.4.0-beta)
#  Cible : Holochain 0.6.1 / hdk 0.6.1 / hdi 0.7.1 (via holonix main-0.6)
#
#  On force linux/amd64 (x86_64-linux) : le cache binaire cachix holochain-ci
#  fournit ces builds, ce qui evite de recompiler Holochain depuis les sources
#  (plusieurs heures). Sur Apple Silicon, Docker emule via Rosetta.
# ============================================================================
FROM --platform=linux/amd64 nixos/nix:2.24.9

# --- Configuration Nix : flakes + cache binaire Holochain -------------------
RUN mkdir -p /etc/nix && \
    printf '%s\n' \
      'experimental-features = nix-command flakes' \
      'accept-flake-config = true' \
      'substituters = https://cache.nixos.org https://holochain-ci.cachix.org' \
      'trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY= holochain-ci.cachix.org-1:5IUSkZc0aoRS53rfkvH9Kid40NpyjwCMCzwRTXy+QN8=' \
      >> /etc/nix/nix.conf

# --- Environnement holonix 0.6 (holochain + hc + lair-keystore) -------------
# Cette etape telecharge les binaires depuis le cache et les fige dans le store
# Nix, de sorte que le runtime fonctionne ensuite sans reconstruction.
ENV HOLONIX_REF="github:holochain/holonix?ref=main-0.6"
RUN nix develop "$HOLONIX_REF" --command sh -c \
      'holochain --version && hc --version && lair-keystore --version'

# --- hApp hREA preconstruit (copie depuis le contexte de build) -------------
RUN mkdir -p /happ
COPY hrea.happ /happ/hrea.happ

# --- Point d'entree ---------------------------------------------------------
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Admin websocket / App websocket
EXPOSE 4444 4445

# Les binaires holochain/hc/lair sont fournis par le devShell holonix ; on
# lance donc l'entrypoint a l'interieur de ce shell.
ENTRYPOINT ["sh", "-c", "exec nix develop \"$HOLONIX_REF\" --command bash /usr/local/bin/entrypoint.sh"]
