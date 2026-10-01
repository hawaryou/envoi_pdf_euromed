# EuroMed — Protocoles & notices — v2

## Nouveautés

- Lecture / prévisualisation de chaque PDF avant envoi.
- Bouton **▣ Lire** à côté de chaque document.
- Lecteur PDF intégré.
- Bouton pour ouvrir le PDF dans un nouvel onglet.
- Sélection multiple et recherche conservées.
- Liste des PDF récupérée automatiquement depuis GitHub.
- Google Apps Script dédié à l'envoi des pièces jointes.
- Le script Google n'accepte que les PDF du dossier `protocolenotice`.

## 1. Installer le Google Apps Script

1. Ouvrez Google Apps Script.
2. Créez un nouveau projet.
3. Remplacez le contenu de `Code.gs` par le `Code.gs` de ce dossier.
4. Enregistrez.
5. Cliquez sur **Déployer > Nouveau déploiement**.
6. Type : **Application Web**.
7. Exécuter en tant que : **Moi**.
8. Qui a accès : **Toute personne disposant du lien**.
9. Déployez et autorisez l'accès à Gmail / UrlFetchApp lorsque Google le demande.
10. Copiez l'URL qui se termine par `/exec`.

## 2. Configurer l'application

Dans `config.js`, remplacez :

`window.GOOGLE_APPS_SCRIPT_URL = 'COLLER_ICI_L_URL_DE_VOTRE_SCRIPT';`

par l'URL `/exec` obtenue à l'étape précédente.

Les paramètres GitHub sont déjà configurés pour :

- propriétaire : `hawaryou`
- dépôt : `bon-livraison-documents`
- branche : `main`
- dossier : `protocolenotice`

## 3. Prévisualisation

Le bouton **Lire** ouvre une fenêtre de lecture intégrée utilisant PDF.js. Cela évite les problèmes d'affichage direct des PDF GitHub dans certains navigateurs.

Le bouton **Ouvrir dans un nouvel onglet** reste disponible pour accéder directement au PDF GitHub si nécessaire.

## 4. Ajouter des documents

Ajoutez simplement un PDF dans :

`protocolenotice/`

Après avoir cliqué sur **Actualiser**, le nouveau document apparaît automatiquement.

## 5. Envoi

Le navigateur transmet au Google Apps Script :

- l'adresse du destinataire ;
- le nom / chemin des fichiers sélectionnés.

Le script reconstruit lui-même les URL GitHub et télécharge les PDF avant de les joindre à l'e-mail avec `MailApp.sendEmail()`.

Aucune clé Gmail ou mot de passe n'est placé dans le site GitHub Pages.


### Version 5 — mobile
Le lecteur PDF utilise PDF.js sans Google Docs Viewer. Sur téléphone, le lecteur passe en plein écran, les commandes sont tactiles, le zoom est disponible et un balayage horizontal permet de changer de page.
