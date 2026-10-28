# Exigences — hello-holo

> Expression du besoin utilisateur. Ce document est un **brouillon initial**
> reconstitué à partir des premières sessions de travail ; il est destiné à être
> relu et complété par le propriétaire du projet. Conformément à la convention du
> projet, les évolutions du besoin se font **d'abord ici (sur GitHub)**, puis sont
> clonées en local.

## Objectif

Disposer d'un environnement **conteneurisé** permettant d'explorer **Holochain** :
faire tourner un *conducteur* local, y installer des **hApps**, et pouvoir
**interagir graphiquement** avec elles.

## Exigences fonctionnelles

| Id | Besoin | État |
|---|---|---|
| EX-01 | Faire tourner un **node Holochain** dans un container Docker | ✅ fait |
| EX-02 | Y installer **hREA** et pouvoir l'interroger (GraphQL) | ✅ fait |
| EX-03 | Disposer d'une **IHM graphique** pour manipuler des données hREA | ✅ fait (`:4003`) |
| EX-04 | Pouvoir installer **plusieurs hApps** dans le même conducteur | ✅ fait |
| EX-05 | Installer des hApps **avec interface graphique** | ✅ partiel (KanDo, TalkingStickies, Emergence) |
| EX-06 | Une **page d'accueil** unique pour accéder à toutes les hApps | ✅ fait (`:4000`) |
| EX-07 | **Visualiser le réseau** et les pairs du conducteur | ✅ fait (`:4001`) |
| EX-08 | Ports d'accès des hApps dans la plage **4000‑4999** | ✅ fait |
| EX-09 | Outil générique pour **ajouter une hApp** facilement | ✅ fait (`apps/add-happ.sh`) |

## Exigences non fonctionnelles

- **NFR-01** — Démarrage de toute la stack en **une commande** (`docker compose up -d`).
- **NFR-02** — Données du conducteur **persistées** (volume `hrea-data`).
- **NFR-03** — IHM **simples et lisibles** (sans redondance, listes ordonnées).

## Hors périmètre / limites acceptées

- Les IHM des hApps « Launcher/Moss » sont des **builds patchés** (démonstration),
  pas un usage de production.
- `gamez` : IHM non fournie (build sans voie de signature exploitable hors Weave).

## Pistes ouvertes

- Faire tourner l'IHM de `gamez` via un *shim* de signature dédié.
- Démonstration **multi-nœuds** (2 conducteurs rejoignant le même réseau).
- Intégration/essai via le **Holochain Launcher / Moss**.
