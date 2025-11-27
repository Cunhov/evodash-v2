import React, { useState } from 'react';
import { Save, Server, Key, Shield, Smartphone, CheckSquare, Square, Zap, Globe } from 'lucide-react';
import { EvoConfig } from '../types';
import { saveConfig } from '../services/storage';

interface ConnectionSetupProps {
  onConfigSave: (config: EvoConfig) => void;
}

const ConnectionSetup: React.FC<ConnectionSetupProps> = ({ onConfigSave }) => {
  const [provider, setProvider] = useState<'evolution' | 'uazapi'>('evolution');
  const [mode, setMode] = useState<'global' | 'instance'>('global');
  const [baseUrl, setBaseUrl] = useState('http://localhost:8080');
  const [apiKey, setApiKey] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  // Theme colors based on provider
  const isEvo = provider === 'evolution';
  const accentColor = isEvo ? 'text-emerald-400' : 'text-violet-400';
  const accentBg = isEvo ? 'bg-emerald-500' : 'bg-violet-500';
  const accentBorder = isEvo ? 'border-emerald-500' : 'border-violet-500';
  const focusRing = isEvo ? 'focus:ring-emerald-500' : 'focus:ring-violet-500';
  const buttonHover = isEvo ? 'hover:bg-emerald-500' : 'hover:bg-violet-500';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!baseUrl || !apiKey) {
      setError('Please fill in required fields');
      return;
    }

    if (mode === 'instance' && !instanceName) {
      setError('Instance Name is required for instance login');
      return;
    }

    // Basic URL validation
    try {
      new URL(baseUrl);
    } catch {
      setError('Invalid URL format');
      return;
    }

    // Clean trailing slash
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    const config: EvoConfig = {
      baseUrl: cleanUrl,
      apiKey: apiKey,
      mode: mode,
      instanceName: mode === 'instance' ? instanceName : undefined,
      provider: provider
    };

    if (rememberMe) {
      saveConfig(config);
    }
    
    onConfigSave(config);
  };

  return (
    <div className="h-screen bg-slate-900 overflow-y-auto flex items-center justify-center p-4">
      <div className="w-full max-w-md my-auto">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-500">
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className={`p-4 rounded-full border bg-opacity-10 ${isEvo ? 'bg-emerald-500 border-emerald-500/20' : 'bg-violet-500 border-violet-500/20'}`}>
                {isEvo ? <Server className={`w-12 h-12 ${accentColor}`} /> : <Zap className={`w-12 h-12 ${accentColor}`} />}
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-white mb-2">
              Connect to {isEvo ? 'EvolutionAPI' : 'UazApi'}
            </h2>
            <p className="text-slate-400 text-center mb-6">
              Select your provider and connection method
            </p>

            {/* Provider Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/50 p-1 rounded-lg">
               <button 
                  type="button"
                  onClick={() => setProvider('evolution')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${provider === 'evolution' ? 'bg-slate-700 text-white shadow ring-1 ring-emerald-500/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                  <Globe size={16} className={provider === 'evolution' ? 'text-emerald-400' : ''} /> Evolution
               </button>
               <button 
                  type="button"
                  onClick={() => setProvider('uazapi')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${provider === 'uazapi' ? 'bg-slate-700 text-white shadow ring-1 ring-violet-500/50' : 'text-slate-400 hover:text-slate-200'}`}
               >
                  <Zap size={16} className={provider === 'uazapi' ? 'text-violet-400' : ''} /> UazApi
               </button>
            </div>

            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-900/50 p-1 rounded-lg">
               <button 
                  type="button"
                  onClick={() => setMode('global')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'global' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
               >
                  <Shield size={16} /> Global Admin
               </button>
               <button 
                  type="button"
                  onClick={() => setMode('instance')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'instance' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
               >
                  <Smartphone size={16} /> Single Instance
               </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Server URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Server className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:8080"
                    className={`block w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 ${focusRing} ${isEvo ? 'focus:border-emerald-500' : 'focus:border-violet-500'} text-white placeholder-slate-600 transition-all`}
                  />
                </div>
              </div>

              {mode === 'instance' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Instance Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Smartphone className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      placeholder="MyInstance"
                      className={`block w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 ${focusRing} ${isEvo ? 'focus:border-emerald-500' : 'focus:border-violet-500'} text-white placeholder-slate-600 transition-all`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {mode === 'global' ? 'Global API Key' : 'Instance API Key / Token'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your key here"
                    className={`block w-full pl-10 pr-3 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 ${focusRing} ${isEvo ? 'focus:border-emerald-500' : 'focus:border-violet-500'} text-white placeholder-slate-600 transition-all`}
                  />
                </div>
              </div>

              <div 
                className="flex items-center gap-2 cursor-pointer text-slate-300 select-none"
                onClick={() => setRememberMe(!rememberMe)}
              >
                {rememberMe ? (
                  <CheckSquare size={20} className={isEvo ? "text-emerald-500" : "text-violet-500"} />
                ) : (
                  <Square size={20} className="text-slate-500" />
                )}
                <span className="text-sm">Save credentials for next time</span>
              </div>

              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 ${isEvo ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-violet-600 hover:bg-violet-500'} text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 ${focusRing}`}
              >
                <Save size={18} />
                <span>Connect Dashboard</span>
              </button>
            </form>
          </div>
          <div className="bg-slate-950/50 p-4 text-center text-xs text-slate-500">
            {isEvo ? 'EvolutionAPI v2' : 'UazApi'} Dashboard • Secured locally
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionSetup;