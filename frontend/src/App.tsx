import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';

const QAWorkbench = lazy(() => import('./pages/QAWorkbench'));
const Settings = lazy(() => import('./pages/Settings'));
const Documents = lazy(() => import('./pages/Documents'));
const EvidenceGraph = lazy(() => import('./pages/EvidenceGraph'));
const Chat = lazy(() => import('./pages/Chat'));
const IndexManager = lazy(() => import('./pages/IndexManager'));
const Evaluation = lazy(() => import('./pages/Evaluation'));
const SystemStatus = lazy(() => import('./pages/SystemStatus'));
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'));
const ThoughtChainManager = lazy(() => import('./pages/ThoughtChainManager'));

function App() {
  return (
    <Suspense fallback={<div style={{ padding: '32px' }}>Loading...</div>}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/qa" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="qa" element={<QAWorkbench />} />
          <Route path="settings" element={<Settings />} />
          <Route path="docs" element={<Documents />} />
          <Route path="docs/:id" element={<DocumentDetail />} />
          <Route path="index" element={<IndexManager />} />
          <Route path="graph" element={<EvidenceGraph />} />
          <Route path="eval" element={<Evaluation />} />
          <Route path="status" element={<SystemStatus />} />
          <Route path="chains" element={<ThoughtChainManager />} />
          <Route path="*" element={<Navigate to="/qa" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
