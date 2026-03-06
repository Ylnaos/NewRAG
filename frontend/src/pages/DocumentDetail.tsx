import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Link2, Search, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDocumentDetail, getDocumentTree } from '../api/backend';
import { DocumentStatus, DocumentTreeNode, applyDocumentDetail, applyDocumentTree, useDocuments } from '../contexts/DocumentsContext';

const flattenTree = (nodes: DocumentTreeNode[], depth = 0): Array<DocumentTreeNode & { depth: number }> => {
  const output: Array<DocumentTreeNode & { depth: number }> = [];
  nodes.forEach((node) => {
    output.push({ ...node, depth });
    if (node.children?.length) {
      output.push(...flattenTree(node.children, depth + 1));
    }
  });
  return output;
};

const DocumentDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { getDocumentById, updateDocument } = useDocuments();
  const document = useMemo(() => (id ? getDocumentById(id) : undefined), [id, getDocumentById]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [treeError, setTreeError] = useState('');
  const [hasTriedFetch, setHasTriedFetch] = useState(false);
  const documentId = document?.id;
  const treeLength = document?.tree?.length ?? 0;

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

  useEffect(() => {
    if (!id || !documentId) return;
    let active = true;
    setLoadingDetail(true);
    setDetailError('');
    void getDocumentDetail(id)
      .then((detail) => {
        if (!active) return;
        updateDocument(id, (doc) => applyDocumentDetail(doc, detail));
      })
      .catch((error) => {
        if (!active) return;
        setDetailError(error instanceof Error ? error.message : t('documentDetail.errors.detail'));
      })
      .finally(() => {
        if (!active) return;
        setLoadingDetail(false);
        setHasTriedFetch(true);
      });
    return () => {
      active = false;
    };
  }, [id, documentId, updateDocument, t]);

  useEffect(() => {
    if (!id || documentId) return;
    const timer = setTimeout(() => setHasTriedFetch(true), 800);
    return () => clearTimeout(timer);
  }, [id, documentId]);

  useEffect(() => {
    if (!id || !documentId || treeLength > 0) return;
    let active = true;
    setLoadingTree(true);
    setTreeError('');
    void getDocumentTree(id)
      .then((tree) => {
        if (!active) return;
        updateDocument(id, (doc) => applyDocumentTree(doc, tree.tree));
      })
      .catch((error) => {
        if (!active) return;
        setTreeError(error instanceof Error ? error.message : t('documentDetail.errors.tree'));
      })
      .finally(() => {
        if (!active) return;
        setLoadingTree(false);
      });
    return () => {
      active = false;
    };
  }, [id, documentId, treeLength, updateDocument, t]);

  useEffect(() => {
    if (document?.tree?.length) {
      setExpandedNodes(new Set([document.tree[0].id]));
      setSelectedNodeId((prev) => prev || document.tree[0].id);
    }
  }, [document]);

  const matchingIds = useMemo(() => {
    if (!document) return new Set<string>();
    const flat = flattenTree(document.tree);
    const matches = flat
      .filter((node) => node.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((node) => node.id);
    return new Set(matches);
  }, [document, searchTerm]);

  if (!document && !hasTriedFetch) {
    return (
      <div className="page">
        <section className="section-card">
          <div className="section-title">{t('documentDetail.loadingTitle')}</div>
          <p className="muted">{t('documentDetail.loadingSubtitle')}</p>
        </section>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="page">
        <section className="section-card">
          <div className="section-title">{t('documentDetail.notFoundTitle')}</div>
          <p className="muted">{t('documentDetail.notFoundMessage')}</p>
          <button className="btn" onClick={() => navigate('/docs')}>{t('documentDetail.backToList')}</button>
        </section>
      </div>
    );
  }

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderTree = (nodes: DocumentTreeNode[], depth = 0) => nodes.map((node) => {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const isMatched = matchingIds.has(node.id);
    return (
      <div key={node.id} style={{ marginLeft: depth * 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            borderRadius: '8px',
            background: isSelected ? 'var(--color-primary-light)' : isMatched ? 'var(--color-surface-hover)' : 'transparent',
            cursor: 'pointer',
          }}
          onClick={() => setSelectedNodeId(node.id)}
        >
          {hasChildren ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleNode(node.id);
              }}
              style={{ border: 'none', background: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: '14px' }} />}
          <span>{node.title}</span>
        </div>
        {hasChildren && isExpanded ? renderTree(node.children || [], depth + 1) : null}
      </div>
    );
  });

  const centerX = 260;
  const centerY = 160;
  const selectedNode = document.graph.nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/docs')}>
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <div>
            <div className="section-title">{document.name}</div>
            <div className="muted">{t('documentDetail.versionInfo', { version: document.version, updatedAt: document.updatedAt })}</div>
            {(detailError || treeError) && (
              <div className="muted" style={{ marginTop: '6px', color: 'var(--color-danger)' }}>
                {[detailError, treeError].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <span className="badge badge-outline">{getStatusLabel(document.status)}</span>
        </div>
      </section>

      <section className="section-card">
        <div className="grid-3">
          <div>
            <div className="muted">Pages</div>
            <strong>{document.pages}</strong>
          </div>
          <div>
            <div className="muted">Chunks</div>
            <strong>{document.chunks}</strong>
          </div>
          <div>
            <div className="muted">Version</div>
            <strong>{document.version}</strong>
          </div>
          <div>
            <div className="muted">Size</div>
            <strong>{document.sizeLabel}</strong>
          </div>
          <div>
            <div className="muted">Tags</div>
            <strong>{document.tags.length > 0 ? document.tags.join(', ') : t('common.empty')}</strong>
          </div>
          <div>
            <div className="muted">Archive Path</div>
            <strong>{document.archivePath || t('common.none')}</strong>
          </div>
        </div>
      </section>

      <section className="section-card" style={{ display: 'grid', gridTemplateColumns: '1.15fr 2fr', gap: '20px' }}>
        <div>
          <div className="section-title">{t('documentDetail.structureTree')}</div>
          <div style={{ position: 'relative', marginTop: '12px', marginBottom: '12px' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
            <input
              className="input"
              placeholder={t('documentDetail.searchNode')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>
          {loadingTree && <div className="muted">{t('documentDetail.loadingTree')}</div>}
          <div style={{ display: 'grid', gap: '6px' }}>
            {document.tree.length > 0 ? renderTree(document.tree) : (
              <div className="muted">{t('documentDetail.treeUnavailable')}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <div className="section-title">{t('documentDetail.nodeDetails')}</div>
            {selectedNode ? (
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                <div className="muted">{t('documentDetail.selectedNode')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={16} />
                  <span>{selectedNode.label}</span>
                </div>
                <div className="muted">{selectedNode.path || t('common.empty')}</div>
              </div>
            ) : (
              <div className="muted" style={{ marginTop: '12px' }}>{t('documentDetail.selectNodeHint')}</div>
            )}
          </div>

          <div>
            <div className="section-title">{t('documentDetail.graphTitle')}</div>
            {loadingDetail && <div className="muted">{t('documentDetail.loadingDetail')}</div>}
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '12px',
              background: 'var(--color-bg)',
              marginTop: '12px',
            }}>
              <svg width="520" height="320" viewBox="0 0 520 320" style={{ width: '100%' }}>
                {document.graph.edges.map((edge) => {
                  const source = document.graph.nodes.find((node) => node.id === edge.source);
                  const target = document.graph.nodes.find((node) => node.id === edge.target);
                  if (!source || !target) return null;
                  return (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      x1={centerX + source.x}
                      y1={centerY + source.y}
                      x2={centerX + target.x}
                      y2={centerY + target.y}
                      stroke="rgba(26, 60, 52, 0.3)"
                      strokeWidth="2"
                    />
                  );
                })}
                {document.graph.nodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;
                  return (
                    <g key={node.id} onClick={() => setSelectedNodeId(node.id)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={centerX + node.x}
                        cy={centerY + node.y}
                        r={isSelected ? 18 : 14}
                        fill={isSelected ? 'var(--color-secondary)' : 'var(--color-primary)'}
                        opacity={0.9}
                      />
                      <text
                        x={centerX + node.x}
                        y={centerY + node.y + 30}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--color-text)"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }} className="muted">
                <Link2 size={14} />
                {t('documentDetail.graphHint')}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocumentDetail;
