import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ConnectionSetup from './pages/ConnectionSetup';
import InstanceManager from './pages/InstanceManager';
import GroupManager from './pages/GroupManager';
import MessageSender from './pages/MessageSender';
import Scheduler from './pages/Scheduler';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { EvoConfig } from './types';
import { getConfig, saveConfig } from './services/configService';
import { LogProvider } from './context/LogContext';
import { AuthProvider, useAuth } from './context/AuthContext';

const AppRoutes: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<EvoConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      if (user) {
        const stored = await getConfig();
        setConfig(stored);
      }
      setConfigLoading(false);
    };

    if (!authLoading) {
      loadConfig();
    }
  }, [user, authLoading]);

  if (authLoading || (user && configLoading)) {
    return <div className="h-screen bg-slate-900 flex items-center justify-center text-white">Loading Evodash...</div>;
  }

  const handleConfigSave = async (newConfig: EvoConfig) => {
    setConfig(newConfig);
    await saveConfig(newConfig);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />

        <Route path="/*" element={
          !user ? <Navigate to="/login" replace /> :
            !config ? <ConnectionSetup onConfigSave={handleConfigSave} /> :
              <Layout config={config}>
                <Routes>
                  <Route path="/" element={<Dashboard config={config} />} />
                  <Route path="/dashboard" element={<Dashboard config={config} />} />
                  <Route path="/instances" element={<InstanceManager config={config} />} />
                  <Route path="/groups" element={<GroupManager config={config} />} />
                  <Route path="/send" element={<MessageSender config={config} />} />
                  <Route path="/scheduler" element={<Scheduler config={config} />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
        } />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <LogProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LogProvider>
  );
};

export default App;