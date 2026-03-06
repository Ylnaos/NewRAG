import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Database, ShieldCheck, Activity } from 'lucide-react';
import { useDocuments } from '../../contexts/DocumentsContext';

export const TopBar: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { documents, cacheAgeMs, cacheStale } = useDocuments();

  const title = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/docs')) return t('nav.docs');
    if (path.startsWith('/chat')) return t('nav.chat');
    if (path.startsWith('/qa')) return t('nav.qa');
    if (path.startsWith('/index')) return t('nav.index');
    if (path.startsWith('/graph')) return t('nav.graph');
    if (path.startsWith('/chains')) return t('nav.chains');
    if (path.startsWith('/eval')) return t('nav.eval');
    if (path.startsWith('/status')) return t('nav.status');
    if (path.startsWith('/settings')) return t('nav.settings');
    return t('nav.qa');
  }, [location.pathname, t]);

  const activeDocs = documents.filter((doc) => doc.status !== 'ARCHIVED').length;
  const readyDocs = documents.filter((doc) => doc.status === 'READY').length;
  const indexReady = activeDocs > 0 && readyDocs === activeDocs;

  const cacheAgeMin = Math.floor(cacheAgeMs / 60000);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-bg)',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="title-font" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
          {title}
        </div>
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {t('topbar.subtitle')}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span className={`badge ${indexReady ? 'badge-success' : 'badge-warning'}`}>
          <Database size={14} />
          {indexReady ? t('topbar.indexReady') : t('topbar.indexBuilding')}
        </span>
        <span className={`badge ${cacheStale ? 'badge-warning' : 'badge-success'}`}>
          <Activity size={14} />
          {t('topbar.cache', {
            state: cacheStale ? t('topbar.cacheStale') : t('topbar.cacheFresh'),
            minutes: cacheAgeMin,
          })}
        </span>
        <span className="badge badge-outline">
          <ShieldCheck size={14} />
          {t('topbar.docsReady', { ready: readyDocs, total: activeDocs })}
        </span>
      </div>
    </div>
  );
};
