/**
 * EuroMed — Google Apps Script
 * Service dédié à l'envoi des protocoles PDF et des liens vidéo YouTube.
 *
 * Déploiement :
 * 1. Créer un projet Google Apps Script.
 * 2. Coller ce fichier dans Code.gs.
 * 3. Déployer > Nouveau déploiement > Application Web.
 * 4. Exécuter en tant que : Moi.
 * 5. Qui a accès : Toute personne disposant du lien.
 * 6. Copier l'URL /exec dans config.js.
 *
 * Le serveur reconstruit lui-même l'URL GitHub à partir du nom du fichier.
 * Il n'accepte donc pas une URL externe fournie par le navigateur.
 */

const CONFIG = {
  githubOwner: 'hawaryou',
  githubRepo: 'bon-livraison-documents',
  githubBranch: 'main',
  githubFolder: 'protocolenotice',

  senderName: 'EuroMed - Documentation',

  // Sujet et texte du mail.
  subject: 'EuroMed — Protocoles et notices'
};

function doGet() {
  return json_({
    ok: true,
    service: 'EuroMed — envoi des protocoles',
    status: 'active'
  });
}

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      throw new Error('Aucune donnée reçue.');
    }

    const action = String(e.parameter.action || '');

    if (action === 'send_protocols') {
      return sendProtocols_(e);
    }

    throw new Error('Action inconnue.');
  } catch (err) {
    console.error(err);
    return json_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function sendProtocols_(e) {
  const recipient = String(e.parameter.recipient || '').trim();

  if (!isValidEmail_(recipient)) {
    throw new Error('Adresse e-mail destinataire invalide.');
  }

  let requestedDocs;
  try {
    requestedDocs = JSON.parse(e.parameter.documents || '[]');
  } catch (err) {
    throw new Error('Liste des documents invalide.');
  }

  if (!Array.isArray(requestedDocs) || !requestedDocs.length) {
    throw new Error('Aucun document sélectionné.');
  }

  if (requestedDocs.length > 25) {
    throw new Error('Vous pouvez sélectionner au maximum 25 documents par envoi.');
  }

  const videos = [];
  const pdfRequests = [];
  requestedDocs.forEach(function(item) {
    if (item && item.type === 'video') {
      videos.push(getApprovedVideo_(item));
    } else {
      pdfRequests.push(item);
    }
  });
  const docs = pdfRequests.map(getGithubAttachment_);

  // Limite pratique : évite les messages trop volumineux.
  const totalBytes = docs.reduce(function(sum, doc) {
    return sum + doc.blob.getBytes().length;
  }, 0);

  // 24 Mo laisse une marge par rapport aux limites Gmail/Workspace.
  if (totalBytes > 24 * 1024 * 1024) {
    throw new Error('Les fichiers sélectionnés sont trop volumineux pour un seul e-mail. Sélectionnez moins de documents.');
  }

  const bodyLines = [
    'Bonjour,',
    '',
    'Voici les documents et vidéos EuroMed demandés.',
    ''
  ];
  if (docs.length) {
    bodyLines.push('PDF en pièces jointes :');
    docs.forEach(function(doc) { bodyLines.push('• ' + doc.name); });
    bodyLines.push('');
  }
  if (videos.length) {
    bodyLines.push('Vidéos YouTube :');
    videos.forEach(function(video) {
      bodyLines.push('• ' + video.name + ' : ' + video.url);
    });
    bodyLines.push('');
  }
  bodyLines.push(
    'Cordialement,',
    'EuroMed',
    '+33.327.64.34.99',
    'www.euromed-materiel-medical.com',
    '117 rue de Maubeuge F-59620 Aulnoye-Aymeries'
  );
  const body = bodyLines.join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject: CONFIG.subject,
    body: body,
    name: CONFIG.senderName,
    attachments: docs.map(function(doc) {
      return doc.blob;
    })
  });

  return json_({
    ok: true,
    clientEmail: recipient,
    itemsSent: docs.map(function(doc) { return doc.name; }).concat(videos.map(function(video) { return video.name; })),
    documentsSent: docs.map(function(doc) { return doc.name; }),
    videosSent: videos.map(function(video) { return video.name; })
  });
}


/** Liste blanche : seules ces vidéos peuvent être ajoutées aux e-mails. */
function getApprovedVideo_(item) {
  const approved = {
    'montage-lit': {
      name: 'Montage de lit médicalisé',
      url: 'https://www.youtube.com/watch?v=_XSKSj2j-AU'
    },
    'demontage-lit': {
      name: 'Démontage de lit médicalisé',
      url: 'https://www.youtube.com/watch?v=JWcgAP7tlmc'
    }
  };
  const video = approved[String(item.id || '')];
  if (!video) throw new Error('Vidéo YouTube non autorisée.');
  return video;
}

/**
 * Récupère un PDF depuis le dossier GitHub autorisé.
 * Le navigateur transmet uniquement le chemin du fichier.
 */
function getGithubAttachment_(doc) {
  if (!doc || !doc.path) {
    throw new Error('Un document sélectionné ne possède pas de chemin GitHub.');
  }

  const path = String(doc.path);

  // Protection : seuls les PDF du dossier configuré sont acceptés.
  const prefix = CONFIG.githubFolder.replace(/\/+$/, '') + '/';

  if (path.indexOf(prefix) !== 0) {
    throw new Error('Document non autorisé : ' + path);
  }

  if (!/\.pdf$/i.test(path)) {
    throw new Error('Seuls les fichiers PDF sont autorisés.');
  }

  const url =
    'https://raw.githubusercontent.com/' +
    encodeURIComponent(CONFIG.githubOwner) + '/' +
    encodeURIComponent(CONFIG.githubRepo) + '/' +
    encodeURIComponent(CONFIG.githubBranch) + '/' +
    path.split('/').map(encodeURIComponent).join('/');

  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true
  });

  const code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('Impossible de récupérer "' + path + '" depuis GitHub (HTTP ' + code + ').');
  }

  const filename = path.split('/').pop()
    .replace(/[^a-zA-Z0-9À-ÿ._ -]/g, '_');

  const blob = response.getBlob()
    .setName(filename);

  return {
    name: filename,
    blob: blob
  };
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
