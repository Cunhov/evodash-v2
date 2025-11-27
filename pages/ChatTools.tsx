
import React, { useState, useEffect } from 'react';
import { Search, Image, Archive, Ban, UserCheck, MessageSquare, AlertCircle } from 'lucide-react';
import { EvoConfig, EvolutionInstance } from '../types';
import { getApiClient } from '../services/apiAdapter';

interface ChatToolsProps { config: EvoConfig; }

const ChatTools: React.FC<ChatToolsProps> = ({ config }) => {
  const api = getApiClient(config);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  
  // Tool States
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const getInstanceName = (item: any): string | null => {
    return item?.instance?.instanceName || item?.instanceName || item?.name || null;
  };

  useEffect(() => {
    if (config.mode === 'instance' && config.instanceName) {
        setInstances([{ instance: { instanceName: config.instanceName } }]);
        setSelectedInstance(config.instanceName);
        return;
    }

    api.fetchInstances()
      .then((data: any) => {
         if(Array.isArray(data)) {
            const valid = data.filter((d: any) => !!getInstanceName(d));
            setInstances(valid);
            if(valid.length > 0) {
                 const first = getInstanceName(valid[0]);
                 if (first) setSelectedInstance(first);
            }
         }
      });
  }, [config]);

  const executeTool = async (fn: () => Promise<any>) => {
      if(!selectedInstance || !phone) return;
      setLoading(true); setResult(null);
      try {
          const data = await fn();
          setResult(data);
      } catch(e: any) { setResult({ error: e.message }); }
      setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold text-white">Chat Utilities</h2>
            <p className="text-slate-400">Manage contacts, verify numbers, and retrieve data.</p>
        </div>
        <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} disabled={config.mode === 'instance'} className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 disabled:opacity-50">
            {instances.map((i, idx) => {
                const name = getInstanceName(i);
                return name ? <option key={idx} value={name}>{name}</option> : null;
            })}
        </select>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <label className="text-sm text-slate-400 mb-2 block">Target Phone Number</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 5511999999999" className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 mb-6" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => executeTool(() => api.checkNumber(selectedInstance, phone))} disabled={loading} className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl hover:bg-slate-700 transition border border-slate-800 hover:border-emerald-500 group">
                  <UserCheck size={32} className="text-emerald-500 mb-3 group-hover:scale-110 transition" />
                  <span className="font-medium text-slate-300">Check Number</span>
              </button>
              <button onClick={() => executeTool(() => api.getProfilePic(selectedInstance, phone))} disabled={loading} className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl hover:bg-slate-700 transition border border-slate-800 hover:border-blue-500 group">
                  <Image size={32} className="text-blue-500 mb-3 group-hover:scale-110 transition" />
                  <span className="font-medium text-slate-300">Profile Pic</span>
              </button>
              <button onClick={() => executeTool(() => api.archiveChat(selectedInstance, phone))} disabled={loading} className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl hover:bg-slate-700 transition border border-slate-800 hover:border-amber-500 group">
                  <Archive size={32} className="text-amber-500 mb-3 group-hover:scale-110 transition" />
                  <span className="font-medium text-slate-300">Archive Chat</span>
              </button>
              <button onClick={() => executeTool(() => api.blockContact(selectedInstance, phone))} disabled={loading} className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-xl hover:bg-slate-700 transition border border-slate-800 hover:border-rose-500 group">
                  <Ban size={32} className="text-rose-500 mb-3 group-hover:scale-110 transition" />
                  <span className="font-medium text-slate-300">Block Contact</span>
              </button>
          </div>
      </div>

      {result && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-lg font-bold text-white mb-4">Result Data</h3>
              {result.profilePictureUrl ? (
                  <div className="text-center">
                      <img src={result.profilePictureUrl} alt="Profile" className="w-32 h-32 rounded-full mx-auto border-4 border-slate-700" />
                      <p className="mt-2 text-emerald-400">Image Found</p>
                  </div>
              ) : (
                  <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              )}
          </div>
      )}
    </div>
  );
};

export default ChatTools;
