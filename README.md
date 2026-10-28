# hello-holo

Un bac à sable **Holochain** entièrement conteneurisé (**Docker**) : un seul
*conducteur* Holochain qui héberge **plusieurs hApps**, chacune accessible depuis
le navigateur via un **portail** unique.

> Projet d'apprentissage/démonstration autour de Holochain `0.6`, de **hREA**
> (ValueFlows) et de quelques hApps de l'écosystème (KanDo, TalkingStickies,
> Emergence…), le tout orchestré par `docker compose`.

---

## Aperçu

| Élément | Détail |
|---|---|
| Conducteur | **Holochain `0.6.3`** (via holonix `main-0.6`, keystore **lair**) |
| hApp socle | **hREA** `happ-0.4.0-beta` (ValueFlows 1.0 ; hdk 0.6.1 / hdi 0.7.1) |
| Orchestration | `docker compose` (conducteur + sidecars UI) |
| Plateforme | testé sur macOS Apple Silicon (images en `linux/amd64`, émulation Rosetta) |

Le conducteur héberge **5 hApps** (dont **4 avec interface graphique**), plus un
**viewer réseau** et un **portail**.

## Prérequis

- **Docker** + **Docker Compose** (testé avec Docker `29.7.2`).
- Connexion internet (téléchargement de Holochain depuis le cache binaire
  **cachix** `holochain-ci`, et des hApps depuis leurs releases GitHub).

## Démarrage rapide

```bash
docker compose build          # long la 1re fois (plusieurs Go téléchargés)
docker compose up -d
bash apps/provision.sh        # installe les hApps + (re)génère les IHM patchées
```

Puis ouvre le **portail** :

**<http://localhost:4000>**

> Le cœur (conducteur + **hREA** + viewer + portail) est reconstitué par
> `docker compose up -d`. Les **hApps supplémentaires** (`kando`,
> `talking-stickies`, `emergence`, `gamez`) et leurs **IHM patchées** sont des
> artefacts dérivés (`.gitignore`) ; **`apps/provision.sh`** les re-télécharge
> (versions épinglées), les installe et patche leurs interfaces. Le script est
> **idempotent** : on peut le relancer sans risque.

Pour tout arrêter (les données persistent dans le volume `hrea-data`) :

```bash
docker compose down
```

Repartir de zéro (efface les données du conducteur) :

```bash
docker compose down -v
```

## Ports

Tous les points d'accès sont dans la plage **4000‑4999**.

| Port | Accès | IHM |
|---|---|---|
| `4000` | 🏠 **Portail** (liste dynamique des hApps) | ✅ |
| `4001` | **Réseau / Pairs** — vue lecture-seule du réseau | ✅ |
| `4002` | **KanDo** — tableaux Kanban temps réel | ✅ |
| `4003` | **hREA** — console + API GraphQL + GraphiQL | ✅ |
| `4004` | **TalkingStickies** — notes/post-its collaboratifs | ✅ |
| `4005` | **Emergence** — sessions, personnes, notes | ✅ |
| `4444` | Conducteur — **admin** WebSocket | — |
| `4445` | Conducteur — **app** WebSocket (écoute locale) | — |
| `4455` | Conducteur — **app** WebSocket ré-exposé `0.0.0.0` (relais socat) | — |

## hApps installées dans le conducteur

Les **5 hApps** hébergées par le même conducteur (versions épinglées, cf. le
catalogue en tête de `apps/provision.sh`) :

| `installed_app_id` | Version | IHM | Description |
|---|---|---|---|
| `hrea` | `happ-0.4.0-beta` | `:4003` | ValueFlows : agents, spécifications de ressource, unités… |
| `kando` | `v0.17.5` | `:4002` | Kanban temps réel (basé sur `syn`) |
| `talking-stickies` | `v0.15.2` | `:4004` | Post-its/notes collaboratifs |
| `emergence` | `v0.5.1` | `:4005` | Sessions / unconférences |
| `gamez` | `v0.9.3` | — | Installée et active, mais **sans IHM web** ici (voir *Limites*) |

> `hrea` est intégrée à l'image du conducteur ; les 4 autres sont provisionnées
> par **`apps/provision.sh`** (voir *Provisioning turnkey*).

## Composants (arborescence)

| Dossier / fichier | Rôle |
|---|---|
| `Dockerfile`, `entrypoint.sh` | Image Nix/holonix du **conducteur** + hREA, génération de la sandbox |
| `docker-compose.yml` | Conducteur + sidecars (UI, relais réseau, viewer, portail) |
| `server/` | Sidecar **hREA** : serveur HTTP GraphQL + GraphiQL + IHM (`:4003`) |
| `network-viewer/` | Sidecar **viewer réseau** : API admin en lecture seule + dashboard (`:4001`) |
| `portal/` | **Portail** statique (`:4000`), liste dynamiquement les hApps installées |
| `apps/` | hApps ajoutées, outils d'installation (`add-happ.sh`), UIs patchées |
| `client/` | Scripts Node : client GraphQL, installeurs, extracteurs, **`patch-ui.py`** |

Voir **[docs/architecture.md](docs/architecture.md)** pour le détail technique
(conducteur, sidecars, réseau, patch des UIs, signature des zome calls).

## hREA — explorer en GraphQL

Après démarrage, ouvre l'explorateur **GraphiQL** : <http://localhost:4003/graphql>

```graphql
mutation { createResourceSpecification(resourceSpecification: { name: "Vélo" }) {
  resourceSpecification { id name } } }
```

En `curl` :

```bash
curl -s -X POST http://localhost:4003/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ resourceSpecifications(last:10){ edges{ node{ id name } } } }"}'
```

## Provisioning turnkey (reconstituer l'état complet)

Après un `git clone`, une fois la stack démarrée (`docker compose up -d`) :

```bash
bash apps/provision.sh
```

Le script **`apps/provision.sh`** reconstitue l'état complet de façon
**idempotente** : il télécharge les `.webhapp` (versions épinglées), extrait et
installe chaque backend dans le conducteur, puis extrait/patche les IHM et
démarre leurs sidecars. Le catalogue des hApps (URLs, `installed_app_id`, seed,
port d'IHM) est défini en tête du script.

## Ajouter une hApp (ponctuel)

Un conducteur Holochain est **multi-hApps**. Pour en installer une nouvelle
(backend) en une commande — la stack doit tourner :

```bash
bash apps/add-happ.sh <nom> <url-ou-fichier .webhapp|.happ> [app-id] [network-seed]
```

Le script extrait le `.happ` d'un `.webhapp` si besoin, le copie dans le
conducteur, puis l'installe et l'active via l'API admin. Pour une hApp que tu
veux rendre **permanente/reproductible**, ajoute plutôt son entrée au catalogue
de `apps/provision.sh`.

Pour faire tourner **l'interface graphique** d'une hApp conçue pour le Holochain
Launcher, voir `apps/README.md` et `client/patch-ui.py` (méthode de patch du
bundle pour un navigateur nu).

## Contrainte de compatibilité

Une hApp ne s'installe que si elle est compilée pour **Holochain 0.6.x**. Beaucoup
d'apps de l'écosystème ciblent encore 0.3/0.4 et **ne s'installeront pas** ici.

## Limites connues

- **gamez** : installée et active, mais son UI de production (applet **Weave/Moss**)
  a été élaguée de tout code admin/signature → non jouable en navigateur nu sans
  un *shim* de signature dédié. Reste en « backend ».
- Les IHM de KanDo/TalkingStickies/Emergence sont des **builds patchés** d'apps
  prévues pour le **Launcher/Moss** ; c'est une démonstration, pas un usage de
  production. La voie « officielle » pour ces apps reste le **Holochain Launcher**.
- **Réseau** : node unique par défaut → les données vivent en local (volume
  `hrea-data`). La décentralisation s'active quand d'autres agents rejoignent le
  même réseau (même DNA + network seed).

## Références

- Holochain — <https://www.holochain.org>
- hREA / ValueFlows — <https://docs.hrea.io>
- KanDo / TalkingStickies / Emergence — <https://github.com/holochain-apps>
