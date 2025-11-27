import React, { createContext, useContext, useState, useCallback } from 'react';

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'request';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
  details?: any;
}

interface LogContextType {
  logs: LogEntry[];
  addLog: (message: string, type?: LogType, details?: any) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogType = 'info', details?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
      details
    };
    
    setLogs(prev => [entry, ...prev].slice(0, 200)); // Keep last 200 logs
  }, []);

  const clearLogs = () => setLogs([]);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogs = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
};
