/**
 * EuroMed — Google Apps Script
 *
 * Ce fichier reprend le mécanisme d'envoi du projet Bon de livraison EuroMed
 * et ajoute l'action `send_protocols` pour l'application Protocoles / Notices.
 *
 * Vous pouvez remplacer le Code.gs du projet Apps Script existant par cette
 * version : l'action `send_delivery` existante est conservée.
 */
const DESTINATAIRE = 'valentineuromed@gmail.com';
const NOM_EXPEDITEUR = 'EuroMed - Documentation';
const ENTREPRISE = 'EuroMed';
const GITHUB_ALLOWED_HOST = 'raw.githubusercontent.com';

function doGet() {
  return ContentService.createTextOutput('EuroMed — service d’envoi actif')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.parameter) throw new Error('Aucune donnée reçue.');
    const action = e.parameter.action || '';
    if (action === 'send_protocols') return sendProtocols_(e);
    if (action === 'send_delivery') return sendDelivery_(e);
    throw new Error('Action inconnue.');
  } catch (err) {
    console.error(err);
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function sendProtocols_(e) {
  const recipient = String(e.parameter.recipient || '').trim();
  if (!isValidEmail_(recipient)) throw new Error('Adresse e-mail destinataire invalide.');

  let requestedDocs;
  try { requestedDocs = JSON.parse(e.parameter.documents || '[]'); }
  catch (_) { throw new Error('Liste des documents invalide.'); }
  if (!Array.isArray(requestedDocs) || !requestedDocs.length) throw new Error('Aucun document sélectionné.');
  if (requestedDocs.length > 25) throw new Error('Trop de documents sélectionnés.');

  const docs = requestedDocs.map(getGithubAttachment_);
  const subject = 'EuroMed — Protocoles et notices';
  const body = [
    'Bonjour,',
    '',
    'Veuillez trouver ci-joint les protocoles / notices EuroMed demandés.',
    '',
    'Documents joints :',
    docs.map(function(d) { return '• ' + d.name; }).join('\n'),
    '',
    'Cordialement,',
    'EuroMed',
    '+33.327.64.34.99',
    'www.euromed-materiel-medical.com',
    '117 rue de Maubeuge F-59620 Aulnoye-Aymeries'
  ].join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    body: body,
    name: NOM_EXPEDITEUR,
    attachments: docs.map(function(d) { return d.blob; })
  });

  return json_({
    ok: true,
    clientSent: true,
    clientEmail: recipient,
    documentsSent: docs.map(function(d) { return d.name; })
  });
}

function sendDelivery_(e) {
  const filename = sanitizeFilename_(e.parameter.filename || 'Bon_de_livraison_EuroMed.pdf');
  const base64 = e.parameter.pdf_base64 || '';
  if (!base64) throw new Error('PDF manquant.');
  const pdfBlob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', filename);

  const data = JSON.parse(e.parameter.data || '{}');
  const sendClient = e.parameter.send_client === '1';
  const photoBase64 = e.parameter.photo_base64 || '';
  const photoName = sanitizeFilename_(e.parameter.photo_filename || 'Photo_lieu_livraison.jpg');
  let photoBlob = null;
  if (photoBase64) {
    photoBlob = Utilities.newBlob(Utilities.base64Decode(photoBase64), 'image/jpeg', photoName.replace(/\.pdf$/i, '.jpg'));
  }
  const requestedDocs = JSON.parse(e.parameter.documents || '[]');
  const docs = sendClient ? requestedDocs.map(getGithubAttachment_) : [];

  const client = data.client || data.destinataire || 'Destinataire non renseigné';
  const internalSubject = 'Bon de livraison EuroMed' + (data.reference ? ' — ' + data.reference : '');
  const docsList = docs.length ? docs.map(function(d){ return '• ' + d.name; }).join('\n') : '• Aucun document complémentaire envoyé au client';
  const internalBody = [
    'Bonjour,', '',
    'Veuillez trouver ci-joint le bon de livraison généré depuis l’application EuroMed.', '',
    'Client : ' + client,
    'Destinataire : ' + (data.destinataire || ''),
    'Date : ' + (data.dateSignature || data.date || ''),
    'Lieu de livraison : ' + (data.lieuSignature || data.lieuLivraison || ''),
    'Référence / commande : ' + (data.reference || ''),
    'E-mail client : ' + (data.emailClient || ''),
    'Destinataire absent : ' + (data.destinataireAbsent ? 'Oui' : 'Non'),
    'Photo du lieu jointe : ' + (photoBlob ? 'Oui' : 'Non'), '',
    'Documents envoyés au client :', docsList, '',
    'Cordialement,', 'EuroMed'
  ].join('\n');

  MailApp.sendEmail({
    to: DESTINATAIRE,
    subject: internalSubject,
    body: internalBody,
    name: NOM_EXPEDITEUR,
    attachments: photoBlob ? [pdfBlob, photoBlob] : [pdfBlob]
  });

  if (sendClient) {
    if (!isValidEmail_(data.emailClient)) throw new Error('Adresse e-mail client invalide.');
    const clientAttachments = [pdfBlob].concat(photoBlob ? [photoBlob] : []).concat(docs.map(function(d){ return d.blob; }));
    const clientBody = [
      'Bonjour,', '',
      'Veuillez trouver ci-joint votre bon de livraison EuroMed.', '',
      'Client : ' + client,
      'Date : ' + (data.dateSignature || data.date || ''),
      'Référence / commande : ' + (data.reference || ''),
      'Destinataire absent : ' + (data.destinataireAbsent ? 'Oui' : 'Non'),
      'Photo du lieu jointe : ' + (photoBlob ? 'Oui' : 'Non'), '',
      docs.length ? 'Documents complémentaires joints :' : 'Aucun document complémentaire joint.',
      docs.length ? docs.map(function(d){ return '• ' + d.name; }).join('\n') : '', '',
      'Cordialement,', 'EuroMed', '+33.327.64.34.99',
      'www.euromed-materiel-medical.com', '117 rue de Maubeuge F-59620 Aulnoye-Aymeries'
    ].join('\n');
    MailApp.sendEmail({
      to: data.emailClient,
      subject: 'EuroMed — Bon de livraison' + (data.reference ? ' — ' + data.reference : ''),
      body: clientBody,
      name: NOM_EXPEDITEUR,
      attachments: clientAttachments
    });
  }

  return json_({ok:true, internalSentTo:DESTINATAIRE, clientSent:sendClient, clientEmail:sendClient ? data.emailClient : '', documentsSent:docs.map(function(d){return d.name;}), deliveryPhotoSent:!!photoBlob});
}

function getGithubAttachment_(doc) {
  if (!doc || !doc.url) throw new Error('Un document sélectionné ne possède pas d’URL GitHub.');
  const url = String(doc.url);
  if (!/^https:\/\/raw\.githubusercontent\.com\//i.test(url)) throw new Error('URL de document GitHub non autorisée.');
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true});
  const code = response.getResponseCode();
  if (code !== 200) throw new Error('Impossible de récupérer le document GitHub (' + code + ').');
  const name = String(doc.name || url.split('/').pop() || 'document.pdf').replace(/[^a-zA-Z0-9._ -]/g,'_');
  const blob = response.getBlob().setName(/\.pdf$/i.test(name) ? name : name + '.pdf');
  return {name: blob.getName(), blob: blob};
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeFilename_(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'Bon_de_livraison_EuroMed.pdf';
}
