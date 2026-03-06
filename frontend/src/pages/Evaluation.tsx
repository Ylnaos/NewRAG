import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Download, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  EvalReportListEntry,
  EvalReportSummary,
  EvalRunRequest,
  EvalSampleReport,
  getEvaluationReport,
  listEvaluationReports,
  runEvaluation as runEvaluationApi,
} from '../api/backend';

const toPercent = (value: number) => `${Math.round(value * 100)}%`;

const DEFAULT_EVAL_DATASET: EvalRunRequest = {
  documents: [
    {
      filename: 'eval_doc.txt',
      content: 'The health endpoint returns ok when the service is running. Index builds combine document chunks and embeddings.',
    },
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
  ],
  defaults: { top_k: 5, rerank_k: 20, max_evidence: 5 },
};

const Evaluation: React.FC = () => {
  const { t } = useTranslation();
  const [datasetText, setDatasetText] = useState(() => JSON.stringify(DEFAULT_EVAL_DATASET, null, 2));
  const [isRunning, setIsRunning] = useState(false);
  const [reportId, setReportId] = useState('');
  const [requestError, setRequestError] = useState('');
  const [summary, setSummary] = useState<EvalReportSummary | null>(null);
  const [samples, setSamples] = useState<EvalSampleReport[]>([]);
  const [reports, setReports] = useState<EvalReportListEntry[]>([]);

  const loadReports = useCallback(async () => {
    try {
      const response = await listEvaluationReports();
      setReports(response.reports ?? []);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t('evaluation.errors.failed'));
    }
  }, [t]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const parseDataset = useCallback((): EvalRunRequest => JSON.parse(datasetText) as EvalRunRequest, [datasetText]);

  const runEvaluation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRequestError('');
    try {
      const dataset = parseDataset();
      const response = await runEvaluationApi(dataset);
      setReportId(response.report_id);
      const report = await getEvaluationReport(response.report_id).catch(() => null);
      setSummary(report?.summary ?? response.summary);
      setSamples(report?.samples ?? []);
      await loadReports();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('evaluation.errors.failed');
      setRequestError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const openReport = async (nextReportId: string) => {
    setRequestError('');
    try {
      const report = await getEvaluationReport(nextReportId);
      setReportId(nextReportId);
      setSummary(report.summary ?? null);
      setSamples(report.samples ?? []);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t('evaluation.errors.failed'));
    }
  };

  const buildReportPayload = () => ({
    generatedAt: new Date().toISOString(),
    reportId,
    dataset: (() => {
      try {
        return parseDataset();
      } catch {
        return datasetText;
      }
    })(),
    summary,
    samples,
  });

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportJson = () => {
    downloadFile('evaluation-report.json', JSON.stringify(buildReportPayload(), null, 2), 'application/json');
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

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-title">{t('evaluation.title')}</div>
            <div className="muted">{t('evaluation.subtitle')}</div>
            {requestError && <div className="muted" style={{ marginTop: '8px', color: 'var(--color-danger)' }}>{requestError}</div>}
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => setDatasetText(JSON.stringify(DEFAULT_EVAL_DATASET, null, 2))}>
              <ClipboardList size={16} />
              {t('evaluation.loadPreset')}
            </button>
            <button className="btn" onClick={() => {
              try {
                setDatasetText(JSON.stringify(parseDataset(), null, 2));
                setRequestError('');
              } catch (error) {
                setRequestError(error instanceof Error ? error.message : t('evaluation.errors.failed'));
              }
            }}>
              <RefreshCw size={16} />
              {t('evaluation.formatJson')}
            </button>
            <button className="btn btn-primary" onClick={() => void runEvaluation()} disabled={isRunning}>
              <Play size={16} />
              {isRunning ? t('evaluation.running') : t('evaluation.run')}
            </button>
            <button className="btn" onClick={exportJson} disabled={!summary && !reportId}>
              <Download size={16} />
              {t('evaluation.exportJson')}
            </button>
            <button className="btn" onClick={exportCsv} disabled={!summary || isRunning}>
              <Download size={16} />
              {t('evaluation.exportCsv')}
            </button>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('evaluation.datasetTitle')}</div>
        <div className="muted" style={{ marginBottom: '12px' }}>{t('evaluation.datasetHint')}</div>
        <textarea
          className="input"
          value={datasetText}
          onChange={(event) => setDatasetText(event.target.value)}
          rows={18}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace' }}
        />
      </section>

      <section className="section-card">
        <div className="section-title">{t('evaluation.metricsTitle')}</div>
        <div className="grid-3" style={{ marginTop: '12px' }}>
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
          <div>
            <div className="muted">{t('evaluation.reportId')}</div>
            <strong>{reportId || 'N/A'}</strong>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('evaluation.sampleResults')}</div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          {samples.map((sample) => (
            <div key={sample.sample_id} style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px', background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <strong>{sample.sample_id}</strong>
                <span className="badge badge-outline">{formatMs(sample.latency_ms)}</span>
              </div>
              <div className="muted" style={{ marginTop: '6px' }}>{sample.query}</div>
              <div className="grid-3" style={{ marginTop: '12px' }}>
                <div><span className="muted">Recall</span><br /><strong>{formatPercent(sample.recall)}</strong></div>
                <div><span className="muted">MRR</span><br /><strong>{formatPercent(sample.mrr)}</strong></div>
                <div><span className="muted">NDCG</span><br /><strong>{formatPercent(sample.ndcg)}</strong></div>
              </div>
            </div>
          ))}
          {samples.length === 0 && <div className="muted">{t('evaluation.noSamples')}</div>}
        </div>
      </section>

      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="section-title">{t('evaluation.reportHistory')}</div>
          <button className="btn" onClick={() => void loadReports()}>
            <RefreshCw size={16} />
            {t('evaluation.refreshReports')}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          {reports.map((report) => (
            <button
              key={report.report_id}
              className="btn"
              style={{ justifyContent: 'space-between' }}
              onClick={() => void openReport(report.report_id)}
            >
              <span>{report.report_id}</span>
              <span className="muted">{report.created_at ? new Date(report.created_at).toLocaleString() : t('common.empty')}</span>
            </button>
          ))}
          {reports.length === 0 && <div className="muted">{t('evaluation.noReports')}</div>}
        </div>
      </section>
    </div>
  );
};

export default Evaluation;