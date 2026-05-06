/**
 * media.js — Media Gallery + Share Management UI
 * Loaded by dashboard.html. Depends on api.js and ui.js.
 */

// ─── File type helpers ────────────────────────────────────────────────────────
function isImage(mime) { return mime?.startsWith('image/'); }
function isVideo(mime) { return mime?.startsWith('video/'); }
function fileIcon(mime) {
  if (isImage(mime)) return '🖼️';
  if (isVideo(mime)) return '🎬';
  if (mime === 'application/pdf') return '📄';
  if (mime?.includes('zip') || mime?.includes('compressed')) return '🗜️';
  if (mime?.startsWith('text/')) return '📝';
  if (mime?.includes('word') || mime?.includes('document')) return '📝';
  if (mime?.includes('sheet') || mime?.includes('excel')) return '📊';
  return '📁';
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function openLightbox(url, mime) {
  const existing = document.querySelector('.lightbox-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';

  if (isVideo(mime)) {
    overlay.innerHTML = `
      <span class="lightbox-close">✕</span>
      <video src="${url}" controls autoplay style="max-width:90vw;max-height:85vh;border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,0.6)"></video>`;
  } else {
    overlay.innerHTML = `
      <span class="lightbox-close">✕</span>
      <img class="lightbox-img" src="${url}" alt="Preview">`;
  }

  const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  document.body.appendChild(overlay);
}

// ─── Build media gallery HTML ─────────────────────────────────────────────────
function buildMediaGallery(files) {
  if (!files.length) return `
    <div class="empty-state" style="padding:32px">
      <div class="empty-icon">📂</div>
      <p>No files yet. Upload photos, videos, docs or any file below.</p>
    </div>`;

  const images = files.filter(f => isImage(f.mime_type));
  const videos = files.filter(f => isVideo(f.mime_type));
  const others = files.filter(f => !isImage(f.mime_type) && !isVideo(f.mime_type));

  const imgGrid = images.length ? `
    <div class="media-grid">
      ${images.map(f => `
        <div class="media-thumb" data-url="${f.signed_url}" data-mime="${f.mime_type}" data-id="${f.id}">
          <img src="${f.signed_url}" alt="${escapeHtml(f.original_name)}" loading="lazy">
          <div class="media-thumb-overlay">
            <button class="preview-btn" data-url="${f.signed_url}" data-mime="${f.mime_type}">🔍 Preview</button>
            <button class="download-btn" data-url="${f.signed_url}" data-name="${escapeHtml(f.original_name)}">⬇ Download</button>
            <button class="delete-file-btn" data-id="${f.id}" style="background:rgba(224,82,82,0.3);border-color:rgba(224,82,82,0.4)">🗑 Delete</button>
          </div>
        </div>`).join('')}
    </div>` : '';

  const vidRows = videos.length ? `
    <div style="margin-top:${images.length ? '12px' : '0'}">
      ${videos.map(f => `
        <div class="media-file-row" style="margin-bottom:8px">
          <span class="media-file-icon">🎬</span>
          <div class="media-file-info">
            <div class="media-file-name">${escapeHtml(f.original_name)}</div>
            <div class="media-file-meta">${formatBytes(f.size_bytes)}</div>
          </div>
          <div class="media-file-actions">
            <button class="btn btn-ghost btn-sm preview-btn" data-url="${f.signed_url}" data-mime="${f.mime_type}">▶ Play</button>
            <button class="btn btn-ghost btn-sm download-btn" data-url="${f.signed_url}" data-name="${escapeHtml(f.original_name)}">⬇</button>
            <button class="btn btn-danger btn-sm delete-file-btn" data-id="${f.id}">🗑</button>
          </div>
        </div>`).join('')}
    </div>` : '';

  const otherRows = others.length ? `
    <div style="margin-top:${(images.length || videos.length) ? '12px' : '0'}">
      ${others.map(f => `
        <div class="media-file-row" style="margin-bottom:8px">
          <span class="media-file-icon">${fileIcon(f.mime_type)}</span>
          <div class="media-file-info">
            <div class="media-file-name">${escapeHtml(f.original_name)}</div>
            <div class="media-file-meta">${formatBytes(f.size_bytes)} · ${f.mime_type}</div>
          </div>
          <div class="media-file-actions">
            <button class="btn btn-ghost btn-sm download-btn" data-url="${f.signed_url}" data-name="${escapeHtml(f.original_name)}">⬇ Download</button>
            <button class="btn btn-danger btn-sm delete-file-btn" data-id="${f.id}">🗑</button>
          </div>
        </div>`).join('')}
    </div>` : '';

  return imgGrid + vidRows + otherRows;
}

// ─── Attach media gallery events ──────────────────────────────────────────────
function attachMediaEvents(container, itemId, onRefresh) {
  // Preview
  container.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(btn.dataset.url, btn.dataset.mime);
    });
  });

  // Download
  container.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = btn.dataset.url;
      a.download = btn.dataset.name || 'file';
      a.target = '_blank';
      a.click();
    });
  });

  // Delete file
  container.querySelectorAll('.delete-file-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this file? This cannot be undone.')) return;
      try {
        await api.media.delete(itemId, btn.dataset.id);
        Toast.success('File deleted');
        onRefresh();
      } catch (err) {
        Toast.error(err.message);
      }
    });
  });
}

// ─── Build upload zone HTML ───────────────────────────────────────────────────
function buildUploadZone(itemId) {
  return `
    <div class="upload-zone" id="upload-zone-${itemId}">
      <input type="file" id="file-input-${itemId}" multiple accept="*/*">
      <div class="upload-zone-icon">☁️</div>
      <div class="upload-zone-text">Click or drag & drop files here</div>
      <div class="upload-zone-sub">Photos, videos, PDFs, ZIPs — any file up to 500 MB · Max 20 at once</div>
    </div>
    <div class="upload-progress-list" id="progress-list-${itemId}"></div>
  `;
}

function attachUploadEvents(itemId, onUploaded) {
  const zone = document.getElementById(`upload-zone-${itemId}`);
  const fileInput = document.getElementById(`file-input-${itemId}`);
  const progressList = document.getElementById(`progress-list-${itemId}`);

  if (!zone || !fileInput) return;

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    progressList.innerHTML = '';

    // Show progress rows
    files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'upload-progress-item';
      row.id = `prog-${f.name.replace(/\s/g, '_')}`;
      row.innerHTML = `
        <span class="upload-progress-name">${escapeHtml(f.name)}</span>
        <div class="upload-progress-bar-wrap"><div class="upload-progress-bar" style="width:0%"></div></div>
        <span class="upload-progress-status">0%</span>`;
      progressList.appendChild(row);
    });

    // Upload in batches of 5
    const BATCH = 5;
    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      const fd = new FormData();
      batch.forEach(f => fd.append('files', f));

      // Animate progress (since Supabase upload doesn't stream progress, we fake it)
      const batchNames = batch.map(f => f.name.replace(/\s/g, '_'));
      let pct = 0;
      const ticker = setInterval(() => {
        pct = Math.min(pct + 12, 85);
        batchNames.forEach(name => {
          const bar = document.querySelector(`#prog-${name} .upload-progress-bar`);
          const lbl = document.querySelector(`#prog-${name} .upload-progress-status`);
          if (bar) bar.style.width = pct + '%';
          if (lbl) lbl.textContent = pct + '%';
        });
      }, 200);

      try {
        await api.media.upload(itemId, fd);
        clearInterval(ticker);
        batchNames.forEach(name => {
          const bar = document.querySelector(`#prog-${name} .upload-progress-bar`);
          const lbl = document.querySelector(`#prog-${name} .upload-progress-status`);
          if (bar) { bar.style.width = '100%'; bar.style.background = 'var(--green)'; }
          if (lbl) { lbl.textContent = '✓'; lbl.style.color = 'var(--green)'; }
        });
      } catch (err) {
        clearInterval(ticker);
        Toast.error(`Upload failed: ${err.message}`);
        batchNames.forEach(name => {
          const lbl = document.querySelector(`#prog-${name} .upload-progress-status`);
          if (lbl) { lbl.textContent = '✕'; lbl.style.color = 'var(--red)'; }
        });
      }
    }

    setTimeout(() => {
      progressList.innerHTML = '';
      onUploaded();
    }, 1200);
  };

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  // Drag and drop
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

// ─── Open media detail modal ──────────────────────────────────────────────────
async function openMediaModal(item) {
  let files = [];
  try { files = await api.media.list(item.id); } catch {}

  const refresh = async () => {
    try {
      files = await api.media.list(item.id);
      document.getElementById('media-gallery-wrap').innerHTML = buildMediaGallery(files);
      attachMediaEvents(document.getElementById('media-gallery-wrap'), item.id, refresh);
    } catch (err) {
      Toast.error(err.message);
    }
  };

  Modal.open({
    title: `🖼️ ${escapeHtml(item.title)}`,
    body: `
      <div id="media-gallery-wrap">${buildMediaGallery(files)}</div>
      ${buildUploadZone(item.id)}
      <div class="share-section">
        <div class="share-section-title">Share this gallery</div>
        <div id="share-codes-wrap">Loading…</div>
        <button class="btn btn-secondary btn-sm" id="create-share-btn" style="margin-top:10px">＋ Generate Share Code</button>
      </div>`,
  });

  // Attach events after modal renders
  setTimeout(() => {
    attachMediaEvents(document.getElementById('media-gallery-wrap'), item.id, refresh);
    attachUploadEvents(item.id, refresh);
    loadShareCodes(item.id);
    document.getElementById('create-share-btn')?.addEventListener('click', () => createShareCode(item));
  }, 50);
}

// ─── Share codes panel ────────────────────────────────────────────────────────
async function loadShareCodes(itemId) {
  const wrap = document.getElementById('share-codes-wrap');
  if (!wrap) return;
  try {
    const codes = await api.share.listCodes(itemId);
    if (!codes.length) {
      wrap.innerHTML = `<p style="font-size:0.82rem;color:var(--text-muted)">No share codes yet. Generate one to share this gallery with someone.</p>`;
      return;
    }
    wrap.innerHTML = codes.map(c => `
      <div class="share-code-card">
        <div class="share-code-badge">${escapeHtml(c.code)}</div>
        <div class="share-code-info">
          <div class="share-code-label">${escapeHtml(c.label || 'Untitled')}</div>
          <div class="share-code-status ${c.status}">${c.status} · ${c.request_count} request(s)</div>
        </div>
        <button class="btn btn-ghost btn-sm copy-code-btn" data-code="${escapeHtml(c.code)}" title="Copy code">⎘</button>
        ${c.status === 'active' ? `<button class="btn btn-danger btn-sm revoke-btn" data-id="${c.id}" data-item="${itemId}" title="Revoke">✕</button>` : ''}
      </div>`).join('');

    wrap.querySelectorAll('.copy-code-btn').forEach(btn =>
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.code, 'Share code'))
    );
    wrap.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Revoke this share code? Anyone with it will no longer be able to use it.')) return;
        try {
          await api.share.revokeCode(btn.dataset.item, btn.dataset.id);
          Toast.success('Share code revoked');
          loadShareCodes(itemId);
        } catch (err) { Toast.error(err.message); }
      });
    });
  } catch (err) {
    wrap.innerHTML = `<p style="color:var(--red);font-size:0.82rem">${err.message}</p>`;
  }
}

async function createShareCode(item) {
  const label = prompt(`Label for this share code (optional):\ne.g. "For Alice", "Grandma"`) ?? '';
  try {
    const result = await api.share.createCode(item.id, label);
    Toast.success(`Share code created: ${result.share_code.code}`);
    await copyToClipboard(result.share_code.code, 'Share code');
    loadShareCodes(item.id);
  } catch (err) {
    Toast.error(err.message);
  }
}

// ─── Pending requests notification ───────────────────────────────────────────
async function loadPendingRequests() {
  try {
    const requests = await api.share.listPending();
    const badge = document.getElementById('pending-badge');
    const dot = document.getElementById('pending-dot');

    if (badge) badge.textContent = requests.length || '';
    if (dot) dot.style.display = requests.length ? 'block' : 'none';

    return requests;
  } catch {
    return [];
  }
}

async function openPendingRequestsModal() {
  const requests = await loadPendingRequests();
  const body = requests.length
    ? requests.map(r => `
        <div class="pending-request-card">
          <div class="pending-req-who">${escapeHtml(r.accessor_name || r.accessor_email)}</div>
          <div class="pending-req-item">wants to access <strong>${escapeHtml(r.item_title)}</strong> <span class="badge badge-muted">${r.item_type}</span></div>
          <div class="pending-req-meta">📧 ${escapeHtml(r.accessor_email)} · ${timeAgo(r.requested_at)}</div>
          <div class="pending-req-actions">
            <button class="btn btn-primary btn-sm approve-req-btn" data-id="${r.id}">✓ Approve</button>
            <button class="btn btn-danger btn-sm deny-req-btn" data-id="${r.id}">✕ Deny</button>
          </div>
        </div>`).join('')
    : `<div class="empty-state" style="padding:32px">
        <div class="empty-icon">✉️</div>
        <p>No pending access requests right now.</p>
       </div>`;

  Modal.open({ title: '📬 Access Requests', body });

  setTimeout(() => {
    document.querySelectorAll('.approve-req-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = '…';
        try {
          await api.share.respond(btn.dataset.id, 'approve');
          Toast.success('Access approved — accessor has been emailed a link');
          Modal.close();
          loadPendingRequests();
        } catch (err) { Toast.error(err.message); btn.disabled = false; btn.textContent = '✓ Approve'; }
      });
    });
    document.querySelectorAll('.deny-req-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true; btn.textContent = '…';
        try {
          await api.share.respond(btn.dataset.id, 'deny');
          Toast.success('Access denied — accessor has been notified');
          Modal.close();
          loadPendingRequests();
        } catch (err) { Toast.error(err.message); btn.disabled = false; btn.textContent = '✕ Deny'; }
      });
    });
  }, 50);
}

// Expose for dashboard.html
window.openMediaModal = openMediaModal;
window.openPendingRequestsModal = openPendingRequestsModal;
window.loadPendingRequests = loadPendingRequests;
