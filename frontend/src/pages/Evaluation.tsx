import React, { useMemo, useState } from 'react';
import { Download, Play, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EvalReportSummary, EvalRunRequest, EvalSampleReport, getEvaluationReport, runEvaluation as runEvaluationApi } from '../api/backend';

interface EvalTask {
  id: string;
  nameKey: string;
  status: 'idle' | 'running' | 'done';
  duration: string;
}

const toPercent = (value: number) => `${Math.round(value * 100)}%`;

const DEFAULT_EVAL_DATASET: EvalRunRequest = {
  documents: [
    {
      filename: 'eval_doc.txt',
      content: 'The health endpoint returns ok when the service is running. Index builds combine document chunks and embeddings.'
    }
  ],
  samples: [
    {
      sample_id: 'Golden Q&A Set',
      query: 'What does the health endpoint return when running?',
      expected_evidence: ['health endpoint returns ok'],
    },
    {
      sample_id: 'Policy Evidence Bench',
      query: 'What does the index build combine?',
      expected_evidence: ['document chunks and embeddings'],
    },
    {
      sample_id: 'Conflict Stress',
      query: 'Which endpoint indicates service health?',
      expected_evidence: ['health endpoint returns ok'],
    },
  ],
  defaults: { top_k: 5, rerank_k: 20, max_evidence: 5 },
};

const Evaluation: React.FC = () => {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [reportId, setReportId] = useState('');
  const [requestError, setRequestError] = useState('');
  const [summary, setSummary] = useState<EvalReportSummary | null>(null);
  const [samples, setSamples] = useState<EvalSampleReport[]>([]);
  const [tasks, setTasks] = useState<EvalTask[]>([
    { id: 'eval-1', nameKey: 'evaluation.tasks.golden', status: 'idle', duration: '00:00' },
    { id: 'eval-2', nameKey: 'evaluation.tasks.policy', status: 'idle', duration: '00:00' },
    { id: 'eval-3', nameKey: 'evaluation.tasks.conflict', status: 'idle', duration: '00:00' },
  ]);

  const getTaskStatusLabel = (status: EvalTask['status']) => t(`status.${status}`);

  const formatDuration = (latencyMs?: number) => {
    if (!latencyMs || latencyMs <= 0) return '00:00';
    const totalSeconds = Math.max(0, Math.round(latencyMs / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const runEvaluation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRequestError('');
    setTasks((prev) => prev.map((task) => ({ ...task, status: 'running', duration: '00:00' })));
    try {
      const response = await runEvaluationApi(DEFAULT_EVAL_DATASET);
      setReportId(response.report_id);
      const report = await getEvaluationReport(response.report_id).catch(() => null);
      const resolvedSummary = report?.summary ?? response.summary;
      const resolvedSamples = report?.samples ?? [];
      setSummary(resolvedSummary ?? null);
      setSamples(resolvedSamples);
      setTasks((prev) => prev.map((task, idx) => ({
        ...task,
        status: 'done',
        duration: formatDuration(resolvedSamples[idx]?.latency_ms),
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('evaluation.errors.failed');
      setRequestError(message);
      setTasks((prev) => prev.map((task) => ({ ...task, status: 'idle', duration: '00:00' })));
    } finally {
      setIsRunning(false);
    }
  };

  const reportPayload = useMemo(() => ({
    generatedAt: new Date().toISOString(),
    reportId,
    dataset: DEFAULT_EVAL_DATASET,
    summary,
    samples,
    tasks: tasks.map((task) => ({ ...task, name: t(task.nameKey) })),
    version: 'v1.0.0',
  }), [reportId, samples, summary, tasks, t]);

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportJson = () => {
    downloadFile('evaluation-report.json', JSON.stringify(reportPayload, null, 2), 'application/json');
  };

  const exportCsv = () => {
    if (!summary) return;

    const csvEscape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const sampleHeaders = [
      'sample_id',
      'query',
      'top_k',
      'rerank_k',
      'recall',
      'mrr',
      'ndcg',
      'evidence_coverage',
      'latency_ms',
      'expected_evidence_count',
      'matched_evidence_count',
    ] as const;

    const rows: Array<Array<unknown>> = [];
    if (samples.length > 0) {
      rows.push([...sampleHeaders]);
      samples.forEach((sample) => {
        rows.push(sampleHeaders.map((key) => sample[key]));
      });
    } else {
      rows.push(['metric', 'value']);
      rows.push(['sample_count', summary.sample_count]);
      rows.push(['avg_recall', summary.avg_recall]);
      rows.push(['avg_mrr', summary.avg_mrr]);
      rows.push(['avg_ndcg', summary.avg_ndcg]);
      rows.push(['avg_evidence_coverage', summary.avg_evidence_coverage]);
      rows.push(['avg_latency_ms', summary.avg_latency_ms]);
      rows.push(['p95_latency_ms', summary.p95_latency_ms]);
    }

    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    downloadFile('evaluation-report.csv', csv, 'text/csv');
  };

  const formatPercent = (value?: number) => (value === null || value === undefined ? 'N/A' : toPercent(value));
  const formatMs = (value?: number) => (value === null || value === undefined ? 'N/A' : `${Math.round(value)}ms`);
  const canExport = Boolean(summary && reportId);

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-title">{t('evaluation.title')}</div>
            <div className="muted">{t('evaluation.subtitle')}</div>
            {requestError && <div className="muted" style={{ marginTop: '8px' }}>{requestError}</div>}
          </div>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={runEvaluation} disabled={isRunning}>
              <Play size={16} />
              {isRunning ? t('evaluation.running') : t('evaluation.run')}
            </button>
            <button className="btn" onClick={exportJson} disabled={!canExport || isRunning}>
              <Download size={16} />
              {t('evaluation.exportJson')}
            </button>
            <button className="btn" onClick={exportCsv} disabled={!canExport || isRunning}>
              <Download size={16} />
              {t('evaluation.exportCsv')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {tasks.map((task) => {
            const badgeClass = task.status === 'done'
              ? 'badge-success'
              : task.status === 'running'
                ? 'badge-warning'
                : 'badge-outline';
            return (
              <div key={task.id} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={16} />
                  <span>{t(task.nameKey)}</span>
                </div>
                <span className={`badge ${badgeClass}`}>{getTaskStatusLabel(task.status)}</span>
                <span className="muted">{task.duration}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('evaluation.metricsTitle')}</div>
        <div className="grid-3">
          <div>
            <div className="muted">{t('evaluation.metrics.recall')}</div>
            <strong>{formatPercent(summary?.avg_recall)}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.mrr')}</div>
            <strong>{formatPercent(summary?.avg_mrr)}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.ndcg')}</div>
            <strong>{formatPercent(summary?.avg_ndcg)}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.coverage')}</div>
            <strong>{formatPercent(summary?.avg_evidence_coverage)}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.sampleCount')}</div>
            <strong>{summary?.sample_count ?? 'N/A'}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.avgLatency')}</div>
            <strong>{formatMs(summary?.avg_latency_ms)}</strong>
          </div>
          <div>
            <div className="muted">{t('evaluation.metrics.p95Latency')}</div>
            <strong>{formatMs(summary?.p95_latency_ms)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Evaluation;
