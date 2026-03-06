import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { queryQA, submitFeedback } from '../api/backend';
import { useConfirm } from '../contexts/ConfirmContext';
import { useDocuments } from '../contexts/DocumentsContext';
import { useModelConfig } from '../contexts/ModelConfigContext';

interface EvidenceCard {
  id: string;
  docId?: string;
  docName: string;
  chunkId: string;
  score: number;
  path: string;
  sourceRank: number;
  conflict: boolean;
  redundant: boolean;
  snippet: string;
}

interface FeedbackRecord {
  id: string;
  answerId: string;
  score: number;
  comment: string;
  uncertain: boolean;
  conflict: boolean;
  evidenceIds: string[];
  createdAt: string;
}

type RunState = 'idle' | 'submitting' | 'completed' | 'failed';

const QAWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useConfirm();
  const { documents } = useDocuments();
  const {
    selectedModel,
    setSelectedModel,
    availableModels,
    enableThinking,
    setEnableThinking,
    supportsThinking,
    enableTuning,
    setEnableTuning,
  } = useModelConfig();

  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [rerankK, setRerankK] = useState(20);
  const [useStructurePrior, setUseStructurePrior] = useState(true);
  const [runState, setRunState] = useState<RunState>('idle');
  const [requestError, setRequestError] = useState('');
  const [answerId, setAnswerId] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<EvidenceCard[]>([]);
  const [verifyStatus, setVerifyStatus] = useState('');
  const [fallbackReason, setFallbackReason] = useState('');
  const [coarseSections, setCoarseSections] = useState<string[]>([]);
  const [graphSummary, setGraphSummary] = useState({ nodes: 0, edges: 0 });
  const [resultMode, setResultMode] = useState<'llm' | 'fallback_evidence' | 'memory'>('llm');

  const [feedbackScore, setFeedbackScore] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackUncertain, setFeedbackUncertain] = useState(false);
  const [feedbackConflict, setFeedbackConflict] = useState(false);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackRecord[]>([]);

  const docNameMap = useMemo(() => new Map(documents.map((doc) => [doc.id, doc.name])), [documents]);
  const evidenceMap = useMemo(() => new Map(evidence.map((item) => [item.id, item])), [evidence]);

  const buildSnippet = (text: string) => {
    if (!text) return t('common.empty');
    if (text.length <= 160) return text;
    return `${text.slice(0, 160)}...`;
  };

  const getRunStateLabel = () => {
    if (runState === 'submitting') return t('qa.runState.submitting');
    if (runState === 'completed') return t('qa.runState.completed');
    if (runState === 'failed') return t('qa.runState.failed');
    return t('status.idle');
  };

  const getResultModeLabel = () => {
    if (resultMode === 'fallback_evidence') return t('qa.resultMode.fallback_evidence');
    if (resultMode === 'memory') return t('qa.resultMode.memory');
    return t('qa.resultMode.llm');
  };

  const runQuery = async () => {
    if (!query.trim() || runState === 'submitting') return;
    setRunState('submitting');
    setRequestError('');
    setAnswerId('');
    setAnswer('');
    setCitations([]);
    setEvidence([]);
    setVerifyStatus('');
    setFallbackReason('');
    setCoarseSections([]);
    setGraphSummary({ nodes: 0, edges: 0 });
    setResultMode('llm');

    try {
      const response = await queryQA({
        query,
        top_k: topK,
        rerank_k: rerankK,
        max_evidence: Math.max(1, Math.min(topK, 20)),
        structure_prior_enabled: useStructurePrior,
      });
      const nextEvidence = (response.evidence ?? []).map((item, index) => {
        const chunkId = String(item.chunk_id ?? item.id ?? `chunk-${index + 1}`);
        const docId = typeof item.doc_id === 'string' ? item.doc_id : '';
        const docName = docNameMap.get(docId) ?? (docId || t('common.unknownDocument'));
        const rawText = String(item.snippet ?? item.text ?? '');
        return {
          id: chunkId,
          docId,
          docName,
          chunkId,
          score: Number(item.score ?? 0),
          path: item.path ? String(item.path) : t('common.empty'),
          sourceRank: Number(item.source_rank ?? index + 1),
          conflict: Boolean(item.conflict_flag),
          redundant: Boolean(item.redundant_flag),
          snippet: buildSnippet(rawText),
        } satisfies EvidenceCard;
      });

      const nextCitations = (response.citations ?? []).map((item) => {
        const docId = item.doc_id ?? '';
        const docName = docNameMap.get(docId) ?? (docId || t('common.unknownDocument'));
        const chunkId = item.chunk_id ?? 'chunk';
        return `${docName} · ${chunkId}`;
      });

      setAnswerId(response.answer_id ?? '');
      setEvidence(nextEvidence);
      setCitations(nextCitations);
      setAnswer(response.answer ? String(response.answer) : t('qa.errors.noAnswer'));
      setVerifyStatus(response.verify_status ?? '');
      setFallbackReason(response.fallback_reason ?? '');
      setCoarseSections(
        (response.coarse_sections ?? []).map((item) => item.path || item.section_id || item.chunk_id || t('common.unknown'))
      );
      setGraphSummary({
        nodes: response.graph?.nodes?.length ?? 0,
        edges: response.graph?.edges?.length ?? 0,
      });
      setResultMode(response.result_mode ?? 'llm');
      setRunState('completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : t('qa.errors.queryFailed');
      setRequestError(message);
      setRunState('failed');
    }
  };

  const copyAnswer = async () => {
    if (!answer) return;
    try {
      await navigator.clipboard.writeText(answer);
      await confirm({
        title: t('qa.confirm.copiedTitle'),
        message: t('qa.confirm.copiedMessage'),
        type: 'success',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } catch {
      await confirm({
        title: t('qa.confirm.copyFailedTitle'),
        message: t('qa.confirm.copyFailedMessage'),
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    }
  };

  const exportResult = () => {
    if (!answer) return;
    const payload = {
      answerId,
      query,
      answer,
      citations,
      evidence,
      graphSummary,
      verifyStatus,
      fallbackReason,
      coarseSections,
      resultMode,
      model: selectedModel,
      parameters: { topK, rerankK, useStructurePrior, enableThinking, enableTuning },
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'qa-result.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const toggleEvidence = (id: string) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const submitFeedbackRecord = async () => {
    if (!answer || !answerId) return;
    if (selectedEvidenceIds.length === 0) {
      await confirm({
        title: t('qa.confirm.missingEvidenceTitle'),
        message: t('qa.confirm.missingEvidenceMessage'),
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
      return;
    }

    const primary = evidenceMap.get(selectedEvidenceIds[0]);
    const nodeId = primary?.chunkId || selectedEvidenceIds[0];
    try {
      await submitFeedback({
        answer_id: answerId,
        node_id: nodeId,
        score: feedbackScore,
        comment: feedbackComment,
        doc_id: primary?.docId,
        uncertain: feedbackUncertain,
        conflict: feedbackConflict,
        evidence_ids: selectedEvidenceIds,
      });

      const record: FeedbackRecord = {
        id: `fb-${Date.now()}`,
        answerId,
        score: feedbackScore,
        comment: feedbackComment,
        uncertain: feedbackUncertain,
        conflict: feedbackConflict,
        evidenceIds: selectedEvidenceIds,
        createdAt: new Date().toLocaleString(),
      };
      setFeedbackHistory((prev) => [record, ...prev]);
      setFeedbackScore(0);
      setFeedbackComment('');
      setFeedbackUncertain(false);
      setFeedbackConflict(false);
      setSelectedEvidenceIds([]);
      await confirm({
        title: t('qa.confirm.feedbackSubmittedTitle'),
        message: t('qa.confirm.feedbackSubmittedMessage'),
        type: 'success',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } catch (error) {
      await confirm({
        title: t('qa.confirm.feedbackFailedTitle'),
        message: error instanceof Error ? error.message : t('qa.confirm.feedbackFailedMessage'),
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    }
  };

  const canRun = query.trim().length > 0 && runState !== 'submitting';
  const badgeClass = runState === 'completed'
    ? 'badge-success'
    : runState === 'failed'
      ? 'badge-danger'
      : runState === 'submitting'
        ? 'badge-warning'
        : 'badge-outline';

  return (
    <div className="page">
      <section className="section-card">
        <div className="section-title">{t('qa.title')}</div>
        <div className="grid-2" style={{ marginTop: '16px' }}>
          <div>
            <label className="muted">{t('qa.placeholder')}</label>
            <textarea
              className="input"
              rows={4}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('qa.placeholder')}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div className="grid-3">
              <div>
                <label className="muted">{t('qa.topK')}</label>
                <input className="input" type="number" min={1} max={20} value={topK} onChange={(event) => setTopK(Number(event.target.value) || 1)} />
              </div>
              <div>
                <label className="muted">{t('qa.rerankK')}</label>
                <input className="input" type="number" min={1} max={100} value={rerankK} onChange={(event) => setRerankK(Number(event.target.value) || 1)} />
              </div>
              <div>
                <label className="muted">{t('qa.structurePrior')}</label>
                <select className="input" value={useStructurePrior ? 'on' : 'off'} onChange={(event) => setUseStructurePrior(event.target.value === 'on')}>
                  <option value="on">{t('common.enabled')}</option>
                  <option value="off">{t('common.disabled')}</option>
                </select>
              </div>
            </div>
            <div className="grid-3">
              <div>
                <label className="muted">{t('qa.model')}</label>
                <select className="input" value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                  {availableModels.length > 0 ? availableModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  )) : <option value="">{t('common.empty')}</option>}
                </select>
              </div>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={enableThinking} onChange={(event) => setEnableThinking(event.target.checked)} disabled={!supportsThinking} />
                {t('qa.thinking')}
              </label>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={enableTuning} onChange={(event) => setEnableTuning(event.target.checked)} />
                {t('qa.tuning')}
              </label>
            </div>
            <div className="toolbar">
              <button className="btn btn-primary" onClick={() => void runQuery()} disabled={!canRun}>
                <Play size={16} />
                {runState === 'submitting' ? t('qa.running') : t('qa.run')}
              </button>
              <button className="btn" onClick={() => void copyAnswer()} disabled={!answer}>
                <Copy size={16} />
                {t('qa.copyAnswer')}
              </button>
              <button className="btn" onClick={exportResult} disabled={!answer}>
                <Download size={16} />
                {t('qa.exportResult')}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="section-title">{t('qa.answerTitle')}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className={`badge ${badgeClass}`}>{getRunStateLabel()}</span>
            <span className="badge badge-outline">{getResultModeLabel()}</span>
            {verifyStatus && <span className="badge badge-outline">{t('qa.verifyStatus')}: {verifyStatus}</span>}
          </div>
        </div>
        {requestError && <div className="muted" style={{ marginTop: '8px', color: 'var(--color-danger)' }}>{requestError}</div>}
        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          <div>
            <div className="muted">{t('qa.answerLabel')}</div>
            <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>{answer || t('qa.noAnswerHint')}</div>
          </div>
          <div className="grid-3">
            <div>
              <div className="muted">{t('qa.graph')}</div>
              <strong>{t('qa.graphSummary', graphSummary)}</strong>
            </div>
            <div>
              <div className="muted">{t('qa.fallbackReason')}</div>
              <strong>{fallbackReason || t('common.none')}</strong>
            </div>
            <div>
              <div className="muted">{t('qa.answerId')}</div>
              <strong>{answerId || t('common.none')}</strong>
            </div>
          </div>
          <div>
            <div className="muted">{t('qa.citations')}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {citations.length > 0 ? citations.map((item) => (
                <span key={item} className="badge badge-outline">{item}</span>
              )) : <span className="muted">{t('qa.noCitations')}</span>}
            </div>
          </div>
          <div>
            <div className="muted">{t('qa.coarseSections')}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {coarseSections.length > 0 ? coarseSections.map((item) => (
                <span key={item} className="badge badge-outline">{item}</span>
              )) : <span className="muted">{t('qa.noCoarseSections')}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('qa.evidenceList')}</div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {evidence.map((item) => (
            <div key={item.id} style={{
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '12px',
              background: 'var(--color-bg)',
              display: 'grid',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{item.docName}</strong>
                <span className="badge badge-outline">{t('qa.evidenceScore', { score: item.score.toFixed(2) })}</span>
              </div>
              <div className="muted">{item.path}</div>
              <div>{item.snippet}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge badge-outline">{t('qa.rank', { rank: item.sourceRank })}</span>
                {item.conflict && <span className="badge badge-danger">{t('qa.conflict')}</span>}
                {item.redundant && <span className="badge badge-warning">{t('qa.redundant')}</span>}
                <button className="btn" onClick={() => toggleEvidence(item.id)}>
                  {selectedEvidenceIds.includes(item.id) ? t('qa.selected') : t('qa.select')}
                </button>
              </div>
            </div>
          ))}
          {evidence.length === 0 && <div className="muted">{t('qa.evidenceEmpty')}</div>}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('qa.feedbackTitle')}</div>
        <div className="grid-2" style={{ marginTop: '16px' }}>
          <div>
            <label className="muted">{t('qa.feedbackScore')}</label>
            <input className="input" type="number" min={0} max={5} value={feedbackScore} onChange={(event) => setFeedbackScore(Number(event.target.value))} />
          </div>
          <div>
            <label className="muted">{t('qa.feedbackFlags')}</label>
            <div className="toolbar">
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={feedbackUncertain} onChange={(event) => setFeedbackUncertain(event.target.checked)} />
                {t('qa.feedbackUncertain')}
              </label>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" checked={feedbackConflict} onChange={(event) => setFeedbackConflict(event.target.checked)} />
                {t('qa.feedbackConflict')}
              </label>
            </div>
          </div>
        </div>
        <textarea
          className="input"
          placeholder={t('qa.feedbackPlaceholder')}
          value={feedbackComment}
          onChange={(event) => setFeedbackComment(event.target.value)}
          rows={3}
          style={{ marginTop: '12px', resize: 'vertical' }}
        />
        <div className="muted" style={{ marginTop: '8px' }}>
          {t('qa.feedbackDisclaimer')}
        </div>
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => void submitFeedbackRecord()} disabled={!answer || !answerId}>
            <CheckCircle2 size={16} />
            {t('qa.feedbackSubmit')}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('qa.feedbackHistoryTitle')}</div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {feedbackHistory.map((record) => (
            <div key={record.id} style={{
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '12px',
              background: 'var(--color-bg)',
              display: 'grid',
              gap: '6px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{t('qa.evidenceScore', { score: record.score })}</strong>
                <span className="muted">{record.createdAt}</span>
              </div>
              <div className="muted">{t('qa.answerId')}: {record.answerId}</div>
              <div className="muted">{t('qa.feedbackHistoryEvidence', { count: record.evidenceIds.length })}</div>
              <div>{record.comment || t('qa.feedbackHistoryNoComment')}</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {record.uncertain && <span className="badge badge-warning">{t('qa.feedbackUncertain')}</span>}
                {record.conflict && <span className="badge badge-danger">{t('qa.feedbackConflict')}</span>}
              </div>
            </div>
          ))}
          {feedbackHistory.length === 0 && <div className="muted">{t('qa.feedbackHistoryEmpty')}</div>}
        </div>
      </section>
    </div>
  );
};

export default QAWorkbench;
