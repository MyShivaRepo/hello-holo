## Fichier d'expression du besoin fonctionnel
Les besoins exprimés ici sont communs aux applications `card-classic` et `card-holochain`.

### Modèle de concepts
L'application ne manipule qu'un seul concept : le `Contact`.
Un `Contact` a 4 attributs :
- Nom
- Prénom
- E-Mail
- Téléphone

### Interface utilisateur
L'interface utilisateur comporte 2 modes :
- Le mode `liste`
- Le mode `fiche`

Le mode `liste` est le mode par défaut de l'application affiché au démarrage. Il présente la liste de tous les `Contacts` de la base de données dans un tableau. Chaque en-tête de colonne est cliquable et permet de trier l'ensemble de la base (par ordre alphabétique, puis par ordre alphabétique inversé). Un bouton `Ajouter` permet de créer un nouveau `Contact` en mode `fiche` (couleur verte). La dernière colonne du tableau comporte 2 boutons :
- Un bouton `Modifier` permettant d'accéder aux attributs du `Contact` en mode `fiche` (couleur verte).
- Un bouton `Supprimer` permettant de supprimer définitivement le `Contact` (couleur rouge).

En bas du tableau, un bouton `Exporter RDF/OWL` permet de télécharger l'intégralité de la base de contacts au format RDF/OWL (XML). L'export utilise l'ontologie vCard du W3C (http://www.w3.org/2006/vcard/ns#) pour décrire chaque contact.

Le mode `fiche` permet d'ajouter et/ou de modifier un `Contact`.    
Un bouton `Valider` permet d'enregistrer un nouveau `Contact` ou de valider les modifications d'un `Contact` existant.

### Exigences techniques
- L'application doit être hébergée dans un container Docker.
- Elle est accessible via un port spécifique de la machine locale (port à définir au démarrage du développement).
- L'architecture de l'application doit permettre de modifier l'interface utilisateur sans perdre la base de données existante.

L'application `card-classic` tourne sur <a href="[http://localhost:3000)/">http://localhost:3000</a>   
L'application `card-holochain` tourne sur <a href="[http://localhost:3001)/">http://localhost:3001</a>
