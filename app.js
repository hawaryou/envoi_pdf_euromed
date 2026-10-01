const APP_URL = window.GOOGLE_APPS_SCRIPT_URL || '';
let allDocuments = [];
let currentPdf = null;
let currentPdfPage = 1;
let currentPdfRenderTask = null;
let pdfZoom = 1;
let pdfFitWidth = true;
let touchStartX = 0;
let touchStartY = 0;

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

async function fetchGithubApiDocuments() {
  const res = await fetch(githubApiUrl(), {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`GitHub API (${res.status})`);
  const files = await res.json();
  if (!Array.isArray(files)) throw new Error('Réponse GitHub invalide.');
  return files
    .filter(f => f.type === 'file' && /\.pdf$/i.test(f.name))
    .map(f => ({
      name: f.name,
      displayName: f.name.replace(/\.pdf$/i, ''),
      path: f.path,
      url: rawUrl(f.path)
    }));
}

async function fetchGithubPageDocuments() {
  // Secours : on lit directement la page publique du dossier GitHub.
  // Cela permet de continuer à afficher les PDF même si l'API GitHub
  // est temporairement limitée.
  const owner = window.GITHUB_OWNER;
  const repo = window.GITHUB_REPO;
  const branch = window.GITHUB_BRANCH || 'main';
  const path = window.GITHUB_DOCUMENTS_PATH || 'protocolenotice';
  const pageUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;

  const res = await fetch(pageUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Page GitHub (${res.status})`);
  const html = await res.text();
  const docs = [];
  const seen = new Set();
  const re = /href=["']\/([^"']+\/blob\/[^"']+)["']/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1].replace(/&amp;/g, '&');
    const decoded = href.split('/').map(x => {
      try { return decodeURIComponent(x); } catch (_) { return x; }
    });
    const name = decoded[decoded.length - 1];
    if (!/\.pdf$/i.test(name)) continue;
    const marker = '/' + owner + '/' + repo + '/blob/' + branch + '/' + path + '/';
    const expectedPrefix = `${owner}/${repo}/blob/${branch}/${path}/`;
    if (!href.startsWith(expectedPrefix)) continue;
    const fullPath = href.split('/blob/')[1].split('/').slice(1).join('/');
    const cleanPath = fullPath.split('?')[0];
    if (seen.has(cleanPath)) continue;
    seen.add(cleanPath);
    docs.push({
      name,
      displayName: name.replace(/\.pdf$/i, ''),
      path: cleanPath,
      url: rawUrl(cleanPath)
    });
  }
  if (!docs.length) throw new Error('Aucun PDF trouvé sur la page GitHub.');
  return docs;
}

async function loadDocuments() {
  const box = $('documentsList');
  box.innerHTML = '<div class="loading">Chargement des PDF depuis GitHub…</div>';
  $('documentsCount').textContent = 'Actualisation…';

  const errors = [];
  try {
    try {
      allDocuments = await fetchGithubApiDocuments();
    } catch (apiErr) {
      errors.push(apiErr.message);
      allDocuments = await fetchGithubPageDocuments();
    }

    allDocuments.sort((a, b) =>
      a.name.localeCompare(b.name, 'fr', { numeric: true })
    );
    renderDocuments();

    const sourceInfo = errors.length
      ? `<div class="source-note">Liste chargée depuis GitHub (mode secours).</div>`
      : '';
    box.insertAdjacentHTML('beforeend', sourceInfo);
  } catch (err) {
    console.error('Chargement GitHub impossible', errors, err);
    box.innerHTML = `
      <div class="empty error">
        <strong>Impossible de charger les PDF.</strong><br>
        Vérifiez votre connexion Internet puis appuyez sur « Actualiser ».
        <br><small>${escapeHtml(err.message)}</small>
        ${errors.length ? `<br><small>API : ${escapeHtml(errors.join(' / '))}</small>` : ''}
        <br><br><button type="button" class="secondary retry-btn" onclick="loadDocuments()">↻ Réessayer</button>
      </div>`;
    $('documentsCount').textContent = 'Chargement impossible';
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

async function openPreview(doc) {
  $('previewTitle').textContent = doc.displayName;
  $('openPdfBtn').href = doc.url;
  $('previewModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
  $('pdfMessage').textContent = 'Chargement du document…';
  $('pdfMessage').classList.remove('hidden');
  $('pdfCanvas').classList.add('hidden');
  $('pdfLoading').textContent = 'Chargement…';
  $('prevPdfPage').disabled = true;
  $('nextPdfPage').disabled = true;
  $('pdfPageInfo').textContent = 'Page 0 / 0';
  pdfZoom = 1;
  pdfFitWidth = true;
  $('pdfZoom').textContent = 'Largeur';

  try {
    if (!window.pdfjsLib) throw new Error("Le lecteur PDF n'a pas pu être chargé.");

    // PDF.js lit directement le PDF public de GitHub : aucun compte Google
    // et aucun service de visualisation externe ne sont nécessaires.
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const response = await fetch(doc.url, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Impossible de récupérer le PDF (HTTP ${response.status}).`);
    const buffer = await response.arrayBuffer();

    currentPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    currentPdfPage = 1;
    $('pdfMessage').classList.add('hidden');
    $('pdfCanvas').classList.remove('hidden');
    $('pdfPageInfo').textContent = `Page 1 / ${currentPdf.numPages}`;
    await renderPdfPage();
  } catch (err) {
    console.error(err);
    currentPdf = null;
    $('pdfCanvas').classList.add('hidden');
    $('pdfMessage').innerHTML =
      `Impossible d'afficher ce PDF dans l'aperçu.<br><small>${escapeHtml(err.message)}</small><br><br>
       <a class="secondary link-button" href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">↗ Ouvrir le PDF</a>`;
    $('pdfMessage').classList.remove('hidden');
  } finally {
    $('pdfLoading').textContent = '';
    updatePdfControls();
  }
}

async function renderPdfPage() {
  if (!currentPdf) return;
  if (currentPdfRenderTask) {
    try { currentPdfRenderTask.cancel(); } catch (_) {}
  }

  const page = await currentPdf.getPage(currentPdfPage);
  const canvas = $('pdfCanvas');
  const viewer = $('pdfViewer');
  const baseViewport = page.getViewport({ scale: 1 });
  const availableWidth = Math.max(260, viewer.clientWidth - 12);
  const fitScale = availableWidth / baseViewport.width;
  const scale = pdfFitWidth ? Math.min(2.5, fitScale) : Math.min(3, Math.max(0.5, fitScale * pdfZoom));
  const viewport = page.getViewport({ scale });
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const context = canvas.getContext('2d', { alpha: false });
  currentPdfRenderTask = page.render({
    canvasContext: context,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null
  });

  try {
    await currentPdfRenderTask.promise;
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') throw err;
  } finally {
    currentPdfRenderTask = null;
  }
  updatePdfControls();
}

function updatePdfControls() {
  const total = currentPdf ? currentPdf.numPages : 0;
  $('pdfPageInfo').textContent = total ? `Page ${currentPdfPage} / ${total}` : 'Page 0 / 0';
  $('pdfZoom').textContent = pdfFitWidth ? 'Largeur' : `${Math.round(pdfZoom * 100)}%`;
  $('fitPdf').classList.toggle('active', pdfFitWidth);
  $('prevPdfPage').disabled = !currentPdf || currentPdfPage <= 1;
  $('nextPdfPage').disabled = !currentPdf || currentPdfPage >= total;
}

async function changePdfPage(delta) {
  if (!currentPdf) return;
  const next = currentPdfPage + delta;
  if (next < 1 || next > currentPdf.numPages) return;
  currentPdfPage = next;
  $('pdfLoading').textContent = 'Affichage…';
  try { await renderPdfPage(); } finally { $('pdfLoading').textContent = ''; }
}

function setZoom(next) {
  if (!currentPdf) return;
  pdfFitWidth = false;
  pdfZoom = Math.min(2.2, Math.max(0.65, next));
  $('pdfLoading').textContent = 'Affichage…';
  renderPdfPage().finally(() => $('pdfLoading').textContent = '');
}

function fitWidth() {
  if (!currentPdf) return;
  pdfFitWidth = true;
  pdfZoom = 1;
  $('pdfLoading').textContent = 'Affichage…';
  renderPdfPage().finally(() => $('pdfLoading').textContent = '');
}

function closePreview() {
  if (currentPdfRenderTask) {
    try { currentPdfRenderTask.cancel(); } catch (_) {}
  }
  currentPdfRenderTask = null;
  currentPdf = null;
  $('pdfCanvas').classList.add('hidden');
  $('pdfMessage').textContent = 'Sélectionnez « Lire » pour afficher le document.';
  $('pdfMessage').classList.remove('hidden');
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
$('prevPdfPage').addEventListener('click', () => changePdfPage(-1));
$('nextPdfPage').addEventListener('click', () => changePdfPage(1));
$('zoomOut').addEventListener('click', () => setZoom(pdfZoom - 0.15));
$('zoomIn').addEventListener('click', () => setZoom(pdfZoom + 0.15));
$('fitPdf').addEventListener('click', fitWidth);

$('pdfViewer').addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, {passive:true});
$('pdfViewer').addEventListener('touchend', e => {
  if (!currentPdf || e.changedTouches.length !== 1) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    changePdfPage(dx < 0 ? 1 : -1);
  }
}, {passive:true});
window.addEventListener('resize', () => { if (currentPdf) renderPdfPage().catch(console.error); });

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
