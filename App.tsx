import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ConnectionSetup from './pages/ConnectionSetup';
import InstanceManager from './pages/InstanceManager';
import GroupManager from './pages/GroupManager';
import MessageSender from './pages/MessageSender';
import { EvoConfig } from './types';
import { getStoredConfig } from './services/storage';
import { LogProvider } from './context/LogContext';

const App: React.FC = () => {
  const [config, setConfig] = useState<EvoConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredConfig();
    if (stored) {
      setConfig(stored);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  // Wraps content in LogProvider
  const Content = () => {
     if (!config) {
       return <ConnectionSetup onConfigSave={setConfig} />;
     }

     return (
       <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/instances" replace />} />
            <Route path="/instances" element={<InstanceManager config={config} />} />
            <Route path="/groups" element={<GroupManager config={config} />} />
            <Route path="/send" element={<MessageSender config={config} />} />
            <Route path="*" element={<Navigate to="/instances" replace />} />
          </Routes>
        </Layout>
      </Router>
     );
  }

  return (
    <LogProvider>
       <Content />
    </LogProvider>
  );
};

export default App;