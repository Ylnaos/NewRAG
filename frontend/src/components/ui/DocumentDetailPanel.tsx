import React from 'react';
import { motion } from 'framer-motion';
import { Database, FileText, Bookmark, Target, Eye, ArrowUpRight, Sliders } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ChainNode {
    id: string;
    label: string;
    type: 'document' | 'concept';
    metadata: {
        dbName: string;
        fileName: string;
        reason: string;
        page: number;
        relevance: number;
        nodeInfo: string;
        snippet: string;
    };
}

interface DocumentDetailPanelProps {
    node: ChainNode | null;
    enableTuning: boolean;
    onWeightChange: (newWeight: number) => void;
    onPreview: () => void;
    onJump: () => void;
}

export const DocumentDetailPanel: React.FC<DocumentDetailPanelProps> = ({
    node,
    enableTuning,
    onWeightChange,
    onPreview,
    onJump
}) => {
    const { t } = useTranslation();
    if (!node) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'var(--color-text-muted)',
                gap: '12px',
                padding: '24px',
                textAlign: 'center'
            }}>
                <Target size={48} opacity={0.2} />
                <p>{t('detailPanel.empty')}</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            key={node.id}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                padding: '24px',
                height: '100%',
                overflowY: 'auto'
            }}
        >
            {/* Header / Document Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{
                        padding: '10px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary)'
                    }}>
                        <FileText size={24} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.metadata.fileName}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            <Database size={12} />
                            <span>{node.metadata.dbName}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onPreview}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}
                    >
                        <Eye size={14} /> {t('detailPanel.preview')}
                    </button>
                    <button
                        onClick={onJump}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 500
                        }}
                    >
                        <ArrowUpRight size={14} /> {t('detailPanel.jump')}
                    </button>
                </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />

            {/* Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Reason */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('detailPanel.reason')}
                    </label>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
                        {node.metadata.reason}
                    </p>
                </div>

                {/* Location */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('detailPanel.location')}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem' }}>{t('common.page', { page: node.metadata.page })}</span>
                        <button
                            onClick={onPreview}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-primary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                textDecoration: 'underline'
                            }}
                        >
                            {t('detailPanel.view')}
                        </button>
                    </div>
                </div>

                {/* Node Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {t('detailPanel.nodeInfo')}
                    </label>
                    <div style={{ padding: '12px', backgroundColor: 'var(--color-bg)', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {node.metadata.nodeInfo}
                    </div>
                </div>

                {/* Relevance / Tuning */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bookmark size={14} /> {t('detailPanel.relevance')}
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: node.metadata.relevance > 0.7 ? '#10b981' : (node.metadata.relevance > 0.4 ? '#f59e0b' : '#ef4444')
                        }}>
                            {(node.metadata.relevance * 100).toFixed(0)}%
                        </div>
                        {enableTuning && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={node.metadata.relevance}
                                    onChange={(e) => onWeightChange(parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Sliders size={10} /> {t('detailPanel.tuningEnabled')}
                                </span>
                            </div>
                        )}
                    </div>
                    {!enableTuning && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {t('detailPanel.tuningHint')}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
