import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import QAWorkbench from './pages/QAWorkbench';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import EvidenceGraph from './pages/EvidenceGraph';
import Chat from './pages/Chat';
import IndexManager from './pages/IndexManager';
import Evaluation from './pages/Evaluation';
import SystemStatus from './pages/SystemStatus';
import DocumentDetail from './pages/DocumentDetail';
import ThoughtChainManager from './pages/ThoughtChainManager';

function App() {
  return (
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
  );
}

export default App;
