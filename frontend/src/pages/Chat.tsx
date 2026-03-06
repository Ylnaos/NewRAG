import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Mic,
  Paperclip,
  Send,
  Share2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { EvidenceGraphModal } from '../components/ui/EvidenceGraphModal';
import { ChainNode } from '../components/ui/DocumentDetailPanel';
import { BackendEvidence, BackendGraphNode, QAHistoryTurn, getAnswerGraph, queryQA } from '../api/backend';
import { AudioVisualizer } from '../components/ui/AudioVisualizer';
import { useModelConfig } from '../contexts/ModelConfigContext';
import { useDocuments } from '../contexts/DocumentsContext';
import { useChat, ChatMessage } from '../contexts/ChatContext';

const Chat: React.FC = () => {
  const { t } = useTranslation();
  const emptyLabel = t('common.empty');
  const unknownDocumentLabel = t('common.unknownDocument');
  const {
    enableThinking,
    setEnableThinking,
    supportsThinking,
    selectedModel,
    setSelectedModel,
    availableModels,
    enableTuning,
    setEnableTuning,
  } = useModelConfig();
  const { currentSession, appendMessage, updateMessage } = useChat();
  const { documents, addFiles, triggerIndexBuild } = useDocuments();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [userAvatar, setUserAvatar] = useState('');
  const [aiAvatar, setAiAvatar] = useState('');
  const [graphNodesByMessageId, setGraphNodesByMessageId] = useState<Record<string, ChainNode[]>>({});

  useEffect(() => {
    setUserAvatar(localStorage.getItem('user_avatar') || '');
    setAiAvatar(localStorage.getItem('ai_avatar') || '');
  }, []);

  const [isListening, setIsListening] = useState(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => currentSession?.messages ?? [], [currentSession]);
  const docNameMap = useMemo(() => new Map(documents.map((doc) => [doc.id, doc.name])), [documents]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  useEffect(() => {
    if (messages.length === 0) {
      messagesContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    scrollToBottom();
  }, [messages]);

  const buildGraphNodesFromEvidence = (evidence: BackendEvidence[]): ChainNode[] => {
    if (!evidence.length) return [];
    return evidence.map((item, index) => {
      const chunkId = String(item.chunk_id ?? `node-${index + 1}`);
      const docId = typeof item.doc_id === 'string' ? item.doc_id : '';
      const docName = docNameMap.get(docId) ?? (docId || unknownDocumentLabel);
      const path = typeof item.path === 'string' ? item.path : '';
      const text = typeof item.text === 'string' ? item.text : '';
      const score = typeof item.score === 'number' ? item.score : 0.0;
      const sectionId = typeof item.section_id === 'string' ? item.section_id : '';
      return {
        id: chunkId,
        label: path || docName,
        type: 'document',
        metadata: {
          dbName: docId || 'document_store',
          fileName: docName,
          reason: t('chat.reason.retrievedEvidence'),
          page: 1,
          relevance: score,
          nodeInfo: sectionId || path || chunkId,
          snippet: text ? (text.length > 120 ? `${text.slice(0, 120)}...` : text) : emptyLabel,
        },
      };
    });
  };

  const buildGraphNodesFromGraph = (nodes: BackendGraphNode[]): ChainNode[] => {
    if (!nodes.length) return [];
    return nodes.map((node) => {
      const meta = (node.metadata ?? {}) as Record<string, unknown>;
      const relevance = typeof meta.relevance === 'number'
        ? meta.relevance
        : (typeof node.score === 'number' ? node.score : 0);
      return {
        id: node.id,
        label: node.label ?? node.id,
        type: node.type === 'concept' ? 'concept' : 'document',
        metadata: {
          dbName: String(meta.dbName ?? node.doc_id ?? 'document_store'),
          fileName: String(meta.fileName ?? node.label ?? node.id),
          reason: String(meta.reason ?? emptyLabel),
          page: Number(meta.page ?? 1),
          relevance: Number(relevance),
          nodeInfo: String(meta.nodeInfo ?? node.section_id ?? node.id),
          snippet: meta.snippet ? String(meta.snippet) : emptyLabel,
        },
      };
    });
  };

  const toggleThoughtOpen = (messageId: string) => {
    updateMessage(messageId, (msg) => {
      if (!msg.thought) return msg;
      return {
        ...msg,
        thought: { ...msg.thought, isOpen: !msg.thought.isOpen },
      };
    });
  };

  const handleSend = async () => {
    const queryText = input.trim();
    const pendingFiles = [...files];
    if (!queryText && pendingFiles.length === 0) return;
    const historyForRequest: QAHistoryTurn[] = messages
      .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && msg.content.trim().length > 0)
      .slice(-12)
      .map((msg) => ({
        role: msg.role,
        content: msg.content.replace(/\s+/g, ' ').trim().slice(0, 320),
      }))
      .filter((turn) => turn.role === 'user' || !turn.content.startsWith('Evidence summary:'))
      .slice(-8);
    const retrievalParams = enableTuning
      ? { top_k: 8, rerank_k: 40, max_evidence: 8 }
      : { top_k: 5, rerank_k: 20, max_evidence: 5 };

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      attachments: pendingFiles,
    };

    const assistantId = (Date.now() + 1).toString();
    const thinkingEnabled = enableThinking && supportsThinking;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: thinkingEnabled ? '' : '...',
      thought: thinkingEnabled
        ? {
            status: 'thinking',
            steps: [t('chat.thought.thinking')],
            isOpen: false,
          }
        : undefined,
    };

    appendMessage(newMessage);
    appendMessage(assistantMessage);
    setInput('');
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (!queryText) {
      updateMessage(assistantId, (msg) => ({
        ...msg,
        content: t('chat.error.noQuestion'),
        thought: msg.thought ? { ...msg.thought, status: 'done' } : undefined,
      }));
      return;
    }

    try {
      if (pendingFiles.length > 0) {
        updateMessage(assistantId, (msg) => ({
          ...msg,
          content: thinkingEnabled ? '' : t('chat.resultMode.uploading'),
          thought: msg.thought ? {
            ...msg.thought,
            steps: [
              t('chat.thoughtSteps.reviewAttachments', { count: pendingFiles.length }),
              t('chat.resultMode.uploading'),
              t('chat.resultMode.reindexing'),
            ],
          } : undefined,
        }));
        await addFiles(pendingFiles);
        await triggerIndexBuild();
      }

      const response = await queryQA({
        query: queryText,
        ...retrievalParams,
        history: historyForRequest,
        structure_prior_enabled: true,
      });
      const rawAnswer = response.answer ? String(response.answer) : t('chat.error.noAnswer');
      const answerPrefix = response.result_mode === 'fallback_evidence'
        ? t('chat.resultMode.fallback')
        : response.result_mode === 'memory'
          ? t('chat.resultMode.memory')
          : '';
      const answer = answerPrefix ? `${answerPrefix}\n\n${rawAnswer}` : rawAnswer;
      const nextThoughtSteps = Array.isArray(response.thought_steps) && response.thought_steps.length > 0
        ? response.thought_steps.map((item) => String(item))
        : (typeof response.reasoning_content === 'string' && response.reasoning_content.trim()
          ? response.reasoning_content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line)
            .slice(0, 12)
          : []);
      updateMessage(assistantId, (msg) => ({
        ...msg,
        content: answer,
        thought: msg.thought ? {
          ...msg.thought,
          status: 'done',
          steps: nextThoughtSteps.length > 0 ? nextThoughtSteps : msg.thought.steps,
        } : undefined,
      }));
      const fallbackNodes = buildGraphNodesFromGraph(response.graph?.nodes ?? []);
      if (fallbackNodes.length > 0) {
        setGraphNodesByMessageId((prev) => ({ ...prev, [assistantId]: fallbackNodes }));
      }

      const answerId = response.answer_id;
      if (answerId) {
        void (async () => {
          try {
            const graphResponse = await getAnswerGraph(answerId);
            const graphNodes = buildGraphNodesFromGraph(graphResponse.graph.nodes ?? []);
            if (graphNodes.length > 0) {
              setGraphNodesByMessageId((prev) => ({ ...prev, [assistantId]: graphNodes }));
              return;
            }
          } catch {
            // Keep fallback graph/evidence when graph endpoint fails.
          }

          if (fallbackNodes.length === 0) {
            const evidenceNodes = buildGraphNodesFromEvidence(response.evidence ?? []);
            if (evidenceNodes.length > 0) {
              setGraphNodesByMessageId((prev) => ({ ...prev, [assistantId]: evidenceNodes }));
            }
          }
        })();
      } else if (fallbackNodes.length === 0) {
        const evidenceNodes = buildGraphNodesFromEvidence(response.evidence ?? []);
        if (evidenceNodes.length > 0) {
          setGraphNodesByMessageId((prev) => ({ ...prev, [assistantId]: evidenceNodes }));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('chat.error.queryFailed');
      updateMessage(assistantId, (msg) => ({
        ...msg,
        content: message,
        thought: msg.thought ? { ...msg.thought, status: 'done' } : undefined,
      }));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(event.target.files || [])]);
    }
    event.target.value = '';
  };

  const adjustTextareaHeight = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
  };

  const handleGraphClick = (messageId: string) => {
    setSelectedMessageId(messageId);
    setIsGraphModalOpen(true);
  };

  const handleConversationGraph = () => {
    if (!currentSession) return;
    setSelectedMessageId(`conversation-${currentSession.id}`);
    setIsGraphModalOpen(true);
  };

  const toggleListening = () => {
    setIsListening((prev) => !prev);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      position: 'relative',
      backgroundColor: 'var(--color-bg)'
    }}>
      <EvidenceGraphModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
        messageId={selectedMessageId}
        nodes={graphNodesByMessageId[selectedMessageId]}
      />

      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '30px',
          width: '100%',
          maxWidth: '100%',
          margin: 0,
          paddingBottom: '120px'
        }}
      >
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60%',
            opacity: 0.6,
            gap: '20px'
          }}>
            <Sparkles size={64} color="var(--color-primary)" />
            <h2 style={{ fontSize: '2rem' }}>{t('chat.emptyTitle')}</h2>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '8px'
              }}
            >
              {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {msg.attachments.map((file, index) => (
                    <div
                      key={`${msg.id}-attachment-${index}`}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--color-surface)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <FileText size={14} /> {file.name}
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                maxWidth: '100%'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: msg.role === 'user'
                    ? (userAvatar ? 'none' : 'linear-gradient(135deg, #6366f1, #8b5cf6)')
                    : (aiAvatar ? 'none' : 'var(--color-surface-hover)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  {msg.role === 'user' ? (
                    userAvatar ? (
                      <img src={userAvatar} alt={t('chat.userAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={18} color="white" />
                    )
                  ) : (
                    aiAvatar ? (
                      <img src={aiAvatar} alt={t('chat.aiAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Bot size={18} color="var(--color-primary)" />
                    )
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxWidth: '85%'
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('chat.assistantLabel')}</span>
                      <button
                        onClick={() => handleGraphClick(msg.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                        title={t('chat.viewEvidenceGraph')}
                      >
                        <Share2 size={12} />
                        {t('chat.evidenceGraph')}
                      </button>
                      {msg.thought && (
                        <button
                          onClick={() => toggleThoughtOpen(msg.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--color-surface-hover)',
                            color: 'var(--color-text)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                          title={msg.thought.isOpen ? t('chat.thought.hide') : t('chat.thought.show')}
                        >
                          {msg.thought.status === 'thinking' ? t('chat.thought.thinking') : t('chat.thought.done')}
                          {msg.thought.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && msg.thought && (() => {
                    const maxHeight = msg.thought.steps.length * 28 + 24;
                    const isOpen = msg.thought.isOpen;
                    return (
                      <div
                        style={{
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-bg)',
                          borderRadius: '10px',
                          padding: isOpen ? '10px 12px' : '0 12px',
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: isOpen ? '6px' : 0,
                          maxHeight: isOpen ? `${maxHeight}px` : '0px',
                          opacity: isOpen ? 1 : 0,
                          transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
                          overflow: 'hidden',
                          transition: 'max-height 0.255s ease, opacity 0.2s ease, transform 0.2s ease, padding 0.2s ease',
                          willChange: 'max-height, opacity, transform'
                        }}
                      >
                        {msg.thought.steps.map((step, index) => (
                          <div key={`${msg.id}-thought-${index}`} style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              {index + 1}.
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div style={{
                    padding: msg.role === 'user' ? '12px 16px' : '0',
                    backgroundColor: msg.role === 'user' ? 'var(--color-surface)' : 'transparent',
                    borderRadius: '18px',
                    borderTopRightRadius: msg.role === 'user' ? '4px' : '18px',
                    borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '18px',
                    boxShadow: msg.role === 'user' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    lineHeight: 1.6
                  }}>
                    {msg.content || (msg.thought?.status === 'thinking' ? '...' : '')}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {currentSession && messages.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleConversationGraph}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                <Share2 size={14} />
                {t('chat.viewConversationGraph')}
              </button>
            </div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid var(--color-border)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          position: 'relative',
          overflow: 'hidden',
          margin: '0 24px 24px'
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {isListening ? (
            <motion.div
              key="voice-input"
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', transformOrigin: 'bottom right' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transformOrigin: 'bottom right' }}
              exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', transformOrigin: 'bottom right' }}
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              style={{
                height: '120px',
                width: '100%',
                position: 'relative',
                zIndex: 10,
                borderRadius: '24px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <AudioVisualizer isListening={true} />
              </div>

              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{
                  fontSize: '1rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '20px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  {t('chat.listening')}
                </div>
                <button
                  onClick={toggleListening}
                  style={{
                    position: 'absolute',
                    right: '0',
                    top: '0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    zIndex: 10
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="text-input"
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', transformOrigin: 'bottom right' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transformOrigin: 'bottom right' }}
              exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', transformOrigin: 'bottom right' }}
              transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%'
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={adjustTextareaHeight}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t('chat.placeholder')}
                rows={1}
                style={{
                  width: '100%',
                  border: 'none',
                  resize: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text)',
                  fontSize: '1rem',
                  outline: 'none',
                  maxHeight: '200px',
                  fontFamily: 'inherit',
                  padding: '4px 0'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,.pdf,.txt,.doc,.docx"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: 'var(--color-text-muted)' }}
                    title={t('chat.uploadFile')}
                  >
                    <Paperclip size={20} />
                  </button>
                  <button
                    onClick={toggleListening}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: 'var(--color-text-muted)' }}
                    title={t('chat.voiceInput')}
                  >
                    <Mic size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('chat.modelLabel')}</span>
                    <select
                      value={selectedModel}
                      onChange={(event) => setSelectedModel(event.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontSize: '0.75rem',
                        outline: 'none'
                      }}
                    >
                      {availableModels.length > 0 ? (
                        <>
                          {!selectedModel && <option value="" disabled>{t('common.empty')}</option>}
                          {availableModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </>
                      ) : (
                        <option value={selectedModel || ''}>{selectedModel || t('common.empty')}</option>
                      )}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('chat.thinkingToggle')}</span>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '36px',
                      height: '20px',
                      cursor: supportsThinking ? 'pointer' : 'not-allowed',
                      opacity: supportsThinking ? 1 : 0.6
                    }}>
                      <input
                        type="checkbox"
                        checked={enableThinking}
                        onChange={(event) => setEnableThinking(event.target.checked)}
                        disabled={!supportsThinking}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: enableThinking && supportsThinking ? 'var(--color-primary)' : '#e2e8f0',
                        borderRadius: '999px',
                        transition: '0.2s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '14px',
                          width: '14px',
                          left: '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.2s',
                          transform: enableThinking && supportsThinking ? 'translateX(16px)' : 'translateX(0)'
                        }} />
                      </span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('chat.tuningToggle')}</span>
                    <label style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '36px',
                      height: '20px'
                    }}>
                      <input
                        type="checkbox"
                        checked={enableTuning}
                        onChange={(event) => setEnableTuning(event.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: enableTuning ? 'var(--color-primary)' : '#e2e8f0',
                        borderRadius: '999px',
                        transition: '0.2s'
                      }}>
                        <span style={{
                          position: 'absolute',
                          height: '14px',
                          width: '14px',
                          left: '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.2s',
                          transform: enableTuning ? 'translateX(16px)' : 'translateX(0)'
                        }} />
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && files.length === 0}
                    style={{
                      backgroundColor: (!input.trim() && files.length === 0) ? 'var(--color-bg)' : 'var(--color-primary)',
                      color: (!input.trim() && files.length === 0) ? 'var(--color-text-muted)' : '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (!input.trim() && files.length === 0) ? 'default' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>

              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                >
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      style={{
                        backgroundColor: 'var(--color-bg)',
                        padding: '4px 8px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <FileText size={14} />
                      <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <button
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== index))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: '2px', opacity: 0.6 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Chat;


