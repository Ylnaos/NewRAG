import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listAnswers } from '../api/backend';

interface EvidenceRef {
  id: string;
  chunkId: string;
  docId: string;
  path: string;
  score: number;
  snippet: string;
  conflict: boolean;
  redundant: boolean;
}

interface ChainNode {
  id: string;
  title: string;
  summary: string;
  children?: ChainNode[];
}

interface AnswerChain {
  id: string;
  query: string;
  answer: string;
  createdAt: string;
  evidence: EvidenceRef[];
  root: ChainNode;
}

const FAVORITES_KEY = 'favorite_thought_chains_v1';

const buildChain = (item: AnswerChain): ChainNode => ({
  id: `${item.id}-root`,
  title: item.query || 'Untitled answer',
  summary: item.answer,
  children: item.evidence.map((evidence) => ({
    id: evidence.id,
    title: evidence.path || evidence.chunkId,
    summary: evidence.snippet,
  })),
});

const ThoughtChainManager: React.FC = () => {
  const { t } = useTranslation();
  const [chains, setChains] = useState<AnswerChain[]>([]);
  const [selectedChainId, setSelectedChainId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [requestError, setRequestError] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    void listAnswers()
      .then((response) => {
        const nextChains = response.answers.map((item) => {
          const evidence = (item.evidence ?? []).map((entry, index) => ({
            id: String(entry.chunk_id ?? entry.id ?? `evidence-${index + 1}`),
            chunkId: String(entry.chunk_id ?? entry.id ?? `evidence-${index + 1}`),
            docId: String(entry.doc_id ?? ''),
            path: String(entry.path ?? ''),
            score: Number(entry.score ?? 0),
            snippet: String(entry.snippet ?? entry.text ?? ''),
            conflict: Boolean(entry.conflict_flag),
            redundant: Boolean(entry.redundant_flag),
          }));
          const chain: AnswerChain = {
            id: item.answer_id,
            query: item.query,
            answer: item.answer,
            createdAt: item.created_at ?? '',
            evidence,
            root: { id: '', title: '', summary: '' },
          };
          chain.root = buildChain(chain);
          return chain;
        });
        setChains(nextChains);
        if (!selectedChainId && nextChains.length > 0) {
          setSelectedChainId(nextChains[0].id);
          setExpandedNodeIds(new Set([nextChains[0].root.id]));
        }
      })
      .catch((error) => {
        setRequestError(error instanceof Error ? error.message : t('common.requestFailed'));
      });
  }, [selectedChainId, t]);

  const filteredChains = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return chains;
    return chains.filter((item) => item.query.toLowerCase().includes(keyword) || item.answer.toLowerCase().includes(keyword));
  }, [chains, searchTerm]);

  const selectedChain = useMemo(() => chains.find((item) => item.id === selectedChainId) ?? null, [chains, selectedChainId]);

  const toggleFavorite = (chainId: string) => {
    setFavoriteIds((prev) => prev.includes(chainId) ? prev.filter((item) => item !== chainId) : [...prev, chainId]);
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderNode = (node: ChainNode, depth = 0) => {
    const hasChildren = Boolean(node.children?.length);
    const expanded = expandedNodeIds.has(node.id);
    return (
      <div key={node.id} style={{ marginLeft: depth * 14 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0' }}>
          {hasChildren ? (
            <button className="btn" onClick={() => toggleNode(node.id)} style={{ padding: '4px 6px' }}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span style={{ width: '26px' }} />}
          <div>
            <div style={{ fontWeight: 600 }}>{node.title}</div>
            <div className="muted">{node.summary}</div>
          </div>
        </div>
        {hasChildren && expanded ? node.children?.map((child) => renderNode(child, depth + 1)) : null}
      </div>
    );
  };

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-title">{t('thoughtChains.title')}</div>
        <div className="muted">使用真实答案记录和证据构建可浏览的答案链路。</div>
        {requestError && <div className="muted" style={{ marginTop: '8px', color: 'var(--color-danger)' }}>{requestError}</div>}
      </section>

      <section className="section-card" style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr', gap: '20px' }}>
        <div>
          <div className="section-title">{t('thoughtChains.listTitle')}</div>
          <div style={{ position: 'relative', marginTop: '12px', marginBottom: '12px' }}>
            <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
            <input
              className="input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('documents.searchPlaceholder')}
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredChains.map((chain) => (
              <button
                key={chain.id}
                className="btn"
                onClick={() => {
                  setSelectedChainId(chain.id);
                  setExpandedNodeIds(new Set([chain.root.id]));
                }}
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '12px',
                  textAlign: 'left',
                  background: selectedChainId === chain.id ? 'var(--color-primary-light)' : 'var(--color-bg)',
                }}
              >
                <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
                  <strong>{chain.query}</strong>
                  <span className="muted">{chain.answer.slice(0, 96)}</span>
                </div>
                <Star size={16} fill={favoriteIds.includes(chain.id) ? 'currentColor' : 'none'} onClick={(event) => { event.stopPropagation(); toggleFavorite(chain.id); }} />
              </button>
            ))}
            {filteredChains.length === 0 && <div className="muted">{t('thoughtChains.emptyList')}</div>}
          </div>
        </div>

        <div>
          <div className="section-title">{t('thoughtChains.detailTitle')}</div>
          {selectedChain ? (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="section-card" style={{ background: 'var(--color-bg)' }}>
                <div className="muted">{t('thoughtChains.questionLabel')}</div>
                <strong>{selectedChain.query}</strong>
                <div className="muted" style={{ marginTop: '12px' }}>{t('thoughtChains.answerLabel')}</div>
                <div>{selectedChain.answer}</div>
              </div>

              <div className="section-card" style={{ background: 'var(--color-bg)' }}>
                <div className="section-title">{t('thoughtChains.structureTitle')}</div>
                {renderNode(selectedChain.root)}
              </div>

              <div className="section-card" style={{ background: 'var(--color-bg)' }}>
                <div className="section-title">{t('thoughtChains.evidenceDetailTitle')}</div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {selectedChain.evidence.map((item) => (
                    <div key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px', display: 'grid', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={14} />
                        <strong>{item.path || item.chunkId}</strong>
                      </div>
                      <div className="muted">Score {item.score.toFixed(2)}</div>
                      <div>{item.snippet || t('common.empty')}</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.conflict && <span className="badge badge-danger">{t('thoughtChains.conflict')}</span>}
                        {item.redundant && <span className="badge badge-warning">{t('thoughtChains.redundant')}</span>}
                      </div>
                    </div>
                  ))}
                  {selectedChain.evidence.length === 0 && <div className="muted">{t('thoughtChains.nodeNoEvidence')}</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="muted">{t('thoughtChains.emptySelection')}</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ThoughtChainManager;
