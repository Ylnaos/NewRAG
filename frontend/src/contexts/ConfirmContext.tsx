/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ConfirmDialog, { ConfirmType } from '../components/ui/ConfirmDialog';

interface ConfirmOptions {
    title: string;
    message: string;
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions>({
        title: '',
        message: '',
        type: 'warning',
    });
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        setOptions(options);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (resolvePromise) {
            resolvePromise(true);
        }
        setIsOpen(false);
        setResolvePromise(null);
    }, [resolvePromise]);

    const handleCancel = useCallback(() => {
        if (resolvePromise) {
            resolvePromise(false);
        }
        setIsOpen(false);
        setResolvePromise(null);
    }, [resolvePromise]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmDialog
                isOpen={isOpen}
                title={options.title}
                message={options.message}
                type={options.type}
                confirmText={options.confirmText}
                cancelText={options.cancelText}
                hideCancel={options.hideCancel}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
};

export const useConfirm = (): ConfirmContextType => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};
