# EuroMed — Envoi des protocoles et notices

Cette mini-application récupère automatiquement les PDF du dossier GitHub `protocolenotice`, permet d'en sélectionner plusieurs et les envoie comme pièces jointes via Google Apps Script.

## 1. Google Apps Script

Le `Code.gs` fourni reprend l'action existante `send_delivery` du projet Bon de livraison et ajoute `send_protocols`.

Remplacez le `Code.gs` du projet Apps Script existant par celui-ci, puis redéployez l'application Web en conservant l'URL `/exec`.

Le compte Google qui exécute le script doit autoriser `MailApp` et `UrlFetchApp` lors de la première exécution.

## 2. GitHub Pages

Placez `index.html`, `style.css`, `app.js`, `config.js` et `euromed-logo.jpeg` dans le dossier que vous souhaitez publier avec GitHub Pages.

`config.js` pointe déjà vers :

- propriétaire : `hawaryou`
- dépôt : `bon-livraison-documents`
- branche : `main`
- dossier : `protocolenotice`

La liste est chargée à chaque ouverture et peut être actualisée avec le bouton « Actualiser ».

## 3. Ajouter / supprimer des documents

Il suffit d'ajouter ou supprimer un fichier `.pdf` dans `protocolenotice`. Aucun changement de code n'est nécessaire.

## 4. Limites

Google Apps Script et Gmail/Google Workspace appliquent des quotas et limites de taille de messages/pièces jointes. Si plusieurs PDF volumineux sont sélectionnés, l'envoi peut être refusé par Google.
