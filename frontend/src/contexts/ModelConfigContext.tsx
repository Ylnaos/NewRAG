/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getLLMConfig, getLLMModels, updateLLMConfig } from '../api/backend';

export type ModelName = string;

interface ModelConfigContextType {
    selectedModel: ModelName;
    setSelectedModel: (model: ModelName) => void;
    availableModels: ModelName[];
    enableTuning: boolean;
    setEnableTuning: (enabled: boolean) => void;
    enableThinking: boolean;
    setEnableThinking: (enabled: boolean) => void;
    supportsThinking: boolean;
}

const ModelConfigContext = createContext<ModelConfigContextType | undefined>(undefined);

export const ModelConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedModel, setSelectedModelState] = useState<ModelName>('');
    const [availableModels, setAvailableModels] = useState<ModelName[]>([]);
    const [enableTuning, setEnableTuning] = useState(false);
    const [enableThinking, setEnableThinkingState] = useState(false);

    const supportsThinking = true;

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const resp = await getLLMConfig();
                if (!active) return;
                const modelId = resp.config?.model_id ?? '';
                setSelectedModelState(modelId);
                setEnableThinkingState(Boolean(resp.config?.enable_thinking));
            } catch {
                // Backend may be unavailable during local UI work; keep defaults.
            }

            try {
                const resp = await getLLMModels();
                if (!active) return;
                const ids = (resp.models ?? [])
                    .map((item) => (typeof (item as { id?: unknown }).id === 'string' ? String((item as { id?: unknown }).id) : ''))
                    .filter((id) => id);
                setAvailableModels(Array.from(new Set(ids)));
            } catch {
                // Model listing may not be supported for some LLM modes.
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, []);

    const setSelectedModel = (model: ModelName) => {
        setSelectedModelState(model);
        void updateLLMConfig({ model_id: model }).catch(() => {});
    };

    const setEnableThinking = (enabled: boolean) => {
        setEnableThinkingState(enabled);
        void updateLLMConfig({ enable_thinking: enabled }).catch(() => {});
    };

    const mergedModels = useMemo(() => {
        if (selectedModel && !availableModels.includes(selectedModel)) {
            return [selectedModel, ...availableModels];
        }
        return availableModels;
    }, [availableModels, selectedModel]);

    const value = useMemo(() => ({
        selectedModel,
        setSelectedModel,
        availableModels: mergedModels,
        enableTuning,
        setEnableTuning,
        enableThinking,
        setEnableThinking,
        supportsThinking
    }), [selectedModel, mergedModels, enableTuning, enableThinking, supportsThinking]);

    return (
        <ModelConfigContext.Provider value={value}>
            {children}
        </ModelConfigContext.Provider>
    );
};

export const useModelConfig = () => {
    const context = useContext(ModelConfigContext);
    if (!context) {
        throw new Error('useModelConfig must be used within a ModelConfigProvider');
    }
    return context;
};
