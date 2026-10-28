# Architecture technique — hello-holo

Ce document explique comment la stack fonctionne, et les points délicats résolus
en chemin.

## Vue d'ensemble

```
Navigateur (hôte)
  :4000 portal ──┐  :4001 viewer ──┐  :4002/4003/4004/4005 UIs ──┐
                 │                 │                              │
                 └──────── HTTP ───┴──────── HTTP ────────────────┘
                                   │ (admin lecture seule)     │ (zome calls signés)
                                   ▼                           ▼
        ┌───────────────────────── conducteur Holochain (container holochain-hrea) ─────────────┐
        │  admin ws 4444 (0.0.0.0)   app ws 4445 (127.0.0.1)   app ws relais 4455 (socat)        │
        │  lair-keystore (clés d'agent)      sandbox + hApps : hrea, kando, talking-stickies, …   │
        │  données persistées dans le volume Docker `hrea-data`                                   │
        └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Le conducteur (`holochain-hrea`)

- Image basée sur **`nixos/nix`** ; l'environnement **holonix `main-0.6`** fournit
  `holochain`, `hc` et `lair-keystore` en version **0.6.x**.
- On force **`linux/amd64`** : le cache binaire **cachix `holochain-ci`** fournit ces
  builds → pas de recompilation de Holochain (sinon plusieurs heures). Sur Apple
  Silicon, Docker émule via Rosetta.
- `entrypoint.sh` génère une **sandbox** `hc sandbox`, installe `hrea.happ`, puis
  lance le conducteur. Détails importants (comportements vérifiés de `hc sandbox`) :
  - `hc sandbox run` **remet le port admin à 0** (aléatoire) → on repasse
    **`-f=<ADMIN_PORT>`** à chaque run pour figer `4444`.
  - L'adresse de bind de l'admin est contrôlée par `danger_bind_addr` dans
    `conductor-config.yaml` : `null` ⇒ `127.0.0.1`. On la force à **`0.0.0.0`**
    (IP seule, le port est séparé) pour que l'admin soit joignable hors du container.
  - `run` **préserve** `danger_bind_addr` (il ne réécrit que le port).

## Keystore & clés d'agent

Chaque hApp reçoit une **paire de clés d'agent** générée automatiquement et
stockée dans **lair** (dans le volume, protégée par la passphrase
`LAIR_PASSPHRASE`). La clé privée ne quitte jamais lair ; on ne la saisit jamais.

## Interfaces WebSocket & accès navigateur

- **Admin (`4444`)** : patché en `0.0.0.0` → joignable depuis l'hôte **et** depuis
  les autres containers (ex. le viewer via `holochain-hrea:4444`).
- **App (`4445`)** : attachée à l'exécution, elle écoute sur **`127.0.0.1`** dans le
  container. Joignable depuis l'hôte via le proxy Docker, mais **pas** depuis un
  autre container. D'où deux contournements selon le besoin :
  - **Relais `socat` (`4455`)** : le sidecar `appws-proxy` (partage la pile réseau
    du conducteur) expose `0.0.0.0:4455 → 127.0.0.1:4445`, publié sur l'hôte. Les
    **UIs navigateur** s'y connectent.
  - **Partage de pile réseau** (`--network container:holochain-hrea` /
    `network_mode: service:holochain-hrea`) : un sidecar voit `127.0.0.1:4445`
    directement (utilisé par le sidecar hREA et les scripts `client/`).

### Piège : le header `Origin`

Holochain 0.6 **exige la présence** d'un header `Origin` à l'upgrade WebSocket,
même avec `allowed_origins: "*"`. Les navigateurs l'envoient automatiquement ; le
client Node `ws`, non → les scripts `client/` forcent `Origin: http://localhost`.

## Sidecars

| Service | Réseau | Port publié | Rôle |
|---|---|---|---|
| `hrea-graphql` | `service:holochain-hrea` | `4003` (via le conducteur) | GraphQL + GraphiQL + IHM hREA |
| `appws-proxy` | `service:holochain-hrea` | `4455` (via le conducteur) | relais socat app ws |
| `network-viewer` | réseau interne | `4001` | API admin lecture seule + dashboard |
| `kando-ui` / `talking-stickies-ui` / `emergence-ui` | réseau interne | `4002`/`4004`/`4005` | UIs patchées servies par nginx (bind-mount) |
| `portal` | réseau interne | `4000` | portail statique (bind-mount) |

Le `network-viewer` renvoie un en-tête **CORS** `*` afin que le **portail** puisse
lire `/api/network` et lister dynamiquement les hApps installées.

## Faire tourner l'IHM d'une hApp « Launcher » en navigateur nu

Les UIs (`.webhapp`) sont prévues pour le **Holochain Launcher/Moss**, qui injecte
l'environnement (`__HC_LAUNCHER_ENV__`) et gère la signature. Pour les faire
fonctionner contre notre conducteur, `client/patch-ui.py` applique au bundle :

1. **ports** → `appPort = 4455` (relais), `adminPort = 4444` ;
2. **autorisation de signature** pour **toutes** les cellules au démarrage ;
3. **autorisation de signature à la création de chaque *clone cell*** (ces apps,
   basées sur `syn`, créent une cellule clonée par « réseau »/espace) ;
4. stockage de l'`AdminWebsocket` dans `window.__KD_ADMIN__` pour (3).

Le bundle patché est ensuite servi en statique par un sidecar nginx.

> Cette méthode marche pour les apps dont le build conserve un chemin « standalone »
> (admin + signature). `gamez` ne l'a pas (code élagué) → non patchable simplement.

## Signature des zome calls

Les appels de zome doivent être **signés**. En dehors du Launcher, on autorise des
*signing credentials* via l'API admin (`authorizeSigningCredentials(cellId)`), par
cellule. Les **clone cells** créées à l'exécution doivent être autorisées **après**
leur création — d'où le point (3) ci-dessus.

## Réseau pair-à-pair

Transport **iroh** (relais public par défaut). Node unique ⇒ pas de pairs ; les données
restent locales. D'autres agents rejoignant la même DNA + `network_seed` forment la
DHT distribuée. Le dashboard `network-viewer` expose `agentInfo`, `dumpNetworkStats`
et `dumpNetworkMetrics`.
