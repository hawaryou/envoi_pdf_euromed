# EuroMed — Protocoles, notices & vidéos — v5.3

## Nouveautés

- Lecture / prévisualisation de chaque PDF avant envoi.
- Bouton **▣ Lire** à côté de chaque document.
- Lecteur PDF intégré.
- Bouton pour ouvrir le PDF dans un nouvel onglet.
- Sélection multiple et recherche conservées.
- Liste des PDF récupérée automatiquement depuis GitHub.
- Google Apps Script dédié à l'envoi des pièces jointes.
- Les deux vidéos YouTube sont sélectionnables et leurs liens sont ajoutés au corps de l'e-mail.
- Les PDF sélectionnés sont joints au message ; les vidéos ne sont pas téléchargées, seul leur titre et leur lien sont inclus.
- Le script Google n'accepte que les PDF du dossier `protocolenotice` et une liste blanche des deux vidéos autorisées.

## Correctif si l’envoi d’une vidéo affiche « Un document sélectionné ne possède pas de chemin GitHub »

Ce message indique généralement que l’ancienne version du script est encore déployée. Le `Code.gs` fourni ici sépare les vidéos YouTube des PDF : les vidéos ajoutent uniquement leur titre et leur URL dans le mail.

**Pour corriger le déploiement existant :**
1. Ouvrez le projet Google Apps Script utilisé par cette application.
2. Remplacez tout le contenu de `Code.gs` par le fichier `Code.gs` inclus dans cette archive, puis enregistrez.
3. Cliquez sur **Déployer > Gérer les déploiements**.
4. Cliquez sur le crayon **Modifier** du déploiement de type Application Web.
5. Dans **Version**, choisissez **Nouvelle version**, puis cliquez sur **Déployer**.
6. Gardez la même URL `/exec` dans `config.js` si vous avez modifié le déploiement existant.
7. Rechargez la page EuroMed et réessayez en sélectionnant une vidéo.

Ne créez pas simplement une nouvelle version du site : c’est bien le déploiement Google Apps Script qui doit être mis à jour.

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

## 5. Envoi des PDF et vidéos

Le navigateur transmet au Google Apps Script :

- l'adresse du destinataire ;
- le nom / chemin des fichiers sélectionnés.

Le script reconstruit lui-même les URL GitHub et télécharge les PDF avant de les joindre à l'e-mail avec `MailApp.sendEmail()`. Pour les vidéos, il ajoute le titre et le lien YouTube dans le texte du message :

- Montage de lit médicalisé : https://www.youtube.com/watch?v=_XSKSj2j-AU
- Démontage de lit médicalisé : https://www.youtube.com/watch?v=JWcgAP7tlmc

Aucune clé Gmail ou mot de passe n'est placé dans le site GitHub Pages.


### Version 5 — mobile
Le lecteur PDF utilise PDF.js sans Google Docs Viewer. Sur téléphone, le lecteur passe en plein écran, les commandes sont tactiles, le zoom est disponible et un balayage horizontal permet de changer de page.


### Chargement GitHub renforcé
La liste des PDF utilise l’API GitHub avec un mode secours basé sur la page publique du dossier si l’API est temporairement limitée.


### Mise à jour importante du Google Apps Script

Cette version modifie aussi `Code.gs`. Remplacez son contenu dans votre projet Apps Script, enregistrez, puis ouvrez **Déployer > Gérer les déploiements > Modifier** et choisissez **Nouvelle version** avant de redéployer. Conservez l'URL `/exec` déjà inscrite dans `config.js` si vous modifiez le déploiement existant.
