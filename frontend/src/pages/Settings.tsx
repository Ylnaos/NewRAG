import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getLLMConfig, getLLMModels, getModelWeights, testLLMConnection, updateLLMConfig, updateModelWeights } from '../api/backend';
import i18n from '../i18n/config';
import { useConfirm } from '../contexts/ConfirmContext';
import { useChat } from '../contexts/ChatContext';

const DEFAULT_RETRIEVAL_WEIGHTS = {
  sparse_weight: 0.45,
  dense_weight: 0.45,
  structure_weight: 0.1,
  overlap_weight: 0.6,
  coarse_weight: 0.4,
};

const DEFAULT_EVIDENCE_WEIGHTS = {
  match_weight: 0.5,
  consistency_weight: 0.3,
  diversity_weight: 0.2,
  candidate_weight: 0.6,
  confidence_weight: 0.4,
  redundancy_penalty: 0.7,
};

const DEFAULT_LLM_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_LLM_MODEL_ID = 'Pro/zai-org/GLM-4.7';
const DEFAULT_LLM_MODE: 'mock' | 'disabled' | 'moonshot' = 'moonshot';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const { sessions, clearSessions } = useChat();

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('llm_base_url') || DEFAULT_LLM_BASE_URL);
  const [modelId, setModelId] = useState(() => localStorage.getItem('llm_model_id') || DEFAULT_LLM_MODEL_ID);
  const [mode, setMode] = useState<'mock' | 'disabled' | 'moonshot'>(() => {
    const stored = localStorage.getItem('llm_mode');
    if (stored === 'mock') return 'mock';
    if (stored === 'disabled') return 'disabled';
    if (stored === 'moonshot') return 'moonshot';
    return DEFAULT_LLM_MODE;
  });
  const [enableWebSearch, setEnableWebSearch] = useState(() => localStorage.getItem('llm_enable_web_search') === 'true');
  const [enableThinkingOutput, setEnableThinkingOutput] = useState(() => localStorage.getItem('llm_enable_thinking') === 'true');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem('system_prompt') || i18n.t('settings.defaultSystemPrompt'));
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('user_avatar') || '');
  const [aiAvatar, setAiAvatar] = useState(() => localStorage.getItem('ai_avatar') || '');
  const [requestError, setRequestError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [retrievalWeights, setRetrievalWeights] = useState(DEFAULT_RETRIEVAL_WEIGHTS);
  const [evidenceWeights, setEvidenceWeights] = useState(DEFAULT_EVIDENCE_WEIGHTS);
  const [weightsError, setWeightsError] = useState('');
  const [isLoadingWeights, setIsLoadingWeights] = useState(false);
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        const response = await getLLMConfig();
        if (!active) return;
        const fallbackBaseUrl = localStorage.getItem('llm_base_url') || DEFAULT_LLM_BASE_URL;
        const fallbackModelId = localStorage.getItem('llm_model_id') || DEFAULT_LLM_MODEL_ID;
        const fallbackMode = (localStorage.getItem('llm_mode') as 'mock' | 'disabled' | 'moonshot') || DEFAULT_LLM_MODE;
        const fallbackEnableWebSearch = localStorage.getItem('llm_enable_web_search') === 'true';
        const fallbackEnableThinking = localStorage.getItem('llm_enable_thinking') === 'true';
        setBaseUrl(response.config.base_url || fallbackBaseUrl);
        setModelId(response.config.model_id || fallbackModelId);
        setMode((response.config.mode as 'mock' | 'disabled' | 'moonshot') || fallbackMode);
        setEnableWebSearch(response.config.enable_web_search ?? fallbackEnableWebSearch);
        setEnableThinkingOutput(response.config.enable_thinking ?? fallbackEnableThinking);
      } catch (error) {
        if (!active) return;
        setRequestError(error instanceof Error ? error.message : i18n.t('settings.errors.loadConfig'));
      }
    };
    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadWeights = async () => {
      setIsLoadingWeights(true);
      setWeightsError('');
      try {
        const response = await getModelWeights();
        if (!active) return;
        setRetrievalWeights({
          ...DEFAULT_RETRIEVAL_WEIGHTS,
          ...(response.weights?.retrieval || {}),
        });
        setEvidenceWeights({
          ...DEFAULT_EVIDENCE_WEIGHTS,
          ...(response.weights?.evidence || {}),
        });
      } catch (error) {
        if (!active) return;
        setWeightsError(error instanceof Error ? error.message : i18n.t('settings.errors.loadWeights'));
      } finally {
        if (active) {
          setIsLoadingWeights(false);
        }
      }
    };
    void loadWeights();
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setRequestError('');
    try {
      const response = await updateLLMConfig({
        base_url: baseUrl,
        model_id: modelId,
        mode,
        enable_web_search: enableWebSearch,
        enable_thinking: enableThinkingOutput,
        api_key: apiKey || undefined,
      });
      localStorage.setItem('llm_base_url', response.config.base_url || baseUrl);
      localStorage.setItem('llm_model_id', response.config.model_id || modelId);
      localStorage.setItem('llm_mode', response.config.mode || mode);
      localStorage.setItem('llm_enable_web_search', String(response.config.enable_web_search ?? enableWebSearch));
      localStorage.setItem('llm_enable_thinking', String(response.config.enable_thinking ?? enableThinkingOutput));
      localStorage.setItem('system_prompt', systemPrompt);
      localStorage.setItem('user_avatar', userAvatar);
      localStorage.setItem('ai_avatar', aiAvatar);
      await confirm({
        title: t('settings.confirm.savedTitle'),
        message: t('settings.confirm.savedMessage'),
        type: 'success',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.errors.saveSettings');
      setRequestError(message);
      await confirm({
        title: t('settings.confirm.saveFailedTitle'),
        message,
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearHistory = async () => {
    const ok = await confirm({
      title: t('settings.confirm.clearTitle'),
      message: t('settings.confirm.clearMessage'),
      type: 'danger',
      confirmText: t('settings.clearHistory'),
    });
    if (ok) {
      clearSessions();
      await confirm({
        title: t('settings.confirm.clearedTitle'),
        message: t('settings.confirm.clearedMessage'),
        type: 'success',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    }
  };

  const handleTestConnection = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setRequestError('');
    try {
      const response = await testLLMConnection();
      const message = response.status === 'ok'
        ? t('settings.connection.success', { latency: response.latency_ms ?? 0 })
        : response.detail || t('settings.connection.status', { status: response.status });
      await confirm({
        title: t('settings.confirm.connectionTitle'),
        message,
        type: response.status === 'ok' ? 'success' : 'info',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.errors.connectionFailed');
      setRequestError(message);
      await confirm({
        title: t('settings.confirm.connectionFailedTitle'),
        message,
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadModels = async () => {
    if (isLoadingModels) return;
    setIsLoadingModels(true);
    setModelsError('');
    try {
      // Keep backend in sync and ensure API key is available in memory before listing models.
      await updateLLMConfig({
        base_url: baseUrl,
        mode,
        enable_web_search: enableWebSearch,
        enable_thinking: enableThinkingOutput,
        api_key: apiKey || undefined,
      });
      const response = await getLLMModels();
      const ids = response.models
        .map((model) => (typeof model.id === 'string' ? model.id : ''))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setAvailableModels(ids);
      if (ids.length > 0 && !ids.includes(modelId)) {
        setModelId(ids[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.errors.loadModels');
      setModelsError(message);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleWeightChange = (
    group: 'retrieval' | 'evidence',
    key: string,
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    if (group === 'retrieval') {
      setRetrievalWeights((prev) => ({ ...prev, [key]: parsed }));
      return;
    }
    setEvidenceWeights((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleSaveWeights = async () => {
    if (isSavingWeights) return;
    setIsSavingWeights(true);
    setWeightsError('');
    try {
      await updateModelWeights({
        retrieval: retrievalWeights,
        evidence: evidenceWeights,
      });
      await confirm({
        title: t('settings.confirm.weightsSavedTitle'),
        message: t('settings.confirm.weightsSavedMessage'),
        type: 'success',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('settings.errors.saveWeights');
      setWeightsError(message);
      await confirm({
        title: t('settings.confirm.weightsFailedTitle'),
        message,
        type: 'warning',
        confirmText: t('common.ok'),
        hideCancel: true,
      });
    } finally {
      setIsSavingWeights(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page">
      <section className="section-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => navigate('/qa')}>
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
          <div>
            <div className="section-title">{t('settings.title')}</div>
            <div className="muted">{t('settings.subtitle')}</div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('settings.section.llm')}</div>
        {requestError && <div className="muted" style={{ marginTop: '8px' }}>{requestError}</div>}
        {modelsError && <div className="muted" style={{ marginTop: '8px' }}>{modelsError}</div>}
        <div className="grid-2">
          <div>
            <label className="muted">{t('settings.apiKey')}</label>
            <input
              className="input"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <div>
            <label className="muted">{t('settings.baseUrl')}</label>
            <input
              className="input"
              type="text"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
            />
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: '12px' }}>
          <div>
            <label className="muted">{t('settings.modelId')}</label>
            {mode === 'moonshot' && availableModels.length > 0 ? (
              <select
                className="input"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
              >
                {availableModels.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type="text"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
              />
            )}
          </div>
          <div>
            <label className="muted">{t('settings.mode')}</label>
            <select
              className="input"
              value={mode}
              onChange={(event) => setMode(event.target.value as 'mock' | 'disabled' | 'moonshot')}
            >
              <option value="mock">{t('settings.modeOptions.mock')}</option>
              <option value="disabled">{t('settings.modeOptions.disabled')}</option>
              <option value="moonshot">{t('settings.modeOptions.moonshot')}</option>
            </select>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="muted">{t('settings.enableWebSearch')}</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(event) => setEnableWebSearch(event.target.checked)}
              />
              <span className="muted">{t('settings.enableWebSearchHint')}</span>
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="muted">{t('settings.enableThinking')}</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={enableThinkingOutput}
                onChange={(event) => setEnableThinkingOutput(event.target.checked)}
              />
              <span className="muted">{t('settings.enableThinkingHint')}</span>
            </label>
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <label className="muted">{t('settings.systemPrompt')}</label>
          <textarea
            className="input"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>
        <div className="toolbar" style={{ marginTop: '12px' }}>
          <button className="btn" onClick={handleLoadModels} disabled={isLoadingModels}>
            {isLoadingModels ? t('settings.loadingModels') : t('settings.loadModels')}
          </button>
          <button className="btn" onClick={handleTestConnection} disabled={isTesting}>
            <Plug size={16} />
            {isTesting ? t('settings.testing') : t('settings.testConnection')}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            <Save size={16} />
            {isSaving ? t('settings.savingSettings') : t('settings.saveSettings')}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('settings.section.weights')}</div>
        <div className="muted">{t('settings.weightsSubtitle')}</div>
        {weightsError && <div className="muted" style={{ marginTop: '8px' }}>{weightsError}</div>}
        <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
          <div style={{ fontWeight: 600 }}>{t('settings.retrievalWeights')}</div>
          <div className="grid-3">
            <div>
              <label className="muted">{t('settings.weights.sparse')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights.sparse_weight}
                onChange={(event) => handleWeightChange('retrieval', 'sparse_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.dense')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights.dense_weight}
                onChange={(event) => handleWeightChange('retrieval', 'dense_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.structure')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights.structure_weight}
                onChange={(event) => handleWeightChange('retrieval', 'structure_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.overlap')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights.overlap_weight}
                onChange={(event) => handleWeightChange('retrieval', 'overlap_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.coarse')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={retrievalWeights.coarse_weight}
                onChange={(event) => handleWeightChange('retrieval', 'coarse_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gap: '12px' }}>
          <div style={{ fontWeight: 600 }}>{t('settings.evidenceWeights')}</div>
          <div className="grid-3">
            <div>
              <label className="muted">{t('settings.weights.match')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.match_weight}
                onChange={(event) => handleWeightChange('evidence', 'match_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.consistency')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.consistency_weight}
                onChange={(event) => handleWeightChange('evidence', 'consistency_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.diversity')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.diversity_weight}
                onChange={(event) => handleWeightChange('evidence', 'diversity_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.candidate')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.candidate_weight}
                onChange={(event) => handleWeightChange('evidence', 'candidate_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.confidence')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.confidence_weight}
                onChange={(event) => handleWeightChange('evidence', 'confidence_weight', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
            <div>
              <label className="muted">{t('settings.weights.redundancy')}</label>
              <input
                className="input"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={evidenceWeights.redundancy_penalty}
                onChange={(event) => handleWeightChange('evidence', 'redundancy_penalty', event.target.value)}
                disabled={isLoadingWeights}
              />
            </div>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: '16px' }}>
          <button className="btn btn-primary" onClick={handleSaveWeights} disabled={isSavingWeights || isLoadingWeights}>
            <Save size={16} />
            {isSavingWeights ? t('settings.savingWeights') : t('settings.saveWeights')}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('settings.section.history')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="muted">{t('settings.historyStored', { count: sessions.length })}</div>
          <button className="btn" onClick={handleClearHistory}>
            <Trash2 size={16} />
            {t('settings.clearHistory')}
          </button>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title">{t('settings.section.avatars')}</div>
        <div className="grid-2">
          <div>
            <label className="muted">{t('settings.avatarsUser')}</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-hover)',
                backgroundImage: userAvatar ? `url(${userAvatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid var(--color-border)'
              }} />
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, setUserAvatar)} />
                <input
                  className="input"
                  type="text"
                  placeholder={t('settings.avatarUrlPlaceholder')}
                  value={userAvatar}
                  onChange={(event) => setUserAvatar(event.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="muted">{t('settings.avatarsAi')}</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-hover)',
                backgroundImage: aiAvatar ? `url(${aiAvatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid var(--color-border)'
              }} />
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={(event) => handleImageUpload(event, setAiAvatar)} />
                <input
                  className="input"
                  type="text"
                  placeholder={t('settings.avatarUrlPlaceholder')}
                  value={aiAvatar}
                  onChange={(event) => setAiAvatar(event.target.value)}
                  style={{ marginTop: '6px' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
