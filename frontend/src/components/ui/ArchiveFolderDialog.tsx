import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Folder } from 'lucide-react';

interface ArchiveFolderDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  hint?: string;
  confirmText: string;
  cancelText: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ArchiveFolderDialog: React.FC<ArchiveFolderDialogProps> = ({
  isOpen,
  title,
  message,
  label,
  placeholder,
  value,
  options,
  hint,
  confirmText,
  cancelText,
  onChange,
  onConfirm,
  onCancel,
}) => {
  const listId = 'archive-folder-options';

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 220,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '16px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  flexShrink: 0,
                  padding: '8px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-primary)',
                }}>
                  <Folder size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}>
                    {title}
                  </h3>
                  <p style={{
                    margin: '6px 0 0',
                    fontSize: '0.9rem',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}>
                    {message}
                  </p>
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {label}
                </label>
                <input
                  className="input"
                  list={options.length ? listId : undefined}
                  placeholder={placeholder}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                />
                {options.length > 0 && (
                  <datalist id={listId}>
                    {options.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                )}
                {hint && (
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {hint}
                  </div>
                )}
              </div>
            </div>
            <div style={{
              padding: '12px 20px 18px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'var(--color-bg)',
            }}>
              <button
                type="button"
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
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
                  cursor: 'pointer',
                }}
                onClick={onCancel}
              >
                {cancelText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ArchiveFolderDialog;
