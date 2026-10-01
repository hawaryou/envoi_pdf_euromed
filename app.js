const APP_URL = window.GOOGLE_APPS_SCRIPT_URL || '';
let allDocuments = [];

const $ = id => document.getElementById(id);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[c]));
}

function githubApiUrl() {
  const owner = window.GITHUB_OWNER;
  const repo = window.GITHUB_REPO;
  const path = window.GITHUB_DOCUMENTS_PATH || 'protocolenotice';
  const branch = window.GITHUB_BRANCH || 'main';
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
}

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${window.GITHUB_OWNER}/${window.GITHUB_REPO}/${window.GITHUB_BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function loadDocuments() {
  const box = $('documentsList');
  box.innerHTML = '<div class="loading">Chargement des PDF depuis GitHub…</div>';
  $('documentsCount').textContent = 'Actualisation…';

  try {
    const res = await fetch(githubApiUrl(), {
      headers: {Accept:'application/vnd.github+json'}
    });
    if (!res.ok) throw new Error(`GitHub (${res.status})`);

    const files = await res.json();
    if (!Array.isArray(files)) throw new Error('Le dossier GitHub n’a pas retourné une liste de fichiers.');

    allDocuments = files
      .filter(f => f.type === 'file' && /\.pdf$/i.test(f.name))
      .sort((a,b) => a.name.localeCompare(b.name, 'fr', {numeric:true}))
      .map(f => ({
        name: f.name,
        displayName: f.name.replace(/\.pdf$/i,''),
        path: f.path,
        url: rawUrl(f.path)
      }));

    renderDocuments();
  } catch (err) {
    console.error(err);
    box.innerHTML = `<div class="empty error">Impossible de charger les documents GitHub.<br><small>${escapeHtml(err.message)}</small></div>`;
    $('documentsCount').textContent = 'Erreur de chargement';
  }
}

function renderDocuments() {
  const term = $('search').value.trim().toLocaleLowerCase('fr');
  const selected = new Set(
    [...document.querySelectorAll('.doc-check:checked')].map(x => x.dataset.path)
  );

  const filtered = allDocuments.filter(d =>
    d.displayName.toLocaleLowerCase('fr').includes(term)
  );

  const box = $('documentsList');
  box.innerHTML = '';

  if (!allDocuments.length) {
    box.innerHTML = '<div class="empty">Aucun fichier PDF trouvé dans <code>protocolenotice</code>.</div>';
  } else if (!filtered.length) {
    box.innerHTML = '<div class="empty">Aucun document ne correspond à votre recherche.</div>';
  } else {
    filtered.forEach(doc => {
      const row = document.createElement('div');
      row.className = 'document-row';

      const label = document.createElement('label');
      label.className = 'document-item';
      label.innerHTML =
        `<input class="doc-check" type="checkbox" data-path="${escapeHtml(doc.path)}" ${selected.has(doc.path) ? 'checked' : ''}>
         <span class="pdf-icon">PDF</span>
         <span class="doc-name">${escapeHtml(doc.displayName)}</span>`;

      const preview = document.createElement('button');
      preview.className = 'preview-btn';
      preview.type = 'button';
      preview.textContent = '▣ Lire';
      preview.title = `Lire ${doc.displayName}`;
      preview.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPreview(doc);
      });

      row.appendChild(label);
      row.appendChild(preview);
      box.appendChild(row);
    });
  }

  $('documentsCount').textContent =
    `${allDocuments.length} PDF disponible${allDocuments.length > 1 ? 's' : ''}`;

  updateSelection();
}

function getSelected() {
  const paths = new Set(
    [...document.querySelectorAll('.doc-check:checked')].map(x => x.dataset.path)
  );
  return allDocuments.filter(d => paths.has(d.path));
}

function updateSelection() {
  const selected = getSelected();
  $('selectedCount').textContent =
    `${selected.length} document${selected.length > 1 ? 's' : ''} sélectionné${selected.length > 1 ? 's' : ''}`;
  $('selectedNames').textContent =
    selected.length ? selected.map(d => d.displayName).join(' · ') : 'Aucun document sélectionné.';
  $('sendBtn').disabled = selected.length === 0;
}

function validate() {
  const email = $('recipientEmail').value.trim();

  if (!emailRegex.test(email)) {
    $('status').innerHTML = '<span class="error">Renseignez une adresse e-mail valide.</span>';
    $('recipientEmail').focus();
    return null;
  }

  const docs = getSelected();
  if (!docs.length) {
    $('status').innerHTML = '<span class="error">Sélectionnez au moins un document.</span>';
    return null;
  }

  if (!APP_URL || APP_URL.includes('COLLER_ICI')) {
    $('status').innerHTML = '<span class="error">L’URL Google Apps Script n’est pas configurée.</span>';
    return null;
  }

  return {email, docs};
}

/* ---------- Prévisualisation PDF ---------- */

function openPreview(doc) {
  $('previewTitle').textContent = doc.displayName;
  $('openPdfBtn').href = doc.url;

  // Certains navigateurs bloquent l'affichage direct d'un PDF GitHub
  // dans une iframe. Google Docs Viewer assure une meilleure compatibilité.
  const viewerUrl =
    'https://docs.google.com/gview?embedded=1&url=' +
    encodeURIComponent(doc.url);

  $('pdfFrame').src = viewerUrl;
  $('previewModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closePreview() {
  $('pdfFrame').src = 'about:blank';
  $('previewModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

/* ---------- Confirmation / envoi ---------- */

function openModal(data) {
  $('confirmEmail').textContent = data.email;
  $('confirmDocs').innerHTML =
    data.docs.map(d => `<li>${escapeHtml(d.displayName)}</li>`).join('');
  $('modalStatus').textContent = '';
  $('modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  $('modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function sendDocuments(data) {
  $('confirmSendBtn').disabled = true;
  $('cancelBtn').disabled = true;
  $('modalStatus').textContent = 'Préparation et envoi des pièces jointes…';

  try {
    const payload = new URLSearchParams({
      action: 'send_protocols',
      recipient: data.email,
      documents: JSON.stringify(data.docs.map(d => ({
        name:d.name,
        path:d.path
      })))
    });

    const res = await fetch(APP_URL, {
      method:'POST',
      body:payload
    });

    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Erreur serveur.');

    $('modalStatus').innerHTML =
      `<span class="success">✓ E-mail envoyé à ${escapeHtml(data.email)}
       avec ${result.documentsSent.length} document${result.documentsSent.length > 1 ? 's' : ''}.</span>`;

    $('status').innerHTML = '<span class="success">Envoi terminé.</span>';
    setTimeout(closeModal, 1800);

  } catch (err) {
    console.error(err);
    $('modalStatus').innerHTML =
      `<span class="error">Échec de l’envoi : ${escapeHtml(err.message)}</span>`;
  } finally {
    $('confirmSendBtn').disabled = false;
    $('cancelBtn').disabled = false;
  }
}

/* ---------- Événements ---------- */

document.addEventListener('change', e => {
  if (e.target.classList.contains('doc-check')) updateSelection();
});

$('search').addEventListener('input', renderDocuments);
$('refreshBtn').addEventListener('click', loadDocuments);

$('selectAll').addEventListener('click', () => {
  document.querySelectorAll('.doc-check').forEach(x => x.checked = true);
  updateSelection();
});

$('clearAll').addEventListener('click', () => {
  document.querySelectorAll('.doc-check').forEach(x => x.checked = false);
  updateSelection();
});

$('sendBtn').addEventListener('click', () => {
  const data = validate();
  if (data) openModal(data);
});

$('confirmSendBtn').addEventListener('click', () => {
  const data = validate();
  if (data) sendDocuments(data);
});

$('closeModal').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);

$('closePreview').addEventListener('click', closePreview);

$('modal').addEventListener('click', e => {
  if (e.target === $('modal')) closeModal();
});

$('previewModal').addEventListener('click', e => {
  if (e.target === $('previewModal')) closePreview();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('previewModal').classList.contains('hidden')) closePreview();
  else if (!$('modal').classList.contains('hidden')) closeModal();
});

loadDocuments();
