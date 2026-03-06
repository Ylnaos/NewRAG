import React, { useEffect, useMemo, useState } from 'react';
import { Maximize, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDocumentTree } from '../api/backend';
import { DocumentTreeNode, GraphNode, applyDocumentTree, useDocuments } from '../contexts/DocumentsContext';

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

const EvidenceGraph: React.FC = () => {
  const { t } = useTranslation();
  const { documents, updateDocument } = useDocuments();
  const activeDocs = documents.filter((doc) => doc.status !== 'ARCHIVED');
  const [selectedDocId, setSelectedDocId] = useState(activeDocs[0]?.id ?? '');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scale, setScale] = useState(1);
  const [treeError, setTreeError] = useState('');

  useEffect(() => {
    if (activeDocs.length === 0) {
      setSelectedDocId('');
      return;
    }
    if (!selectedDocId || !activeDocs.some((doc) => doc.id === selectedDocId)) {
      setSelectedDocId(activeDocs[0].id);
    }
  }, [activeDocs, selectedDocId]);

  const document = useMemo(() => activeDocs.find((doc) => doc.id === selectedDocId), [activeDocs, selectedDocId]);

  useEffect(() => {
    if (!document) return;
    if (document.tree.length > 0) return;
    let active = true;
    setTreeError('');
    void getDocumentTree(document.id)
      .then((tree) => {
        if (!active) return;
        updateDocument(document.id, (doc) => applyDocumentTree(doc, tree.tree));
      })
      .catch((error) => {
        if (!active) return;
        setTreeError(error instanceof Error ? error.message : t('graph.errors.tree'));
      });
    return () => {
      active = false;
    };
  }, [document, updateDocument, t]);

  const matchingNodes = useMemo(() => {
    if (!document || !searchTerm) return new Set<string>();
    return new Set(document.graph.nodes
      .filter((node) => node.label.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((node) => node.id));
  }, [document, searchTerm]);

  if (!document) {
    return (
      <div className="page">
        <section className="section-card">
          <div className="section-title">{t('graph.title')}</div>
          <p className="muted">{t('graph.noDocuments')}</p>
        </section>
      </div>
    );
  }

  const centerX = 280;
  const centerY = 200;

  const treeNodes = flattenTree(document.tree);
  const selectedNode = document.graph.nodes.find((node) => node.id === selectedNodeId);
  const evidenceCount = selectedNode
    ? document.evidence.filter((item) => item.nodeId === selectedNodeId).length
    : 0;

  const renderTree = (nodes: DocumentTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const isSelected = node.id === selectedNodeId;
      const isMatch = matchingNodes.has(node.id);
      return (
        <div key={node.id} style={{ marginLeft: depth * 12 }}>
          <div
            onClick={() => setSelectedNodeId(node.id)}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'var(--color-primary-light)' : isMatch ? 'var(--color-surface-hover)' : 'transparent',
              border: isSelected ? '1px solid var(--color-border)' : '1px solid transparent',
            }}
          >
            {node.title}
          </div>
          {node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-title">{t('graph.title')}</div>
        <div className="grid-2" style={{ marginTop: '12px' }}>
          <div>
            <label className="muted">{t('graph.documentLabel')}</label>
            <select className="input" value={selectedDocId} onChange={(event) => setSelectedDocId(event.target.value)}>
              {activeDocs.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="muted">{t('graph.searchNodes')}</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
              <input
                className="input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('graph.searchPlaceholder')}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section-card" style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr', gap: '20px' }}>
        <div>
          <div className="section-title">{t('graph.structureTree')}</div>
          {treeError && <div className="muted" style={{ marginBottom: '8px' }}>{treeError}</div>}
          <div style={{ display: 'grid', gap: '6px' }}>
            {document.tree.length > 0 ? renderTree(document.tree) : (
              <div className="muted">{t('graph.treeUnavailable')}</div>
            )}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div className="section-title">{t('graph.graphView')}</div>
            <div className="toolbar">
              <button className="btn" onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}><ZoomIn size={16} /></button>
              <button className="btn" onClick={() => setScale((prev) => Math.max(0.6, prev - 0.1))}><ZoomOut size={16} /></button>
              <button className="btn" onClick={() => setScale(1)}><Maximize size={16} /></button>
            </div>
          </div>
          <div style={{
            marginTop: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '12px',
            background: 'var(--color-bg)'
          }}>
            <svg width="560" height="360" viewBox="0 0 560 360" style={{ width: '100%' }}>
              {document.graph.edges.map((edge) => {
                const source = document.graph.nodes.find((node) => node.id === edge.source);
                const target = document.graph.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={centerX + source.x * scale}
                    y1={centerY + source.y * scale}
                    x2={centerX + target.x * scale}
                    y2={centerY + target.y * scale}
                    stroke="rgba(26, 60, 52, 0.3)"
                    strokeWidth="2"
                  />
                );
              })}
              {document.graph.nodes.map((node: GraphNode) => {
                const isSelected = node.id === selectedNodeId;
                const isMatch = matchingNodes.has(node.id);
                const radius = isSelected ? 18 : isMatch ? 16 : 14;
                return (
                  <g key={node.id} onClick={() => setSelectedNodeId(node.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={centerX + node.x * scale}
                      cy={centerY + node.y * scale}
                      r={radius}
                      fill={isSelected ? 'var(--color-secondary)' : 'var(--color-primary)'}
                      opacity={0.9}
                    />
                    <text
                      x={centerX + node.x * scale}
                      y={centerY + node.y * scale + 26}
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
          </div>
          <div style={{ marginTop: '12px' }}>
            <div className="muted">{t('graph.selectedNode')}</div>
            <div style={{ fontWeight: 600 }}>{selectedNode?.label ?? t('common.none')}</div>
            <div className="muted">{t('graph.linkedEvidence', { count: evidenceCount })}</div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('graph.summaryTitle')}</div>
        <div className="grid-3">
          <div>
            <div className="muted">{t('graph.summaryTotalNodes')}</div>
            <strong>{document.graph.nodes.length}</strong>
          </div>
          <div>
            <div className="muted">{t('graph.summaryTreeDepth')}</div>
            <strong>{treeNodes.length ? Math.max(...treeNodes.map((node) => node.depth)) : 0}</strong>
          </div>
          <div>
            <div className="muted">{t('graph.summaryEvidenceItems')}</div>
            <strong>{document.evidence.length}</strong>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EvidenceGraph;

