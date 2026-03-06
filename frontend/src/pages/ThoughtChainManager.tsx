import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  MessagesSquare,
  Network,
  Search,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../contexts/ChatContext';
import { useDocuments } from '../contexts/DocumentsContext';

type ChainType = 'response' | 'conversation' | 'profile' | 'longform';

interface EvidenceRef {
  id: string;
  docName: string;
  chunkId: string;
  score: number;
  path: string;
  sourceRank: number;
  conflict: boolean;
  redundant: boolean;
  snippet: string;
}

interface ChainNode {
  id: string;
  title: string;
  claim: string;
  evidence: EvidenceRef[];
  children?: ChainNode[];
}

interface ThoughtChain {
  id: string;
  title: string;
  type: ChainType;
  source: string;
  updatedAt: string;
  question: string;
  answer: string;
  summary: string;
  root: ChainNode;
}

interface ChainMetrics {
  nodeCount: number;
  evidenceCount: number;
  coveredNodes: number;
  conflictCount: number;
  redundantCount: number;
  coverage: number;
}

const FAVORITES_KEY = 'favorite_thought_chains_v1';

const pickEvidence = (pool: EvidenceRef[], count: number, seed: number) => {
  if (pool.length === 0) return [];
  return Array.from({ length: count }, (_, index) => pool[(seed + index) % pool.length]);
};

const flattenNodes = (node: ChainNode): ChainNode[] => {
  const output = [node];
  node.children?.forEach((child) => output.push(...flattenNodes(child)));
  return output;
};

const collectEvidence = (node: ChainNode): EvidenceRef[] =>
  flattenNodes(node).flatMap((item) => item.evidence);

const buildMetrics = (chain: ThoughtChain): ChainMetrics => {
  const nodes = flattenNodes(chain.root);
  const evidence = collectEvidence(chain.root);
  const coveredNodes = nodes.filter((node) => node.evidence.length > 0).length;
  const conflictCount = evidence.filter((item) => item.conflict).length;
  const redundantCount = evidence.filter((item) => item.redundant).length;
  const coverage = nodes.length === 0 ? 0 : Math.round((coveredNodes / nodes.length) * 100);
  return {
    nodeCount: nodes.length,
    evidenceCount: evidence.length,
    coveredNodes,
    conflictCount,
    redundantCount,
    coverage,
  };
};

const ThoughtChainManager: React.FC = () => {
  const { t } = useTranslation();
  const { documents } = useDocuments();
  const { sessions } = useChat();

  const typeMeta = useMemo(() => ({
    response: {
      label: t('thoughtChains.types.response.label'),
      description: t('thoughtChains.types.response.description'),
      icon: MessagesSquare,
    },
    conversation: {
      label: t('thoughtChains.types.conversation.label'),
      description: t('thoughtChains.types.conversation.description'),
      icon: Network,
    },
    profile: {
      label: t('thoughtChains.types.profile.label'),
      description: t('thoughtChains.types.profile.description'),
      icon: Database,
    },
    longform: {
      label: t('thoughtChains.types.longform.label'),
      description: t('thoughtChains.types.longform.description'),
      icon: FileText,
    },
  }), [t]);

  const typeContextLabel = useMemo(() => ({
    response: t('thoughtChains.context.response'),
    conversation: t('thoughtChains.context.conversation'),
    profile: t('thoughtChains.context.profile'),
    longform: t('thoughtChains.context.longform'),
  }), [t]);

  const buildChainTree = useCallback((pool: EvidenceRef[], seed: number, type: ChainType): ChainNode => {
    const context = typeContextLabel[type];
    const base = `${type}-${seed}`;
    const root: ChainNode = {
      id: `${base}-root`,
      title: t('thoughtChains.tree.root.title'),
      claim: t('thoughtChains.tree.root.claim', { context }),
      evidence: pickEvidence(pool, 2, seed),
    };
    const structure: ChainNode = {
      id: `${base}-structure`,
      title: t('thoughtChains.tree.structure.title'),
      claim: t('thoughtChains.tree.structure.claim', { context }),
      evidence: pickEvidence(pool, 2, seed + 1),
      children: [
        {
          id: `${base}-mapping`,
          title: t('thoughtChains.tree.mapping.title'),
          claim: t('thoughtChains.tree.mapping.claim'),
          evidence: pickEvidence(pool, 1, seed + 2),
        },
        {
          id: `${base}-retrieval`,
          title: t('thoughtChains.tree.retrieval.title'),
          claim: t('thoughtChains.tree.retrieval.claim'),
          evidence: pickEvidence(pool, 1, seed + 3),
        },
      ],
    };
    const fusion: ChainNode = {
      id: `${base}-fusion`,
      title: t('thoughtChains.tree.fusion.title'),
      claim: t('thoughtChains.tree.fusion.claim', { context }),
      evidence: pickEvidence(pool, 2, seed + 4),
      children: [
        {
          id: `${base}-consistency`,
          title: t('thoughtChains.tree.consistency.title'),
          claim: t('thoughtChains.tree.consistency.claim'),
          evidence: pickEvidence(pool, 1, seed + 5),
        },
        {
          id: `${base}-conflict`,
          title: t('thoughtChains.tree.conflict.title'),
          claim: t('thoughtChains.tree.conflict.claim'),
          evidence: pickEvidence(pool, 1, seed + 6),
        },
      ],
    };
    const conclusion: ChainNode = {
      id: `${base}-conclusion`,
      title: t('thoughtChains.tree.conclusion.title'),
      claim: t('thoughtChains.tree.conclusion.claim', { context }),
      evidence: pickEvidence(pool, 2, seed + 7),
      children: [
        {
          id: `${base}-summary`,
          title: t('thoughtChains.tree.summary.title'),
          claim: t('thoughtChains.tree.summary.claim'),
          evidence: pickEvidence(pool, 1, seed + 8),
        },
        {
          id: `${base}-boundary`,
          title: t('thoughtChains.tree.boundary.title'),
          claim: t('thoughtChains.tree.boundary.claim'),
          evidence: pickEvidence(pool, 1, seed + 9),
        },
      ],
    };
    root.children = [structure, fusion, conclusion];
    return root;
  }, [t, typeContextLabel]);

  const evidencePool = useMemo(() => (
    documents.flatMap((doc) =>
      doc.evidence.map((item) => ({
        id: item.id,
        docName: doc.name,
        chunkId: item.chunkId,
        score: item.score,
        path: item.path,
        sourceRank: item.sourceRank,
        conflict: item.conflict,
        redundant: item.redundant,
        snippet: item.snippet,
      }))
    )
  ), [documents]);
  const evidenceMissing = evidencePool.length === 0;

  const nowLabel = useMemo(() => new Date().toLocaleString(), []);

  const responseChains = useMemo(() => {
    const output: ThoughtChain[] = [];
    sessions.forEach((session, sessionIndex) => {
      const assistantMessages = session.messages
        .map((message, messageIndex) => ({ message, messageIndex }))
        .filter(({ message }) => message.role === 'assistant');

      assistantMessages.forEach(({ message, messageIndex }) => {
        const previousMessages = session.messages.slice(0, messageIndex).reverse();
        const userMessage = previousMessages.find((msg) => msg.role === 'user');
        output.push({
          id: `response-${session.id}-${message.id}`,
          title: t('thoughtChains.chain.responseTitle', { title: session.title }),
          type: 'response',
          source: t('thoughtChains.chain.responseSource', { title: session.title }),
          updatedAt: new Date(session.updatedAt).toLocaleString(),
          question: userMessage?.content || session.title || t('thoughtChains.chain.responseQuestionFallback'),
          answer: message.content || t('thoughtChains.chain.responseAnswerFallback'),
          summary: message.thought
            ? t('thoughtChains.chain.responseSummaryWithThought', { count: message.thought.steps.length })
            : t('thoughtChains.chain.responseSummaryDefault'),
          root: buildChainTree(evidencePool, sessionIndex * 10 + messageIndex + 1, 'response'),
        });
      });
    });

    if (output.length === 0) {
      output.push({
        id: 'response-sample',
        title: t('thoughtChains.chain.responseSampleTitle'),
        type: 'response',
        source: t('thoughtChains.chain.responseSampleSource'),
        updatedAt: nowLabel,
        question: t('thoughtChains.chain.responseSampleQuestion'),
        answer: t('thoughtChains.chain.responseSampleAnswer'),
        summary: t('thoughtChains.chain.responseSampleSummary'),
        root: buildChainTree(evidencePool, 1, 'response'),
      });
    }
    return output;
  }, [sessions, evidencePool, nowLabel, buildChainTree, t]);

  const conversationChains = useMemo<ThoughtChain[]>(() => {
    if (sessions.length === 0) {
      return [{
        id: 'conversation-sample',
        title: t('thoughtChains.chain.conversationSampleTitle'),
        type: 'conversation',
        source: t('thoughtChains.chain.conversationSampleSource'),
        updatedAt: nowLabel,
        question: t('thoughtChains.chain.conversationSampleQuestion'),
        answer: t('thoughtChains.chain.conversationSampleAnswer'),
        summary: t('thoughtChains.chain.conversationSampleSummary'),
        root: buildChainTree(evidencePool, 11, 'conversation'),
      }];
    }
    return sessions.map((session, index) => ({
      id: `conversation-${session.id}`,
      title: t('thoughtChains.chain.conversationTitle', { title: session.title }),
      type: 'conversation',
      source: t('thoughtChains.chain.conversationSource', { title: session.title }),
      updatedAt: new Date(session.updatedAt).toLocaleString(),
      question: t('thoughtChains.chain.conversationQuestion', { count: session.messages.length }),
      answer: t('thoughtChains.chain.conversationAnswer'),
      summary: t('thoughtChains.chain.conversationSummary', {
        count: session.messages.filter((msg) => msg.role === 'assistant').length,
      }),
      root: buildChainTree(evidencePool, 20 + index, 'conversation'),
    }));
  }, [sessions, evidencePool, nowLabel, buildChainTree, t]);

  const profileChain = useMemo<ThoughtChain>(() => {
    const totalRounds = sessions.reduce((acc, session) => acc + session.messages.length, 0);
    return {
      id: 'profile-aggregate',
      title: t('thoughtChains.chain.profileTitle'),
      type: 'profile',
      source: t('thoughtChains.chain.profileSource', { count: sessions.length }),
      updatedAt: nowLabel,
      question: t('thoughtChains.chain.profileQuestion', { count: totalRounds }),
      answer: t('thoughtChains.chain.profileAnswer'),
      summary: t('thoughtChains.chain.profileSummary'),
      root: buildChainTree(evidencePool, 40, 'profile'),
    };
  }, [sessions, evidencePool, nowLabel, buildChainTree, t]);

  const longformChain = useMemo<ThoughtChain>(() => {
    const targetDoc = documents.find((doc) => doc.status === 'READY') || documents[0];
    return {
      id: `longform-${targetDoc?.id ?? 'sample'}`,
      title: t('thoughtChains.chain.longformTitle', {
        title: targetDoc?.name ?? t('thoughtChains.chain.longformSourceFallback'),
      }),
      type: 'longform',
      source: targetDoc
        ? t('thoughtChains.chain.longformSource', { title: targetDoc.name })
        : t('thoughtChains.chain.longformSourceFallback'),
      updatedAt: nowLabel,
      question: t('thoughtChains.chain.longformQuestion'),
      answer: t('thoughtChains.chain.longformAnswer'),
      summary: t('thoughtChains.chain.longformSummary'),
      root: buildChainTree(evidencePool, 60, 'longform'),
    };
  }, [documents, evidencePool, nowLabel, buildChainTree, t]);

  const allChains = useMemo<ThoughtChain[]>(
    () => [...responseChains, ...conversationChains, profileChain, longformChain],
    [responseChains, conversationChains, profileChain, longformChain]
  );

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

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  const [filterType, setFilterType] = useState<ChainType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filteredChains = useMemo(() => (
    allChains.filter((chain) => {
      const matchesType = filterType === 'ALL' || chain.type === filterType;
      const matchesFavorites = !onlyFavorites || favoriteIds.includes(chain.id);
      const keyword = searchTerm.trim().toLowerCase();
      const matchesKeyword = !keyword
        || chain.title.toLowerCase().includes(keyword)
        || chain.summary.toLowerCase().includes(keyword)
        || chain.question.toLowerCase().includes(keyword)
        || chain.answer.toLowerCase().includes(keyword);
      return matchesType && matchesFavorites && matchesKeyword;
    })
  ), [allChains, filterType, onlyFavorites, favoriteIds, searchTerm]);

  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const selectedChain = useMemo(
    () => filteredChains.find((chain) => chain.id === selectedChainId) ?? filteredChains[0],
    [filteredChains, selectedChainId]
  );

  useEffect(() => {
    if (!selectedChain) {
      setSelectedChainId('');
      return;
    }
    if (selectedChainId !== selectedChain.id) {
      setSelectedChainId(selectedChain.id);
    }
  }, [selectedChain, selectedChainId]);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  useEffect(() => {
    if (!selectedChain) return;
    setExpandedNodes(new Set([selectedChain.root.id]));
    setSelectedNodeId(selectedChain.root.id);
  }, [selectedChain]);

  const flattenedNodes = useMemo(
    () => (selectedChain ? flattenNodes(selectedChain.root) : []),
    [selectedChain]
  );
  const selectedNode = flattenedNodes.find((node) => node.id === selectedNodeId) || flattenedNodes[0];

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

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

  const renderNode = (node: ChainNode, depth = 0) => {
    const hasChildren = !!node.children?.length;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.id === selectedNodeId;
    const hasConflict = node.evidence.some((item) => item.conflict);
    return (
      <div key={node.id} style={{ marginLeft: depth * 12 }}>
        <div
          onClick={() => setSelectedNodeId(node.id)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '8px',
            borderRadius: '10px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
            border: isSelected ? '1px solid var(--color-border)' : '1px solid transparent',
          }}
        >
          {hasChildren ? (
            <button
              className='btn'
              onClick={(event) => {
                event.stopPropagation();
                toggleNode(node.id);
              }}
              style={{ padding: '2px 6px' }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span style={{ width: '24px' }} />
          )}
          <div style={{ flex: 1, display: 'grid', gap: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem' }}>{node.title}</strong>
              <span className='badge badge-outline'>{t('thoughtChains.badges.evidence', { count: node.evidence.length })}</span>
              {hasConflict && <span className='badge badge-danger'>{t('thoughtChains.conflict')}</span>}
            </div>
            <div className='muted' style={{ fontSize: '0.8rem' }}>
              {node.claim}
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const chainMetrics = selectedChain ? buildMetrics(selectedChain) : undefined;
  const evidenceConflictRate = chainMetrics && chainMetrics.evidenceCount > 0
    ? Math.round((chainMetrics.conflictCount / chainMetrics.evidenceCount) * 100)
    : 0;
  const evidenceRedundantRate = chainMetrics && chainMetrics.evidenceCount > 0
    ? Math.round((chainMetrics.redundantCount / chainMetrics.evidenceCount) * 100)
    : 0;

  const favoriteChains = allChains.filter((chain) => favoriteIds.includes(chain.id));
  const avgCoverage = favoriteChains.length === 0
    ? 0
    : Math.round(favoriteChains.reduce((acc, chain) => acc + buildMetrics(chain).coverage, 0) / favoriteChains.length);

  const strategyStages = useMemo(() => ([
    t('thoughtChains.strategy.stages.locate'),
    t('thoughtChains.strategy.stages.retrieve'),
    t('thoughtChains.strategy.stages.fuse'),
    t('thoughtChains.strategy.stages.validate'),
    t('thoughtChains.strategy.stages.summarize'),
  ]), [t]);

  return (
    <div className='page'>
      <section className='section-card'>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className='section-title'>{t('thoughtChains.title')}</div>
            <div className='muted'>{t('thoughtChains.subtitle')}</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span className='badge badge-outline'>{t('thoughtChains.stats.favorites', { count: favoriteChains.length })}</span>
            <span className='badge badge-outline'>{t('thoughtChains.stats.available', { count: allChains.length })}</span>
            <span className='badge badge-outline'>{t('thoughtChains.stats.coverage', { percent: avgCoverage })}</span>
          </div>
        </div>
      </section>

      <section className='section-card'>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1.6fr 1fr 1fr', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--color-text-muted)' }} />
              <input
                className='input'
                style={{ paddingLeft: '32px', width: '100%' }}
                placeholder={t('thoughtChains.searchPlaceholder')}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <select
              className='input'
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as ChainType | 'ALL')}
            >
              <option value='ALL'>{t('thoughtChains.filterAll')}</option>
              {Object.entries(typeMeta).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type='checkbox'
                checked={onlyFavorites}
                onChange={(event) => setOnlyFavorites(event.target.checked)}
              />
              {t('thoughtChains.onlyFavorites')}
            </label>
          </div>
          <div className='muted' style={{ fontSize: '0.85rem' }}>
            {t('thoughtChains.hint')}
          </div>
          {evidenceMissing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className='badge badge-danger'>{t('thoughtChains.evidenceMissing')}</span>
              <span className='muted'>{t('thoughtChains.evidenceMissingHint')}</span>
            </div>
          )}
        </div>
      </section>

      <section className='section-card' style={{ display: 'grid', gridTemplateColumns: '1.1fr 2fr', gap: '20px' }}>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div className='section-title'>{t('thoughtChains.listTitle')}</div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {filteredChains.map((chain) => {
              const metrics = buildMetrics(chain);
              const Icon = typeMeta[chain.type].icon;
              const isSelected = chain.id === selectedChainId;
              const isFavorite = favoriteIds.includes(chain.id);
              return (
                <div
                  key={chain.id}
                  onClick={() => setSelectedChainId(chain.id)}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '14px',
                    padding: '12px',
                    background: isSelected ? 'var(--color-surface-hover)' : 'var(--color-bg)',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} />
                      <strong>{chain.title}</strong>
                    </div>
                    <button
                      className='btn'
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(chain.id);
                      }}
                      style={{ padding: '4px 8px' }}
                    >
                      <Star
                        size={14}
                        fill={isFavorite ? 'var(--color-primary)' : 'none'}
                        color={isFavorite ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                      />
                      {isFavorite ? t('thoughtChains.favorite.added') : t('thoughtChains.favorite.add')}
                    </button>
                  </div>
                  <div className='muted' style={{ fontSize: '0.85rem' }}>{chain.summary}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <span className='badge badge-outline'>{typeMeta[chain.type].label}</span>
                    <span className='badge badge-outline'>{t('thoughtChains.badges.nodes', { count: metrics.nodeCount })}</span>
                    <span className='badge badge-outline'>{t('thoughtChains.badges.evidence', { count: metrics.evidenceCount })}</span>
                    <span className='badge badge-outline'>{t('thoughtChains.badges.coverage', { percent: metrics.coverage })}</span>
                  </div>
                </div>
              );
            })}
            {filteredChains.length === 0 && (
              <div className='muted'>{t('thoughtChains.emptyList')}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <div className='section-title'>{t('thoughtChains.detailTitle')}</div>
            {selectedChain ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '12px',
                  background: 'var(--color-bg)',
                  display: 'grid',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>{selectedChain.title}</strong>
                      <div className='muted' style={{ fontSize: '0.85rem' }}>
                        {typeMeta[selectedChain.type].label} · {selectedChain.source} · {selectedChain.updatedAt}
                      </div>
                    </div>
                    <button className='btn' onClick={() => toggleFavorite(selectedChain.id)}>
                      <Star
                        size={14}
                        fill={favoriteIds.includes(selectedChain.id) ? 'var(--color-primary)' : 'none'}
                        color={favoriteIds.includes(selectedChain.id) ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                      />
                      {favoriteIds.includes(selectedChain.id)
                        ? t('thoughtChains.favorite.remove')
                        : t('thoughtChains.favorite.addTo')}
                    </button>
                  </div>
                  <div>
                    <div className='muted'>{t('thoughtChains.questionLabel')}</div>
                    <div>{selectedChain.question}</div>
                  </div>
                  <div>
                    <div className='muted'>{t('thoughtChains.answerLabel')}</div>
                    <div>{selectedChain.answer}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: '1.2fr 1.8fr' }}>
                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '14px',
                    padding: '12px',
                    background: 'var(--color-bg)',
                    display: 'grid',
                    gap: '10px',
                  }}>
                    <strong>{t('thoughtChains.structureTitle')}</strong>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {renderNode(selectedChain.root)}
                    </div>
                  </div>

                  <div style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '14px',
                    padding: '12px',
                    background: 'var(--color-bg)',
                    display: 'grid',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{t('thoughtChains.evidenceDetailTitle')}</strong>
                      <span className='badge badge-outline'>
                        {t('thoughtChains.selectedNode', {
                          name: selectedNode?.title ?? t('thoughtChains.selectedNodeFallback'),
                        })}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {selectedNode?.evidence.map((item) => (
                        <div key={item.id} style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: '12px',
                          padding: '10px',
                          background: 'var(--color-surface)',
                          display: 'grid',
                          gap: '6px',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={14} />
                              <strong>{item.docName}</strong>
                            </div>
                            <span className='badge badge-outline'>{t('thoughtChains.score', { score: item.score.toFixed(2) })}</span>
                          </div>
                          <div className='muted'>{item.path}</div>
                          <div>{item.snippet}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <span className='badge badge-outline'>{t('thoughtChains.chunk', { id: item.chunkId })}</span>
                            <span className='badge badge-outline'>{t('thoughtChains.rank', { rank: item.sourceRank })}</span>
                            {item.conflict && <span className='badge badge-danger'>{t('thoughtChains.conflict')}</span>}
                            {item.redundant && <span className='badge badge-warning'>{t('thoughtChains.redundant')}</span>}
                          </div>
                        </div>
                      ))}
                      {(selectedNode?.evidence.length ?? 0) === 0 && (
                        <div className='muted'>{t('thoughtChains.nodeNoEvidence')}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: '14px',
                  padding: '12px',
                  background: 'var(--color-bg)',
                  display: 'grid',
                  gap: '12px',
                }}>
                  <strong>{t('thoughtChains.strategyTitle')}</strong>
                  <div className='grid-3'>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.depth')}</div>
                      <strong>{selectedChain.type === 'longform' ? 4 : 3}</strong>
                    </div>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.topK')}</div>
                      <strong>{selectedChain.type === 'longform' ? 8 : 6}</strong>
                    </div>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.fusion')}</div>
                      <strong>{t('thoughtChains.strategy.fusionLabel')}</strong>
                    </div>
                  </div>
                  <div className='grid-3'>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.coverage')}</div>
                      <strong>{chainMetrics?.coverage ?? 0}%</strong>
                    </div>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.conflictRate')}</div>
                      <strong>{evidenceConflictRate}%</strong>
                    </div>
                    <div>
                      <div className='muted'>{t('thoughtChains.strategy.redundantRate')}</div>
                      <strong>{evidenceRedundantRate}%</strong>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {strategyStages.map((stage) => (
                      <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{stage}</span>
                        <span className='badge badge-success'>{t('status.done')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className='muted'>{t('thoughtChains.emptySelection')}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ThoughtChainManager;
