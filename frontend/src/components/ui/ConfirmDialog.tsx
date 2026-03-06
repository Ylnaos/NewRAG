import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ConfirmType = 'info' | 'warning' | 'success' | 'danger';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    type = 'warning',
    confirmText,
    cancelText,
    hideCancel = false,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const confirmLabel = confirmText ?? t('confirm.confirm');
    const cancelLabel = cancelText ?? t('confirm.cancel');
    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertTriangle size={22} color="#ef4444" />;
            case 'success':
                return <CheckCircle size={22} color="#10b981" />;
            case 'info':
                return <Info size={22} color="#3b82f6" />;
            case 'warning':
            default:
                return <AlertTriangle size={22} color="#f59e0b" />;
        }
    };

    const getButtonColor = () => {
        switch (type) {
            case 'danger':
                return '#ef4444';
            case 'success':
                return '#10b981';
            case 'info':
                return '#3b82f6';
            case 'warning':
            default:
                return '#f59e0b';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.35)',
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={onCancel}
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '420px',
                            backgroundColor: 'var(--color-surface)',
                            borderRadius: '16px',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-lg)',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{
                                    flexShrink: 0,
                                    padding: '8px',
                                    borderRadius: '12px',
                                    backgroundColor: 'var(--color-bg)'
                                }}>
                                    {getIcon()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: '1.05rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text)'
                                    }}>
                                        {title}
                                    </h3>
                                    <div style={{ marginTop: '6px' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            color: 'var(--color-text-muted)',
                                            lineHeight: 1.5
                                        }}>
                                            {message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '12px 20px 18px',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            backgroundColor: 'var(--color-bg)'
                        }}>
                            <button
                                type="button"
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    backgroundColor: getButtonColor(),
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onClick={onConfirm}
                            >
                                {confirmLabel}
                            </button>
                            {!hideCancel && (
                                <button
                                    type="button"
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: 'var(--color-surface)',
                                        color: 'var(--color-text)',
                                        fontSize: '0.9rem',
                                        fontWeight: 500,
                                        cursor: 'pointer'
                                    }}
                                    onClick={onCancel}
                                >
                                    {cancelLabel}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmDialog;
