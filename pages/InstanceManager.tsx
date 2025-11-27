
import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Smartphone, Trash2, Power, WifiOff, Loader2, AlertTriangle, Settings, X, Check } from 'lucide-react';
import { EvoConfig, ProxyConfig } from '../types';
import { useLogs } from '../context/LogContext';
import { getApiClient } from '../services/apiAdapter';

interface InstanceManagerProps {
  config: EvoConfig;
}

const InstanceManager: React.FC<InstanceManagerProps> = ({ config }) => {
  const { addLog } = useLogs();
  const api = getApiClient(config);

  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, string>>({});
  
  // Settings Modal State
  const [settingsInstance, setSettingsInstance] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'proxy' | 'presence' | 'behavior'>('presence');
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({ host: '', port: 80, protocol: 'http' });

  const headers = {
    'apikey': config.apiKey,
    'Content-Type': 'application/json'
  };

  const getInstanceName = (item: any): string | null => {
    return item?.instance?.instanceName || item?.instanceName || item?.name || null;
  };

  const getProfileName = (item: any): string => {
    return item?.instance?.profileName || item?.profileName || 'Unknown';
  };

  const fetchInstances = async () => {
    setLoading(true);
    setError(null);
    addLog('Fetching instances...', 'info');
    
    // If in single instance mode, we don't fetch list. We construct it manually.
    if (config.mode === 'instance' && config.instanceName) {
        setInstances([{ instance: { instanceName: config.instanceName, profileName: 'Current Instance' } }]);
        fetchStatus(config.instanceName);
        setLoading(false);
        addLog('Loaded single instance config', 'success');
        return;
    }

    try {
      const data = await api.fetchInstances();
      
      if (Array.isArray(data)) {
        const validInstances = data.filter((item: any) => !!getInstanceName(item));
        setInstances(validInstances);
        addLog(`Fetched ${validInstances.length} instances`, 'success');
        validInstances.forEach((inst: any) => {
             const name = getInstanceName(inst);
             if (name) fetchStatus(name);
        });
      } else {
        setInstances([]);
        addLog('No instances found', 'warning');
      }
    } catch (error: any) {
      console.error(error);
      setError(`Could not connect to ${config.provider === 'uazapi' ? 'UazApi' : 'EvolutionAPI'}.`);
      addLog(`Failed to fetch instances: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async (instanceName: string) => {
    try {
      const data = await api.fetchConnectionState(instanceName);
      setConnectionStatus(prev => ({ ...prev, [instanceName]: data?.instance?.state || data?.state || 'unknown' }));
    } catch {
      setConnectionStatus(prev => ({ ...prev, [instanceName]: 'error' }));
    }
  };

  const createInstance = async () => {
    if (!newInstanceName) return;
    addLog(`Creating instance: ${newInstanceName}`, 'request');
    try {
      const res = await api.createInstance(newInstanceName);
      if(res.ok) {
          addLog('Instance created successfully', 'success');
          setNewInstanceName('');
          fetchInstances();
      } else {
          addLog('Failed to create instance', 'error', await res.text());
      }
    } catch (error: any) {
      alert("Failed to create instance");
      addLog(`Error creating instance: ${error.message}`, 'error');
    }
  };

  const connectInstance = async (instanceName: string) => {
    setSelectedInstance(instanceName);
    setQrCode(null);
    addLog(`Connecting ${instanceName}...`, 'request');
    try {
      const data = await api.connectInstance(instanceName);
      if (data.base64) {
          setQrCode(data.base64);
          addLog('QR Code received', 'success');
      } else if (data?.instance?.state === 'open' || data?.state === 'open') {
        alert("Already connected!");
        addLog('Instance already connected', 'warning');
        fetchStatus(instanceName);
        setSelectedInstance(null);
      }
    } catch (e: any) {
      alert("Connection error");
      addLog(`Connection error: ${e.message}`, 'error');
    }
  };

  const logoutInstance = async (instanceName: string) => {
    if(!window.confirm(`Logout ${instanceName}?`)) return;
    addLog(`Logging out ${instanceName}`, 'warning');
    try {
      await api.logoutInstance(instanceName);
      addLog('Logout command sent', 'success');
      setTimeout(() => fetchStatus(instanceName), 1000);
    } catch (e: any) { console.error(e); addLog(`Logout error: ${e.message}`, 'error'); }
  };

  const deleteInstance = async (instanceName: string) => {
    if(!window.confirm(`Delete ${instanceName}? This action is irreversible.`)) return;
    addLog(`Deleting ${instanceName}`, 'warning');
    try {
      await api.deleteInstance(instanceName);
      addLog('Delete command sent', 'success');
      setTimeout(fetchInstances, 1000);
    } catch (e: any) { console.error(e); addLog(`Delete error: ${e.message}`, 'error'); }
  };

  const setPresence = async (presence: string) => {
    if (!settingsInstance) return;
    addLog(`Setting presence to ${presence} for ${settingsInstance}`, 'request');
    try {
      await fetch(`${config.baseUrl}/chat/sendPresence/${settingsInstance}`, {
        method: 'POST', headers, body: JSON.stringify({ presence })
      });
      alert(`Presence set to ${presence}`);
      addLog('Presence updated', 'success');
    } catch (e: any) { alert("Failed to set presence"); addLog(`Presence error: ${e.message}`, 'error'); }
  };

  const saveProxy = async () => {
    if (!settingsInstance) return;
    addLog(`Saving proxy for ${settingsInstance}`, 'request');
    try {
        await fetch(`${config.baseUrl}/instance/setProxy/${settingsInstance}`, {
            method: 'POST', headers, body: JSON.stringify({ proxy: proxyConfig })
        });
        alert("Proxy configuration updated");
        addLog('Proxy config updated', 'success');
    } catch(e: any) { alert("Failed to set proxy"); addLog(`Proxy error: ${e.message}`, 'error'); }
  };

  useEffect(() => { fetchInstances(); }, [config]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Instances</h2>
          <p className="text-slate-400">Manage connections, behavior, and presence.</p>
        </div>
        <button onClick={fetchInstances} className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400">
            <AlertTriangle size={20} /> <span>{error}</span>
        </div>
      )}

      {/* Create Instance - Only in Global Mode */}
      {config.mode === 'global' && (
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex gap-4 items-center">
            <input 
              type="text" value={newInstanceName} onChange={(e) => setNewInstanceName(e.target.value)}
              placeholder="Instance Name (e.g. SalesBot)"
              className="flex-1 bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            <button onClick={createInstance} disabled={!newInstanceName} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition disabled:opacity-50">
              <Plus size={18} /> <span>Create</span>
            </button>
          </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instances.map((item, idx) => {
            const name = getInstanceName(item);
            if (!name) return null;
            const status = connectionStatus[name] || 'unknown';
            const isConnected = status === 'open';

            return (
                <div key={idx} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg flex flex-col">
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-900 rounded-lg">
                                <Smartphone className={isConnected ? "text-emerald-400" : "text-slate-500"} size={24} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setSettingsInstance(name)} className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-700 rounded transition">
                                    <Settings size={16} />
                                </button>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                    {status}
                                </span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1 truncate">{name}</h3>
                        <p className="text-slate-400 text-sm mb-6 truncate">Profile: {getProfileName(item)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-4 border-t border-slate-700 grid grid-cols-2 gap-3">
                         {isConnected ? (
                            <button onClick={() => logoutInstance(name)} className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-700 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-sm transition">
                                <Power size={16} /> <span>Logout</span>
                            </button>
                         ) : (
                            <button onClick={() => connectInstance(name)} className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm transition">
                                <WifiOff size={16} /> <span>Connect</span>
                            </button>
                         )}
                         {config.mode === 'global' ? (
                             <button onClick={() => deleteInstance(name)} className="flex items-center justify-center gap-2 py-2 px-3 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-sm transition">
                                <Trash2 size={16} /> <span>Delete</span>
                             </button>
                         ) : (
                             <div /> // Placeholder to keep grid layout or remove if desired
                         )}
                    </div>
                </div>
            );
        })}
      </div>

      {/* QR Code Modal */}
      {selectedInstance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full relative">
                  <button onClick={() => { setSelectedInstance(null); setQrCode(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                      <X size={24} /> 
                  </button>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Scan QR Code</h3>
                  <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 mt-4">
                      {qrCode ? <img src={qrCode} alt="QR Code" className="w-full h-full object-contain" /> : <Loader2 className="animate-spin text-gray-400" size={32} />}
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal */}
      {settingsInstance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
                      <h3 className="text-xl font-bold text-white">Settings: {settingsInstance}</h3>
                      <button onClick={() => setSettingsInstance(null)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-full transition">
                        <X size={24} />
                      </button>
                  </div>
                  
                  <div className="flex border-b border-slate-700 shrink-0">
                      <button onClick={() => setSettingsTab('presence')} className={`flex-1 py-3 text-sm font-medium transition ${settingsTab === 'presence' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-700/50'}`}>Presence</button>
                      <button onClick={() => setSettingsTab('proxy')} className={`flex-1 py-3 text-sm font-medium transition ${settingsTab === 'proxy' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800' : 'text-slate-400 hover:bg-slate-700/50'}`}>Proxy</button>
                  </div>

                  <div className="p-6 overflow-y-auto">
                      {settingsTab === 'presence' && (
                          <div className="space-y-4">
                              <p className="text-sm text-slate-400">Set the online status for this instance.</p>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setPresence('available')} className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium">Available</button>
                                  <button onClick={() => setPresence('unavailable')} className="p-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 font-medium">Unavailable</button>
                                  <button onClick={() => setPresence('composing')} className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 font-medium">Typing...</button>
                                  <button onClick={() => setPresence('recording')} className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 font-medium">Recording...</button>
                              </div>
                          </div>
                      )}

                      {settingsTab === 'proxy' && (
                          <div className="space-y-4">
                               <div className="grid grid-cols-3 gap-3">
                                   <div className="col-span-2">
                                       <label className="text-xs text-slate-400 mb-1 block">Host</label>
                                       <input type="text" value={proxyConfig.host} onChange={e => setProxyConfig({...proxyConfig, host: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                                   </div>
                                   <div>
                                       <label className="text-xs text-slate-400 mb-1 block">Port</label>
                                       <input type="number" value={proxyConfig.port} onChange={e => setProxyConfig({...proxyConfig, port: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                                   </div>
                               </div>
                               <button onClick={saveProxy} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2">
                                 <Check size={16} /> Save Proxy
                               </button>
                          </div>
                      )}
                  </div>
                  
                  <div className="p-4 border-t border-slate-700 bg-slate-900/50 shrink-0">
                    <button onClick={() => setSettingsInstance(null)} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition font-medium">
                      Done
                    </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InstanceManager;
