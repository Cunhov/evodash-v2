import React, { useState } from 'react';
import { Play, Code, Trash2, Save, Terminal, Copy, Check } from 'lucide-react';
import { EvoConfig } from '../types';
import { useLogs } from '../context/LogContext';

interface ApiTesterProps {
  config: EvoConfig;
}

const ApiTester: React.FC<ApiTesterProps> = ({ config }) => {
  const { addLog } = useLogs();
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/instance/fetchInstances');
  const [body, setBody] = useState('{\n  \n}');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    try {
        const headers: Record<string, string> = {
            'apikey': config.apiKey,
            'Content-Type': 'application/json'
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (method !== 'GET' && method !== 'HEAD') {
            try {
                // Validate JSON
                JSON.parse(body);
                options.body = body;
            } catch (e) {
                alert('Invalid JSON Body. Please ensure it is correctly formatted.');
                addLog('API Tester: Invalid JSON Body', 'error');
                setLoading(false);
                return;
            }
        }

        const url = `${config.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        
        addLog(`Executing ${method} ${url}`, 'request', method !== 'GET' ? { body: JSON.parse(body) } : undefined);

        const res = await fetch(url, options);
        setStatus(res.status);
        
        const contentType = res.headers.get("content-type");
        let resultData;

        if (contentType && contentType.indexOf("application/json") !== -1) {
             const data = await res.json();
             resultData = JSON.stringify(data, null, 2);
        } else {
             const text = await res.text();
             resultData = text;
        }
        
        setResponse(resultData);

        if (res.ok) {
            addLog(`API Request Successful (Status: ${res.status})`, 'success');
        } else {
            addLog(`API Request Failed (Status: ${res.status})`, 'error', resultData);
        }

    } catch (e: any) {
        setResponse(`Error: ${e.message}`);
        addLog(`API Tester Error: ${e.message}`, 'error');
    } finally {
        setLoading(false);
    }
  };

  const formatJson = () => {
      try {
          const obj = JSON.parse(body);
          setBody(JSON.stringify(obj, null, 2));
      } catch {
          alert('Invalid JSON, cannot format.');
      }
  };

  const copyResponse = () => {
      if (response) {
          navigator.clipboard.writeText(response);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Terminal className="text-emerald-400" />
            API Playground
        </h2>
        <p className="text-slate-400">Interact directly with any EvolutionAPI endpoint.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Panel */}
        <div className="space-y-4">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg h-full">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Code size={18} className="text-blue-400" />
                    Request Configuration
                </h3>
                
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <select 
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PUT">PUT</option>
                        </select>
                        <div className="flex-1 relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                                {config.baseUrl}
                             </div>
                             <input 
                                type="text"
                                value={endpoint}
                                onChange={(e) => setEndpoint(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-3 pr-4 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="/message/sendText/instance"
                             />
                        </div>
                    </div>

                    {method !== 'GET' && method !== 'HEAD' && (
                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-2">
                                <span>JSON Payload</span>
                                <button onClick={formatJson} className="hover:text-blue-400 transition">Format JSON</button>
                            </div>
                            <textarea 
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-emerald-300 rounded-lg p-4 font-mono text-sm h-64 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    )}

                    <button 
                        onClick={handleSend}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                        {loading ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Play size={18} fill="currentColor" />}
                        <span>Execute Request</span>
                    </button>
                </div>
            </div>
        </div>

        {/* Response Panel */}
        <div className="space-y-4">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Terminal size={18} className="text-emerald-400" />
                        Server Response
                    </h3>
                    <div className="flex items-center gap-3">
                        {status && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${status >= 200 && status < 300 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                Status: {status}
                            </span>
                        )}
                        {response && (
                             <button onClick={copyResponse} className="text-slate-400 hover:text-white transition">
                                 {copied ? <Check size={16} /> : <Copy size={16} />}
                             </button>
                        )}
                    </div>
                </div>
                
                <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4 overflow-auto max-h-[600px] relative group min-h-[300px]">
                    {response ? (
                        <pre className="text-xs md:text-sm font-mono text-emerald-300 whitespace-pre-wrap break-all">
                            {response}
                        </pre>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <Code size={48} className="mb-2 opacity-20" />
                            <span className="text-sm">Response data will appear here...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ApiTester;