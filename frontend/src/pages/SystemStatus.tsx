import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TaskInfo, getHealth, getIndexStatus, getReady, getTasks } from '../api/backend';

interface ServiceStatus {
  nameKey: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
}

interface QueueItem {
  id: string;
  taskKey: string;
  status: 'queued' | 'running' | 'done';
  eta: string;
}

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString();
};

const mapTaskStatus = (status?: string): QueueItem['status'] => {
  if (status === 'RUNNING') return 'running';
  if (status === 'SUCCESS' || status === 'FAILED') return 'done';
  return 'queued';
};

const mapTaskLabel = (info: TaskInfo) => {
  if (info.error) return 'system.tasks.failed';
  if (info.result) return 'system.tasks.completed';
  return 'system.tasks.background';
};

const SystemStatus: React.FC = () => {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [versionInfo, setVersionInfo] = useState({
    frontend: 'v1.0.0',
    backend: 'unknown',
    lastDeploy: '—',
  });

  const getServiceStatusLabel = (status: ServiceStatus['status']) => t(`status.${status}`);
  const getQueueStatusLabel = (status: QueueItem['status']) => t(`status.${status}`);

  const refresh = React.useCallback(async () => {
    const measure = async <T,>(fn: () => Promise<T>) => {
      const start = performance.now();
      try {
        const data = await fn();
        return { data, latency: Math.round(performance.now() - start), error: null as unknown };
      } catch (error) {
        return { data: null as T | null, latency: Math.round(performance.now() - start), error };
      }
    };

    const [health, ready, index, tasks] = await Promise.all([
      measure(getHealth),
      measure(getReady),
      measure(getIndexStatus),
      measure(getTasks),
    ]);

    const healthStatus: ServiceStatus = {
      nameKey: 'system.services.health',
      endpoint: '/health',
      status: health.error ? 'down' : 'healthy',
      latency: health.latency,
    };

    const readyStatus: ServiceStatus = {
      nameKey: 'system.services.readiness',
      endpoint: '/ready',
      status: ready.error ? 'down' : (ready.data?.ready ? 'healthy' : 'degraded'),
      latency: ready.latency,
    };

    const indexReady = index.data?.index?.status === 'READY';
    const indexStatus: ServiceStatus = {
      nameKey: 'system.services.index',
      endpoint: '/api/index/status',
      status: index.error ? 'down' : (indexReady ? 'healthy' : 'degraded'),
      latency: index.latency,
    };

    const qaStatus: ServiceStatus = {
      nameKey: 'system.services.qa',
      endpoint: '/api/qa/query',
      status: health.error || ready.error || index.error ? 'down' : (indexReady ? 'healthy' : 'degraded'),
      latency: Math.round((ready.latency + index.latency) / 2),
    };

    setServices([healthStatus, readyStatus, indexStatus, qaStatus]);
    const taskItems = tasks.data?.tasks
      ? Object.values(tasks.data.tasks).map((info) => ({
        id: info.task_id,
        taskKey: mapTaskLabel(info),
        status: mapTaskStatus(info.status),
        eta: formatTime(info.finished_at || info.started_at || info.created_at),
      }))
      : [];
    setQueue(taskItems);
    setVersionInfo((prev) => ({
      ...prev,
      backend: String(health.data?.version || ready.data?.version || 'unknown'),
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className="section-title">{t('system.title')}</div>
            <div className="muted">{t('system.subtitle')}</div>
          </div>
          <button className="btn" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            {t('system.refresh')}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
          {services.map((svc) => {
            const badgeClass = svc.status === 'healthy'
              ? 'badge-success'
              : svc.status === 'degraded'
                ? 'badge-warning'
                : 'badge-danger';
            const Icon = svc.status === 'healthy' ? CheckCircle2 : AlertTriangle;
            return (
              <div key={svc.nameKey} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 1fr',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={16} />
                  <span>{t(svc.nameKey)}</span>
                </div>
                <div className="muted">{svc.endpoint}</div>
                <div className="muted">{svc.latency} ms</div>
                <span className={`badge ${badgeClass}`}>{getServiceStatusLabel(svc.status)}</span>
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="muted">{t('system.noService')}</div>
          )}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('system.queueTitle')}</div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {queue.map((item) => {
            const badgeClass = item.status === 'done'
              ? 'badge-success'
              : item.status === 'running'
                ? 'badge-warning'
                : 'badge-outline';
            return (
              <div key={item.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr 1fr 1fr',
                gap: '12px',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)'
              }}>
                <div>{item.id}</div>
                <div>{t(item.taskKey)}</div>
                <span className={`badge ${badgeClass}`}>{getQueueStatusLabel(item.status)}</span>
                <div className="muted">{t('system.eta', { time: item.eta })}</div>
              </div>
            );
          })}
          {queue.length === 0 && (
            <div className="muted">{t('system.noQueue')}</div>
          )}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('system.versionTitle')}</div>
        <div className="grid-3">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="muted">{t('system.version.frontend')}</span>
            <strong>{versionInfo.frontend}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="muted">{t('system.version.backend')}</span>
            <strong>{versionInfo.backend}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="muted">{t('system.version.lastDeploy')}</span>
            <strong>{versionInfo.lastDeploy}</strong>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SystemStatus;

