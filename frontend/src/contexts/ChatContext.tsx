/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n/config';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    attachments?: File[];
    thought?: {
        status: 'thinking' | 'done';
        steps: string[];
        isOpen: boolean;
    };
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    isArchived?: boolean;
}

interface ChatContextType {
    sessions: ChatSession[];
    currentSessionId: string;
    currentSession: ChatSession | null;
    createNewChat: () => void;
    selectSession: (id: string) => void;
    appendMessage: (message: ChatMessage) => void;
    updateMessage: (id: string, updater: (message: ChatMessage) => ChatMessage) => void;
    archiveSession: (id: string) => void;
    restoreSession: (id: string) => void;
    deleteSession: (id: string) => void;
    clearSessions: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);
const STORAGE_KEY = 'chat_sessions';
const CURRENT_KEY = 'chat_current_id';
const LEGACY_MESSAGES_KEY = 'session_messages';

const createSession = (messages: ChatMessage[] = []): ChatSession => {
    const now = Date.now();
    return {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: i18n.t('chat.new'),
        messages,
        createdAt: now,
        updatedAt: now,
        isArchived: false
    };
};

const deriveTitle = (content: string) => {
    const cleaned = content.trim().replace(/\s+/g, ' ');
    if (!cleaned) return i18n.t('chat.new');
    return cleaned.length > 36 ? `${cleaned.slice(0, 36)}...` : cleaned;
};

const normalizeSessions = (raw: ChatSession[]): ChatSession[] => (
    raw.map(session => ({
        ...session,
        isArchived: session.isArchived ?? false
    }))
);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedCurrent = localStorage.getItem(CURRENT_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as ChatSession[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const normalized = normalizeSessions(parsed);
                    const activeSessions = normalized.filter(session => !session.isArchived);
                    if (activeSessions.length === 0) {
                        const fresh = createSession();
                        setSessions([fresh, ...normalized]);
                        setCurrentSessionId(fresh.id);
                        return;
                    }
                    const fallbackId = activeSessions[0].id;
                    const storedValid = storedCurrent
                        && normalized.some(session => session.id === storedCurrent && !session.isArchived);
                    setSessions(normalized);
                    setCurrentSessionId(storedValid ? storedCurrent : fallbackId);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse chat sessions', e);
            }
        }

        const legacy = localStorage.getItem(LEGACY_MESSAGES_KEY);
        if (legacy) {
            try {
                const parsedMessages = JSON.parse(legacy) as ChatMessage[];
                if (parsedMessages.length > 0) {
                    const restored = createSession(parsedMessages);
                    restored.title = deriveTitle(parsedMessages.find(m => m.role === 'user')?.content || 'New Chat');
                    setSessions([restored]);
                    setCurrentSessionId(restored.id);
                    return;
                }
            } catch (e) {
                console.error('Failed to parse legacy messages', e);
            }
        }

        const initial = createSession();
        setSessions([initial]);
        setCurrentSessionId(initial.id);
    }, []);

    useEffect(() => {
        if (sessions.length === 0) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        localStorage.setItem(CURRENT_KEY, currentSessionId);
    }, [sessions, currentSessionId]);

    const currentSession = useMemo(() => sessions.find(s => s.id === currentSessionId) || null, [sessions, currentSessionId]);

    const createNewChat = useCallback(() => {
        if (currentSession && currentSession.messages.length === 0 && !currentSession.isArchived) {
            return;
        }
        const session = createSession();
        setSessions(prev => [session, ...prev]);
        setCurrentSessionId(session.id);
    }, [currentSession]);

    const selectSession = useCallback((id: string) => {
        if (!sessions.some(s => s.id === id)) return;
        setSessions(prev => prev.map(session => session.id === id
            ? { ...session, updatedAt: Date.now() }
            : session
        ));
        setCurrentSessionId(id);
    }, [sessions]);

    const appendMessage = useCallback((message: ChatMessage) => {
        setSessions(prev => prev.map(session => {
            if (session.id !== currentSessionId) return session;
            const nextMessages = [...session.messages, message];
            const nextTitle = session.title === i18n.t('chat.new') && message.role === 'user'
                ? deriveTitle(message.content)
                : session.title;
            return {
                ...session,
                title: nextTitle,
                messages: nextMessages,
                updatedAt: Date.now()
            };
        }));
    }, [currentSessionId]);

    const updateMessage = useCallback((id: string, updater: (message: ChatMessage) => ChatMessage) => {
        setSessions(prev => prev.map(session => {
            if (session.id !== currentSessionId) return session;
            const nextMessages = session.messages.map(msg => msg.id === id ? updater(msg) : msg);
            return {
                ...session,
                messages: nextMessages,
                updatedAt: Date.now()
            };
        }));
    }, [currentSessionId]);

    const archiveSession = useCallback((id: string) => {
        setSessions(prev => {
            const next = prev.map(session => session.id === id
                ? { ...session, isArchived: true, updatedAt: Date.now() }
                : session
            );
            const activeSessions = next.filter(session => !session.isArchived);
            if (activeSessions.length === 0) {
                const fresh = createSession();
                setCurrentSessionId(fresh.id);
                return [fresh, ...next];
            }
            if (currentSessionId === id) {
                setCurrentSessionId(activeSessions[0].id);
            }
            return next;
        });
    }, [currentSessionId]);

    const restoreSession = useCallback((id: string) => {
        setSessions(prev => prev.map(session => session.id === id
            ? { ...session, isArchived: false, updatedAt: Date.now() }
            : session
        ));
    }, []);

    const deleteSession = useCallback((id: string) => {
        setSessions(prev => {
            const next = prev.filter(session => session.id !== id);
            const activeSessions = next.filter(session => !session.isArchived);
            if (activeSessions.length === 0) {
                const fresh = createSession();
                setCurrentSessionId(fresh.id);
                return [fresh, ...next];
            }
            if (currentSessionId === id) {
                setCurrentSessionId(activeSessions[0].id);
            }
            return next;
        });
    }, [currentSessionId]);

    const clearSessions = useCallback(() => {
        const fresh = createSession();
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
    }, []);

    const value = useMemo(() => ({
        sessions,
        currentSessionId,
        currentSession,
        createNewChat,
        selectSession,
        appendMessage,
        updateMessage,
        archiveSession,
        restoreSession,
        deleteSession,
        clearSessions
    }), [sessions, currentSessionId, currentSession, createNewChat, selectSession, appendMessage, updateMessage, archiveSession, restoreSession, deleteSession, clearSessions]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
