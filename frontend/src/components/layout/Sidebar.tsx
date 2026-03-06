import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Archive,
    Plus,
    MessageSquare,
    MessagesSquare,
    Sparkles,
    FileText,
    Settings,
    Languages,
    Moon,
    Sun,
    Trash2,
    RotateCcw,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Database,
    Network,
    BarChart3,
    Activity,
    Star
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { useConfirm } from '../../contexts/ConfirmContext';

interface SidebarProps {
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, toggleCollapse }) => {
    const { t, i18n } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const { confirm } = useConfirm();
    const navigate = useNavigate();
    const location = useLocation();
    const { sessions, currentSessionId, createNewChat, selectSession, archiveSession, restoreSession, deleteSession } = useChat();
    const [isRecentCollapsed, setIsRecentCollapsed] = useState(false);
    const [isArchiveCollapsed, setIsArchiveCollapsed] = useState(true);
    const [archiveQuery, setArchiveQuery] = useState('');
    const orderedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    }, [sessions]);
    const recentSessions = useMemo(() => orderedSessions.filter(session => !session.isArchived), [orderedSessions]);
    const archivedSessions = useMemo(() => orderedSessions.filter(session => session.isArchived), [orderedSessions]);
    const filteredArchivedSessions = useMemo(() => {
        const keyword = archiveQuery.trim().toLowerCase();
        if (!keyword) return archivedSessions;
        return archivedSessions.filter(session => (
            session.title.toLowerCase().includes(keyword)
            || session.messages.some(message => message.content.toLowerCase().includes(keyword))
        ));
    }, [archivedSessions, archiveQuery]);

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'zh' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleNewChat = () => {
        createNewChat();
        navigate('/chat');
    };

    const handleArchiveSession = async (id: string) => {
        const ok = await confirm({
            title: t('sidebar.confirm.archiveTitle'),
            message: t('sidebar.confirm.archiveMessage'),
            type: 'warning',
            confirmText: t('sidebar.archive')
        });
        if (!ok) return;
        archiveSession(id);
    };

    const handleDeleteSession = async (id: string) => {
        const ok = await confirm({
            title: t('sidebar.confirm.deleteTitle'),
            message: t('sidebar.confirm.deleteMessage'),
            type: 'danger',
            confirmText: t('sidebar.delete')
        });
        if (!ok) return;
        deleteSession(id);
    };

    const handleRestoreSession = (id: string) => {
        restoreSession(id);
    };

    const navItems = [
        { to: '/chat', label: t('nav.chat'), icon: MessagesSquare },
        { to: '/qa', label: t('nav.qa'), icon: Sparkles },
        { to: '/docs', label: t('nav.docs'), icon: FileText },
        { to: '/index', label: t('nav.index'), icon: Database },
        { to: '/graph', label: t('nav.graph'), icon: Network },
        { to: '/chains', label: t('nav.chains'), icon: Star },
        { to: '/eval', label: t('nav.eval'), icon: BarChart3 },
        { to: '/status', label: t('nav.status'), icon: Activity },
    ];

    return (
        <motion.div
            initial={false}
            animate={{ width: isCollapsed ? '60px' : '260px' }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
            style={{
                height: '100vh',
                backgroundColor: 'var(--color-surface)',
                borderRight: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 10
            }}
        >
            {/* Collapse Toggle Button */}
            <button
                onClick={toggleCollapse}
                style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '20px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 20
                }}
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Header / New Chat */}
            <div style={{ padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                    onClick={handleNewChat}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: '10px',
                        padding: '10px',
                        borderRadius: '20px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-bg)',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        transition: 'background-color 0.2s'
                    }}
                    title={t('chat.new', 'New Chat')}
                >
                    <Plus size={20} />
                    {!isCollapsed && <span style={{ fontWeight: 500 }}>{t('chat.new', 'New Chat')}</span>}
                </button>
            </div>

            {/* Navigation */}
            <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px',
                                borderRadius: '8px',
                                color: 'var(--color-text)',
                                textDecoration: 'none',
                                justifyContent: isCollapsed ? 'center' : 'flex-start',
                                backgroundColor: isActive ? 'var(--color-surface-hover)' : 'transparent',
                                border: isActive ? '1px solid var(--color-border)' : '1px solid transparent'
                            }}
                            title={item.label}
                        >
                            <Icon size={20} />
                            {!isCollapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </div>

            {/* History List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 10px' }}>  
                {!isCollapsed && (
                    <button
                        onClick={() => setIsRecentCollapsed(prev => !prev)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--color-text-muted)',
                            marginBottom: '10px',
                            paddingLeft: '6px',
                            background: 'none',
                            border: 'none'
                        }}
                        title={isRecentCollapsed ? t('sidebar.expandRecent') : t('sidebar.collapseRecent')}
                    >
                        {isRecentCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {t('sidebar.recent')}
                    </button>
                )}
                {!isRecentCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {recentSessions.map(item => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    selectSession(item.id);
                                    navigate('/chat');
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'var(--color-text)',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    backgroundColor: item.id === currentSessionId ? 'var(--color-surface-hover)' : 'transparent'
                                }}
                                title={item.title}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                    <MessageSquare size={18} style={{ minWidth: '18px' }} />
                                    {!isCollapsed && (
                                        <span style={{
                                            textOverflow: 'ellipsis',
                                            overflow: 'hidden',
                                            fontSize: '0.9rem'
                                        }}>
                                            {item.title}
                                        </span>
                                    )}
                                </div>
                                {!isCollapsed && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleArchiveSession(item.id);
                                            }}
                                            title={t('sidebar.archive')}
                                            style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--color-border)',
                                                background: 'var(--color-bg)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-text-muted)'
                                            }}
                                        >
                                            <Archive size={14} />
                                        </button>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleDeleteSession(item.id);
                                            }}
                                            title={t('sidebar.delete')}
                                            style={{
                                                width: '26px',
                                                height: '26px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--color-border)',
                                                background: 'var(--color-bg)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--color-text-muted)'
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {recentSessions.length === 0 && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', paddingLeft: '10px' }}>
                                {t('sidebar.empty')}
                            </div>
                        )}
                    </div>
                )}
                {!isCollapsed && (
                    <div style={{ marginTop: '16px' }}>
                        <button
                            onClick={() => setIsArchiveCollapsed(prev => !prev)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.8rem',
                                color: 'var(--color-text-muted)',
                                marginBottom: '10px',
                                paddingLeft: '6px',
                                background: 'none',
                                border: 'none'
                            }}
                            title={isArchiveCollapsed ? t('sidebar.expandArchive') : t('sidebar.collapseArchive')}
                        >
                            {isArchiveCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            {t('sidebar.archiveFolder')}
                        </button>
                        {!isArchiveCollapsed && (
                            <div style={{ display: 'grid', gap: '8px' }}>
                                <input
                                    className='input'
                                    style={{ width: '100%', fontSize: '0.8rem' }}
                                    placeholder={t('sidebar.archiveSearch')}
                                    value={archiveQuery}
                                    onChange={(event) => setArchiveQuery(event.target.value)}
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {filteredArchivedSessions.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                selectSession(item.id);
                                                navigate('/chat');
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                color: 'var(--color-text)',
                                                justifyContent: 'flex-start',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                backgroundColor: item.id === currentSessionId ? 'var(--color-surface-hover)' : 'transparent'
                                            }}
                                            title={item.title}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                                <MessageSquare size={18} style={{ minWidth: '18px' }} />
                                                <span style={{
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    fontSize: '0.9rem'
                                                }}>
                                                    {item.title}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleRestoreSession(item.id);
                                                    }}
                                                    title={t('sidebar.restore')}
                                                    style={{
                                                        width: '26px',
                                                        height: '26px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--color-border)',
                                                        background: 'var(--color-bg)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--color-text-muted)'
                                                    }}
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteSession(item.id);
                                                    }}
                                                    title={t('sidebar.delete')}
                                                    style={{
                                                        width: '26px',
                                                        height: '26px',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--color-border)',
                                                        background: 'var(--color-bg)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--color-text-muted)'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredArchivedSessions.length === 0 && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', paddingLeft: '10px' }}>
                                            {archiveQuery ? t('sidebar.archiveEmptySearch') : t('sidebar.archiveEmpty')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div style={{
                padding: '20px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: isCollapsed ? 'column' : 'row',
                gap: '10px',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between'
            }}>
                <button
                    onClick={toggleLanguage}
                    title={t('lang.toggle')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
                >
                    <Languages size={20} />
                </button>
                <button
                    onClick={toggleTheme}
                    title={t('theme.toggle')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <Link to="/settings" style={{ color: 'var(--color-text)' }} title={t('nav.settings')}>
                    <Settings size={20} />
                </Link>
            </div>
        </motion.div>
    );
};
