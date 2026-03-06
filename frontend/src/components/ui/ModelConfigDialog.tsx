import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Sliders, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModelName } from '../../contexts/ModelConfigContext';

interface ModelConfigDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedModel: ModelName;
    onModelChange: (model: ModelName) => void;
    availableModels?: ModelName[];
    enableTuning: boolean;
    onTuningChange: (enabled: boolean) => void;
    enableThinking: boolean;
    onThinkingChange: (enabled: boolean) => void;
    supportsThinking: boolean;
}

export const ModelConfigDialog: React.FC<ModelConfigDialogProps> = ({
    isOpen,
    onClose,
    selectedModel,
    onModelChange,
    availableModels = [],
    enableTuning,
    onTuningChange,
    enableThinking,
    onThinkingChange,
    supportsThinking
}) => {
    const { t } = useTranslation();
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            zIndex: 200 // Higher than EvidenceGraphModal
                        }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            width: '400px',
                            backgroundColor: 'var(--color-surface)',
                            borderRadius: '16px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                            zIndex: 201,
                            padding: '24px',
                            border: '1px solid var(--color-border)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                                    <Settings size={20} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{t('modelConfig.title')}</h3>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Model Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('modelConfig.modelSection')}</label>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => onModelChange(e.target.value as ModelName)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-bg)',
                                        color: 'var(--color-text)',
                                        outline: 'none',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    {availableModels.length > 0 ? (
                                        availableModels.map((model) => (
                                            <option key={model} value={model}>{model}</option>
                                        ))
                                    ) : (
                                        <option value={selectedModel || ''}>{selectedModel || t('common.empty')}</option>
                                    )}
                                </select>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0' }} />

                            {/* Tuning Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Sliders size={18} /> {t('modelConfig.enableTuning')}
                                    </label>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('modelConfig.tuningHint')}</span>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                                    <input
                                        type="checkbox"
                                        checked={enableTuning}
                                        onChange={(e) => onTuningChange(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: enableTuning ? 'var(--color-primary)' : '#e2e8f0', // lighter grey for off state
                                        borderRadius: '34px', transition: '.3s'
                                    }}>
                                        <span style={{
                                            position: 'absolute', content: '""', height: '20px', width: '20px', left: '3px', bottom: '3px',
                                            backgroundColor: 'white', borderRadius: '50%', transition: '.3s',
                                            transform: enableTuning ? 'translateX(22px)' : 'translateX(0)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                        }} />
                                    </span>
                                </label>
                            </div>

                            {/* Thinking Toggle */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Brain size={18} /> {t('modelConfig.enableThinking')}
                                    </label>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {t('modelConfig.thinkingHint')}
                                    </span>
                                </div>
                                <label style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '48px',
                                    height: '26px',
                                    cursor: supportsThinking ? 'pointer' : 'not-allowed',
                                    opacity: supportsThinking ? 1 : 0.6
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={enableThinking}
                                        onChange={(e) => onThinkingChange(e.target.checked)}
                                        disabled={!supportsThinking}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        cursor: supportsThinking ? 'pointer' : 'not-allowed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: enableThinking && supportsThinking ? 'var(--color-primary)' : '#e2e8f0',
                                        borderRadius: '34px',
                                        transition: '.3s'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '""',
                                            height: '20px',
                                            width: '20px',
                                            left: '3px',
                                            bottom: '3px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: '.3s',
                                            transform: enableThinking && supportsThinking ? 'translateX(22px)' : 'translateX(0)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.22)'
                                        }} />
                                    </span>
                                </label>
                            </div>
                            {!supportsThinking && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    {t('modelConfig.thinkingUnsupported')}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                {t('modelConfig.done')}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
