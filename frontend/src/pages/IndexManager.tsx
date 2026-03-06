import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Hammer, RefreshCw, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getIndexHistory, getIndexStatus } from '../api/backend';
import { useDocuments } from '../contexts/DocumentsContext';

interface BuildStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

interface BuildRun {
  id: string;
  startedAt: string;
  duration: string;
  docsIndexed: number;
  status: 'success' | 'warning';
  version: string;
}

interface IndexSnapshot {
  version: number;
  status: string;
  build_time: string;
  doc_count: number;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}

const formatTime = (date: Date) =>
  `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

const IndexManager: React.FC = () => {
  const { t } = useTranslation();
  const { documents, triggerIndexBuild } = useDocuments();
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildRuns, setBuildRuns] = useState<BuildRun[]>([]);
  const [indexStatus, setIndexStatus] = useState<IndexSnapshot | null>(null);
  const [buildError, setBuildError] = useState('');

  const activeDocs = documents.filter((doc) => doc.status !== 'ARCHIVED');
  const readyDocs = activeDocs.filter((doc) => doc.status === 'READY').length;
  const progressPercent = activeDocs.length === 0 ? 0 : Math.round((readyDocs / activeDocs.length) * 100);

  const baseSteps = useMemo<BuildStep[]>(() => [
    { label: t('index.steps.collect'), status: 'pending' },
    { label: t('index.steps.chunk'), status: 'pending' },
    { label: t('index.steps.merge'), status: 'pending' },
    { label: t('index.steps.publish'), status: 'pending' },
  ], [t]);

  const getStepStatusLabel = (status: BuildStep['status']) => t(`status.${status}`);
  const getRunStatusLabel = (status: BuildRun['status']) =>
    status === 'success' ? t('status.success') : t('status.warning');

  const indexVersion = useMemo(() => {
    if (indexStatus) return `v${indexStatus.version}.0`;
    const lastRun = buildRuns[0];
    return lastRun?.version ?? 'v0.0.0';
  }, [buildRuns, indexStatus]);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await getIndexStatus();
      const snapshot = response.index ? {
        version: response.index.version,
        status: response.index.status,
        build_time: response.index.build_time,
        doc_count: response.index.doc_count,
        started_at: response.index.started_at,
        finished_at: response.index.finished_at,
        duration_ms: response.index.duration_ms,
      } : null;
      setIndexStatus(snapshot);
      return snapshot;
    } catch (error) {
      console.error('Failed to fetch index status', error);
      return null;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await getIndexHistory();
      const runs = (response.history || []).map((item) => {
        const startedAt = item.started_at || item.build_time;
        const durationMs = typeof item.duration_ms === 'number' ? item.duration_ms : 0;
        return {
          id: item.index_id,
          startedAt: startedAt ? formatTime(new Date(startedAt)) : '—',
          duration: durationMs ? `${Math.max(1, Math.round(durationMs / 1000))}s` : '—',
          docsIndexed: item.doc_count,
          status: item.status === 'READY' ? 'success' : 'warning',
          version: `v${item.version}.0`,
        } satisfies BuildRun;
      });
      setBuildRuns(runs);
      return runs;
    } catch (error) {
      console.error('Failed to fetch index history', error);
      setBuildRuns([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    void refreshHistory();
  }, [refreshHistory, refreshStatus]);

  const steps = useMemo<BuildStep[]>(() => {
    if (isBuilding) {
      return baseSteps.map((step, idx) => ({
        ...step,
        status: (idx === 0 ? 'active' : 'pending') as BuildStep['status'],
      }));
    }
    if (indexStatus?.status === 'READY') {
      return baseSteps.map((step) => ({ ...step, status: 'done' as BuildStep['status'] }));
    }
    return baseSteps;
  }, [baseSteps, isBuilding, indexStatus]);

  const handleBuild = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildError('');
    try {
      await triggerIndexBuild();
      await refreshStatus();
      await refreshHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.requestFailed');
      setBuildError(message);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className="section-title">{t('index.overviewTitle')}</div>
            <div className="muted">
              {t('index.versionLine', { version: indexVersion, ready: readyDocs, total: activeDocs.length })}
            </div>
            <div className="muted" style={{ marginTop: '6px' }}>
              {indexStatus
                ? t('index.statusLine', { status: indexStatus.status, count: indexStatus.doc_count })
                : t('index.notBuilt')}
            </div>
            {buildError && (
              <div className="muted" style={{ marginTop: '6px', color: 'var(--color-danger)' }}>
                {buildError}
              </div>
            )}
          </div>
          <div className="toolbar">
            <button className="btn" onClick={() => void refreshStatus()}>
              <RefreshCw size={16} />
              {t('index.refresh')}
            </button>
            <button className="btn btn-primary" onClick={() => void handleBuild()} disabled={isBuilding}>
              <Hammer size={16} />
              {isBuilding ? t('index.building') : t('index.build')}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <div style={{ height: '8px', background: 'var(--color-surface-hover)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.85rem' }} className="muted">
            {t('index.coverage', { percent: progressPercent })}
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('index.stepsTitle')}</div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {steps.map((step) => {
            const statusColor = step.status === 'done'
              ? 'badge-success'
              : step.status === 'active'
                ? 'badge-warning'
                : 'badge-outline';
            return (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{step.label}</span>
                <span className={`badge ${statusColor}`}>{getStepStatusLabel(step.status)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('index.recentRuns')}</div>
        {buildRuns.length === 0 ? (
          <div className="muted">{t('index.noRuns')}</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {buildRuns.map((run) => (
              <div key={run.id} style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Database size={16} />
                  <span>{run.version}</span>
                </div>
                <div className="muted"><Clock size={14} style={{ marginRight: '6px' }} />{run.startedAt}</div>
                <div className="muted">{t('index.runDuration', { duration: run.duration })}</div>
                <div className="muted">{t('index.runDocs', { count: run.docsIndexed })}</div>
                <span className={`badge ${run.status === 'success' ? 'badge-success' : 'badge-warning'}`}>
                  {getRunStatusLabel(run.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default IndexManager;
