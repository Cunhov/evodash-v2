import React, { useState } from 'react';
import { Terminal, X, ChevronRight, Trash2, Activity, Maximize2, Minimize2 } from 'lucide-react';
import { useLogs, LogType } from '../context/LogContext';

const ConsoleLogger: React.FC = () => {
  const { logs, clearLogs } = useLogs();
  const [isOpen, setIsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  const getTypeColor = (type: LogType) => {
    switch (type) {
      case 'error': return 'text-rose-400';
      case 'success': return 'text-emerald-400';
      case 'warning': return 'text-amber-400';
      case 'request': return 'text-blue-400';
      default: return 'text-slate-300';
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-slate-800 text-emerald-400 p-3 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 transition-all"
        title="Open Console"
      >
        <Terminal size={24} />
        {logs.length > 0 && logs[0].type === 'error' && (
           <span className="absolute -top-1 -right-1 flex h-3 w-3">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
           </span>
        )}
      </button>
    );
  }

  return (
    <div 
      className={`fixed top-16 right-0 bottom-0 z-40 bg-slate-950/95 backdrop-blur shadow-2xl border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out
      ${isMaximized ? 'w-[800px] max-w-full' : 'w-80 md:w-96'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-emerald-500" />
          <span className="text-sm font-bold font-mono text-slate-200">System Logs</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={clearLogs} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition" 
            title="Clear Logs"
          >
            <Trash2 size={14} />
          </button>
          <button 
            onClick={() => setIsMaximized(!isMaximized)} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
            title="Minimize"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Log Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-600 text-center mt-10 italic">No logs yet...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="border-b border-slate-800/50 pb-2 mb-2 last:border-0 hover:bg-slate-900/30 p-2 rounded transition">
              <div className="flex justify-between items-start mb-1">
                <span className={`font-bold uppercase tracking-wider ${getTypeColor(log.type)}`}>{log.type}</span>
                <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
              </div>
              <div className="text-slate-300 break-words whitespace-pre-wrap leading-relaxed">
                {log.message}
              </div>
              {log.details && (
                <div className="mt-2 p-2 bg-slate-900 rounded border border-slate-800 text-slate-400 overflow-x-auto">
                   <pre className="text-[10px]">{typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsoleLogger;