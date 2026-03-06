import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageTransition } from '../ui/PageTransition';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const MainLayout: React.FC = () => {
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="layout-container" style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            overflow: 'hidden'
        }}>
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                minWidth: 0,
                minHeight: 0
            }}>
                <TopBar />
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <AnimatePresence mode="wait" initial={false}>
                    <PageTransition key={location.pathname}>
                        <Outlet />
                    </PageTransition>
                </AnimatePresence>
                </div>
            </main>
        </div>
    );
};
