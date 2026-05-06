import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { formatBytes, fileIcon } from '../lib/constants';
import { useToast } from '../hooks/useToast';

export default function MediaModal({ item, onClose }) {
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const toast = useToast();

  useEffect(() => { loadFiles(); }, [item.id]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.media.list(item.id);
      setFiles(res.data?.files || []);
    } catch { toast('Failed to load files', 'err'); }
    finally { setLoading(false); }
  };

  const upload = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true); setProgress(20);
    const fd = new FormData();
    Array.from(fileList).forEach(f => fd.append('files', f));
    try {
      setProgress(50);
      await api.media.upload(item.id, fd);
      setProgress(100);
      toast(`${fileList.length} file(s) uploaded!`, 'ok');
      await loadFiles();
    } catch (e) { toast(e.message || 'Upload failed', 'err'); }
    finally { setTimeout(() => { setUploading(false); setProgress(0); }, 800); }
  };

  const deleteFile = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.media.delete(item.id, fileId);
      toast('File deleted', 'info');
      setFiles(f => f.filter(x => x.id !== fileId));
    } catch { toast('Failed to delete', 'err'); }
  };

  const isImg = (mime) => mime?.startsWith('image/');
  const isVid = (mime) => mime?.startsWith('video/');

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-head">
          <div className="modal-title">🖼️ {item.title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Upload zone */}
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
          >
            <input ref={inputRef} type="file" multiple onChange={e => upload(e.target.files)} />
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📁</div>
            <div style={{ fontSize: 13, color: 'var(--text1)' }}>Drag & drop files, or click to browse</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>Any file type · up to 500MB each</div>
          </div>

          {/* Progress */}
          {uploading && (
            <div>
              <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--amber)', borderRadius: 99, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, textAlign: 'center' }}>Uploading…</div>
            </div>
          )}

          {/* Files grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text2)' }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }} />Loading files…
            </div>
          ) : files.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text2)', fontSize: 13 }}>
              No files yet — upload something above!
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {files.length} file(s)
              </div>
              <div className="media-grid">
                {files.map(f => (
                  <div key={f.id} className="media-thumb">
                    {isImg(f.mime_type)
                      ? <img src={f.signed_url} alt={f.original_name} loading="lazy" />
                      : isVid(f.mime_type)
                        ? <video src={f.signed_url} muted />
                        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
                            <div style={{ fontSize: 24 }}>{fileIcon(f.mime_type)}</div>
                            <div style={{ fontSize: 9, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{f.original_name?.split('.').pop()?.toUpperCase()}</div>
                          </div>
                    }
                    <div className="thumb-overlay">
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{f.original_name}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{formatBytes(f.size_bytes)}</div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                        {(isImg(f.mime_type) || isVid(f.mime_type)) && (
                          <button style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }} onClick={() => setLightbox(f)}>
                            👁 View
                          </button>
                        )}
                        <a href={f.signed_url} download={f.original_name} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 5, padding: '2px 7px', textDecoration: 'none' }}>
                          ⬇ Save
                        </a>
                        <button style={{ fontSize: 10, color: '#fff', background: 'rgba(224,82,82,0.3)', border: '1px solid rgba(224,82,82,0.4)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }} onClick={() => deleteFile(f.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" onClick={() => inputRef.current?.click()}>⬆ Upload Files</button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox.mime_type?.startsWith('video/')
            ? <video src={lightbox.signed_url} controls autoPlay onClick={e => e.stopPropagation()} />
            : <img src={lightbox.signed_url} alt={lightbox.original_name} onClick={e => e.stopPropagation()} />}
        </div>
      )}
    </div>
  );
}
