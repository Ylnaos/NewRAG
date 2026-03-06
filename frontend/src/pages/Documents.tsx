import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArrowLeft, FileText, Folder, RotateCcw, Search, Upload, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ArchiveFolderDialog from '../components/ui/ArchiveFolderDialog';
import { useConfirm } from '../contexts/ConfirmContext';
import { DocumentStatus, useDocuments } from '../contexts/DocumentsContext';

const statusBadgeClass = (status: DocumentStatus) => {
  if (status === 'READY') return 'badge-success';
  if (status === 'ERROR') return 'badge-danger';
  if (status === 'ARCHIVED') return 'badge-outline';
  return 'badge-warning';
};

const Documents: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { documents, addFiles, deleteDocument, archiveDocument, restoreDocument, cacheAgeMs, cacheStale, errorMessage } = useDocuments();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'ALL'>('ALL');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string; mode: 'archive' | 'update' } | null>(null);
  const [archivePath, setArchivePath] = useState('');

  const getStatusLabel = (status: DocumentStatus) => {
    switch (status) {
      case 'RAW':
        return t('documents.status.raw');
      case 'QUEUED':
        return t('documents.status.queued');
      case 'PARSED':
        return t('documents.status.parsed');
      case 'CHUNKED':
        return t('documents.status.chunked');
      case 'EMBEDDED':
        return t('documents.status.embedded');
      case 'INDEXED':
        return t('documents.status.indexed');
      case 'READY':
        return t('documents.status.ready');
      case 'ERROR':
        return t('documents.status.error');
      case 'ARCHIVED':
        return t('documents.status.archived');
      default:
        return status;
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || doc.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchTerm, statusFilter]);

  const archivePathOptions = useMemo(() => {
    const paths = new Set<string>();
    documents.forEach((doc) => {
      if (!doc.archivePath) return;
      const parts = doc.archivePath.split('/').map((part) => part.trim()).filter(Boolean);
      let current = '';
      parts.forEach((part) => {
        current = current ? `${current}/${part}` : part;
        paths.add(current);
      });
    });
    return Array.from(paths).sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;
    void addFiles(files).catch(() => {});
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    handleFiles(dropped);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('documents.confirm.deleteTitle'),
      message: t('documents.confirm.deleteMessage'),
      type: 'danger',
      confirmText: t('documents.delete'),
    });
    if (ok) {
      void deleteDocument(id).catch(() => {});
    }
  };

  const openArchiveDialog = (doc: { id: string; name: string; archivePath?: string }, mode: 'archive' | 'update') => {
    setArchiveTarget({ id: doc.id, name: doc.name, mode });
    setArchivePath(doc.archivePath ?? '');
    setArchiveDialogOpen(true);
  };

  const closeArchiveDialog = () => {
    setArchiveDialogOpen(false);
    setArchiveTarget(null);
    setArchivePath('');
  };

  const handleArchiveConfirm = () => {
    if (!archiveTarget) return;
    void archiveDocument(archiveTarget.id, archivePath.trim()).catch(() => {});
    closeArchiveDialog();
  };

  const handleArchive = (doc: { id: string; name: string; archivePath?: string }) => {
    openArchiveDialog(doc, 'archive');
  };

  const handleArchiveEdit = (doc: { id: string; name: string; archivePath?: string }) => {
    openArchiveDialog(doc, 'update');
  };

  const handleRestore = async (id: string) => {
    const ok = await confirm({
      title: t('documents.confirm.restoreTitle'),
      message: t('documents.confirm.restoreMessage'),
      type: 'info',
      confirmText: t('documents.restore'),
    });
    if (ok) {
      void restoreDocument(id).catch(() => {});
    }
  };

  const cacheAgeMin = Math.floor(cacheAgeMs / 60000);
  const archiveDialogTitle = archiveTarget?.mode === 'update'
    ? t('documents.archiveEditTitle')
    : t('documents.confirm.archiveTitle');
  const archiveDialogMessage = archiveTarget?.mode === 'update'
    ? t('documents.archiveEditMessage')
    : t('documents.confirm.archiveMessage');
  const archiveDialogConfirmText = archiveTarget?.mode === 'update'
    ? t('documents.archiveEditConfirm')
    : t('documents.archive');

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/qa')}>
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <div>
            <div className="section-title">{t('documents.title')}</div>
            <div className="muted">
              {t('documents.cache', {
                state: cacheStale ? t('documents.cacheStale') : t('documents.cacheFresh'),
                minutes: cacheAgeMin,
              })}
            </div>
            {errorMessage && (
              <div className="muted" style={{ marginTop: '6px', color: 'var(--color-danger)' }}>
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-card">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed var(--color-secondary)' : '2px dashed var(--color-border)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: isDragging ? 'rgba(224, 122, 95, 0.08)' : 'var(--color-bg)'
          }}
        >
          <Upload size={28} />
          <div style={{ marginTop: '10px', fontWeight: 600 }}>{t('documents.drop')}</div>
          <div className="muted" style={{ marginTop: '6px' }}>{t('documents.supports')}</div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '12px' }}
            onClick={() => inputRef.current?.click()}
          >
            {t('documents.selectFiles')}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.md,.txt"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => handleFiles(Array.from(event.target.files || []))}
          />
        </div>
      </section>

      <section className="section-card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '32px', width: '100%' }}
              placeholder={t('documents.searchPlaceholder')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            className="input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DocumentStatus | 'ALL')}
          >
            <option value="ALL">{t('documents.statusAll')}</option>
            <option value="RAW">{t('documents.status.raw')}</option>
            <option value="QUEUED">{t('documents.status.queued')}</option>
            <option value="PARSED">{t('documents.status.parsed')}</option>
            <option value="CHUNKED">{t('documents.status.chunked')}</option>
            <option value="EMBEDDED">{t('documents.status.embedded')}</option>
            <option value="INDEXED">{t('documents.status.indexed')}</option>
            <option value="READY">{t('documents.status.ready')}</option>
            <option value="ARCHIVED">{t('documents.status.archived')}</option>
          </select>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('documents.sectionTitle')}</div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1fr 1fr 1fr auto',
                gap: '12px',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/docs/${doc.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={18} />
                <div>
                  <div style={{ fontWeight: 600 }}>{doc.name}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {doc.sizeLabel} · {t('documents.pages', { count: doc.pages })}
                  </div>
                  {doc.status === 'ARCHIVED' && doc.archivePath && (
                    <div className="muted" style={{ fontSize: '0.75rem' }}>
                      {t('documents.archivePathDisplay', { path: doc.archivePath })}
                    </div>
                  )}
                </div>
              </div>
              <div className="muted">{doc.updatedAt}</div>
              <div className="muted">{doc.version}</div>
              <span className={`badge ${statusBadgeClass(doc.status)}`}>{getStatusLabel(doc.status)}</span>
              <div style={{ display: 'flex', gap: '8px' }} onClick={(event) => event.stopPropagation()}>
                {doc.status === 'ARCHIVED' ? (
                  <>
                    <button className="btn" onClick={() => handleArchiveEdit(doc)} title={t('documents.archiveEdit')}>
                      <Folder size={14} />
                    </button>
                    <button className="btn" onClick={() => handleRestore(doc.id)} title={t('documents.restore')}>
                      <RotateCcw size={14} />
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => handleArchive(doc)} title={t('documents.archive')}>
                    <Archive size={14} />
                  </button>
                )}
                <button className="btn" onClick={() => handleDelete(doc.id)} title={t('documents.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredDocuments.length === 0 && (
            <div className="muted">{t('documents.empty')}</div>
          )}
        </div>
      </section>
      <ArchiveFolderDialog
        isOpen={archiveDialogOpen}
        title={archiveDialogTitle}
        message={archiveDialogMessage}
        label={t('documents.archivePathLabel')}
        placeholder={t('documents.archivePathPlaceholder')}
        value={archivePath}
        options={archivePathOptions}
        hint={t('documents.archivePathHint')}
        confirmText={archiveDialogConfirmText}
        cancelText={t('confirm.cancel')}
        onChange={setArchivePath}
        onConfirm={handleArchiveConfirm}
        onCancel={closeArchiveDialog}
      />
    </div>
  );
};

export default Documents;
