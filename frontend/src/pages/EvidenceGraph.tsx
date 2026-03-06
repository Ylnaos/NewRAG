import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize, RefreshCw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BackendGraphNode, getAnswerGraph, listAnswers } from '../api/backend';

interface PositionedNode {
  node: BackendGraphNode;
  x: number;
  y: number;
}

const layoutNodes = (nodes: BackendGraphNode[]): PositionedNode[] => {
  if (nodes.length === 0) return [];
  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const radius = nodes.length === 1 ? 0 : 120 + Math.min(nodes.length, 8) * 10;
    return {
      node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
};

const EvidenceGraph: React.FC = () => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Array<{ answer_id: string; query: string; answer: string; created_at?: string }>>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState('');
  const [graph, setGraph] = useState<{ nodes: BackendGraphNode[]; edges: Array<{ source: string; target: string }> }>({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scale, setScale] = useState(1);
  const [requestError, setRequestError] = useState('');

  const refreshAnswers = useCallback(async () => {
    try {
      const response = await listAnswers();
      const nextAnswers = response.answers.map((item) => ({
        answer_id: item.answer_id,
        query: item.query,
        answer: item.answer,
        created_at: item.created_at,
      }));
      setAnswers(nextAnswers);
      if (!selectedAnswerId && nextAnswers.length > 0) {
        setSelectedAnswerId(nextAnswers[0].answer_id);
      }
      setRequestError('');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t('common.requestFailed'));
    }
  }, [selectedAnswerId, t]);

  useEffect(() => {
    void refreshAnswers();
  }, [refreshAnswers]);

  useEffect(() => {
    if (!selectedAnswerId) return;
    let active = true;
    void getAnswerGraph(selectedAnswerId)
      .then((response) => {
        if (!active) return;
        setGraph({ nodes: response.graph.nodes ?? [], edges: response.graph.edges ?? [] });
        setSelectedNodeId((prev) => prev || response.graph.nodes?.[0]?.id || '');
      })
      .catch((error) => {
        if (!active) return;
        setRequestError(error instanceof Error ? error.message : t('common.requestFailed'));
      });
    return () => {
      active = false;
    };
  }, [selectedAnswerId, t]);

  const filteredAnswers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return answers;
    return answers.filter((item) => item.query.toLowerCase().includes(keyword) || item.answer.toLowerCase().includes(keyword));
  }, [answers, searchTerm]);

  const positionedNodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const selectedNode = useMemo(() => graph.nodes.find((node) => node.id === selectedNodeId), [graph.nodes, selectedNodeId]);

  const centerX = 260;
  const centerY = 180;

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className="section-title">{t('graph.title')}</div>
            <div className="muted">基于真实答案记录展示证据图谱。</div>
            {requestError && <div className="muted" style={{ marginTop: '8px', color: 'var(--color-danger)' }}>{requestError}</div>}
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => void refreshAnswers()}><RefreshCw size={16} />{t('system.refresh')}</button>
            <button className="btn" onClick={() => setScale((prev) => Math.min(2, prev + 0.1))}><ZoomIn size={16} /></button>
            <button className="btn" onClick={() => setScale((prev) => Math.max(0.6, prev - 0.1))}><ZoomOut size={16} /></button>
            <button className="btn" onClick={() => setScale(1)}><Maximize size={16} /></button>
          </div>
        </div>
      </section>

      <section className="section-card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr', gap: '20px' }}>
        <div>
          <div className="section-title">Answers</div>
          <div style={{ position: 'relative', marginTop: '12px', marginBottom: '12px' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
            <input
              className="input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('graph.searchPlaceholder')}
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredAnswers.map((item) => (
              <button
                key={item.answer_id}
                className="btn"
                onClick={() => {
                  setSelectedAnswerId(item.answer_id);
                  setSelectedNodeId('');
                }}
                style={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  padding: '12px',
                  background: selectedAnswerId === item.answer_id ? 'var(--color-primary-light)' : 'var(--color-bg)',
                }}
              >
                <div style={{ display: 'grid', gap: '4px', width: '100%' }}>
                  <strong>{item.query || 'Untitled answer'}</strong>
                  <span className="muted" style={{ whiteSpace: 'normal' }}>{item.answer.slice(0, 120)}</span>
                </div>
              </button>
            ))}
            {filteredAnswers.length === 0 && <div className="muted">暂无答案记录。</div>}
          </div>
        </div>

        <div>
          <div className="section-title">{t('graph.graphView')}</div>
          <div style={{
            marginTop: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            padding: '12px',
            background: 'var(--color-bg)',
          }}>
            <svg width="520" height="360" viewBox="0 0 520 360" style={{ width: '100%' }}>
              {graph.edges.map((edge) => {
                const source = positionedNodes.find((item) => item.node.id === edge.source);
                const target = positionedNodes.find((item) => item.node.id === edge.target);
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
              {positionedNodes.map(({ node, x, y }) => {
                const isSelected = node.id === selectedNodeId;
                return (
                  <g key={node.id} onClick={() => setSelectedNodeId(node.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={centerX + x * scale}
                      cy={centerY + y * scale}
                      r={isSelected ? 18 : 14}
                      fill={isSelected ? 'var(--color-secondary)' : 'var(--color-primary)'}
                      opacity={0.9}
                    />
                    <text x={centerX + x * scale} y={centerY + y * scale + 28} textAnchor="middle" fontSize="11" fill="var(--color-text)">
                      {node.label ?? node.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div>
          <div className="section-title">Node Detail</div>
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
            <div>
              <div className="muted">ID</div>
              <strong>{selectedNode?.id ?? t('common.none')}</strong>
            </div>
            <div>
              <div className="muted">Label</div>
              <strong>{selectedNode?.label ?? t('common.none')}</strong>
            </div>
            <div>
              <div className="muted">Type</div>
              <strong>{selectedNode?.type ?? t('common.none')}</strong>
            </div>
            <div>
              <div className="muted">Metadata</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedNode ? JSON.stringify(selectedNode.metadata ?? {}, null, 2) : t('common.none')}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EvidenceGraph;
