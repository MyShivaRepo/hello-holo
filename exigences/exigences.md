## Fichier d'expression du besoin fonctionnel
Le besoin exprimé ici est commun aux applications ```card-classic``` et ```card-holochain```

# Modèle de concepts
L'application ne manipule qu'un seul concept : le ```Contact```.    
Un ```Contact``` à 4 attributs : 
  - Nom
  - Prénom
  - E-Mail
  - Téléphone

# Interface utilisateur
L'interface utilisateur dispose de 2 modes :   
  - Le mode ```liste```
  - Le mode ```fiche```

Le mode ```liste``` est le mode par défaut de l'application qui s'affiche au démarrage.   
Il présente la liste de tous les ```Contacts``` de la base de données dans un tableau.  
Chaque en-tête de colonne est cliquable et permet de trier la totalité de la base de données (par ordre alphabétique, puis par ordre inverse alphabétique).   
Un bouton ```Ajouter``` permet de créer un nouveau ```Contact``` en mode ```fiche``` (couleur bleu).   
La dernière colonne du tableau dispose de 2 boutons :   
  - Un bouton ```Modifier``` qui permet d'accéder aux attibuts du ```Contact``` en mode ```fiche``` (couleur bleu).
  - Un bouton ```Supprimer``` qui permet de détruire définitivelent le ```Contact``` (couleur rouge).

Le mode ```fiche``` est le mode utilisé pour ajouter et/ou modifier un ```Contact```.   
Un bouton ```Valider``` permet d'enregister un nouveau ```Contact``` ou bien de valider les modifications d'un ```Contact``` existant.

# Exigences techniques
L'application doit être hébergé dans un container Docker.
Elle est accessible via un port particulier suir la machine locale (port à définir en début de dévelopement)
L'architecture de l'application doit permettre d'apporter des modifications à l'interface utilisateur sans perdre la base de données existante.
