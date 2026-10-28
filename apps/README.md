# Deuxième hApp dans le même conducteur : KanDo (avec IHM graphique)

Démonstration qu'un **conducteur Holochain héberge plusieurs hApps**, et qu'on
peut faire tourner une **vraie interface graphique** (KanDo, tableaux Kanban)
dans un navigateur, contre notre conducteur Docker — à côté de hREA.

- hApp : **KanDo** `v0.17.5` — [holochain-apps/kando](https://github.com/holochain-apps/kando) (Holochain 0.6.1, compatible 0.6.3)
- Artefacts : `kando.happ` (backend) + `kando.webhapp` (backend + UI)

## Étapes (déjà réalisées)

1. **Installer le backend** dans le conducteur en marche, avec un `installed_app_id`
   distinct (`kando`), via l'API admin :

   ```bash
   docker cp apps/kando.happ holochain-hrea:/data/kando.happ
   docker run --rm --network container:holochain-hrea \
     -e HREA_ADMIN_URL=ws://127.0.0.1:4444 \
     -v "$PWD/client":/app -w /app node:20-slim node install-kando.mjs
   ```
   → le conducteur héberge alors **`kando` + `hrea`** simultanément.

2. **Extraire et patcher l'UI** du `.webhapp` (déjà fait, dans `apps/kando-ui/`).
   L'UI de production suppose le **Holochain Launcher**. Trois retouches minimales
   du bundle la font marcher en navigateur nu :
   - `appPort` → **4455**, `adminPort` → **4444** (KanDo émet alors lui-même le
     token d'app et autorise la signature) ;
   - autorisation de la signature pour **toutes** les cellules au démarrage ;
   - autorisation de la signature **à la création de chaque clone cell** (KanDo
     crée une cellule clonée par « réseau »).

3. **Exposer l'app websocket au navigateur** : l'interface app écoute sur
   `127.0.0.1` dans le conducteur ; le service **`appws-proxy`** (socat) la
   ré-expose en `0.0.0.0:4455` (port publié par `holochain-hrea`).

4. **Servir l'UI** : c'est le service `kando-ui` du `docker-compose.yml`
   (nginx, bind-mount de `apps/kando-ui`), publié sur **http://localhost:4002**.

## Utilisation

Ouvrir le portail <http://localhost:4009> puis « KanDo », ou directement
<http://localhost:4002> : créer un réseau, un profil, un tableau, des
colonnes/cartes — tout est persisté dans le conducteur (cellules clonées).

## Limite honnête

L'UI est un **build patché** d'une app conçue pour le Launcher. C'est une
démonstration : pour un usage réel d'apps Holochain à interface graphique, le
**Holochain Launcher** reste la voie prévue (il gère nativement token + signature
via lair, et les clone cells).
