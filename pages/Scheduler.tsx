import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, Save, Trash2, AlertCircle, CheckCircle, RefreshCw, Plus, Search } from 'lucide-react';
import { EvoConfig, Group, Schedule } from '../types';
import { getApiClient } from '../services/apiAdapter';
import { supabase } from '../services/supabaseClient';
import { useLogs } from '../context/LogContext';

interface SchedulerProps {
    config: EvoConfig;
}

const Scheduler: React.FC<SchedulerProps> = ({ config }) => {
    const { addLog } = useLogs();
    const api = getApiClient(config);

    // View Mode
    const [view, setView] = useState<'list' | 'create'>('list');

    // Data
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [instances, setInstances] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);

    // Form State
    const [selectedInstance, setSelectedInstance] = useState('');
    const [message, setMessage] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');

    // Filters
    const [filterName, setFilterName] = useState('');
    const [filterMinSize, setFilterMinSize] = useState(0);
    const [filterAdmin, setFilterAdmin] = useState(false);
    const [mentionEveryone, setMentionEveryone] = useState(false);

    // Loading
    const [loading, setLoading] = useState(false);
    const [previewCount, setPreviewCount] = useState<number | null>(null);

    // Fetch Instances
    useEffect(() => {
        if (config.mode === 'instance' && config.instanceName) {
            setInstances([{ instance: { instanceName: config.instanceName } }]);
            setSelectedInstance(config.instanceName);
        } else {
            api.fetchInstances().then((data: any) => {
                if (Array.isArray(data)) {
                    setInstances(data.filter((d: any) => d?.instance?.instanceName || d?.instanceName));
                }
            });
        }
    }, [config]);

    // Fetch Groups when Instance Changes
    useEffect(() => {
        if (selectedInstance) {
            setLoading(true);
            api.fetchGroups(selectedInstance)
                .then((data: any) => {
                    if (Array.isArray(data)) {
                        setGroups(data);
                    } else {
                        setGroups([]);
                    }
                })
                .finally(() => setLoading(false));
        }
    }, [selectedInstance]);

    // Update Preview Count
    useEffect(() => {
        if (!selectedInstance || groups.length === 0) {
            setPreviewCount(null);
            return;
        }

        const count = groups.filter(g => {
            const nameMatch = !filterName || (g.subject && g.subject.toLowerCase().includes(filterName.toLowerCase()));
            const sizeMatch = (g.size || 0) >= filterMinSize;
            // Admin check would require checking participants, assuming 'owner' or similar property if available, 
            // but standard fetchGroups might not have full participant details unless specified.
            // For now we skip admin check in preview or assume all.
            return nameMatch && sizeMatch;
        }).length;

        setPreviewCount(count);
    }, [groups, filterName, filterMinSize, filterAdmin]);

    // Fetch Schedules
    const fetchSchedules = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .order('enviar_em', { ascending: true });

        if (error) {
            addLog(`Error fetching schedules: ${error.message}`, 'error');
        } else {
            setSchedules(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (view === 'list') fetchSchedules();
    }, [view]);

    const handleSave = async () => {
        if (!selectedInstance || !message || !scheduleDate || !scheduleTime) {
            alert('Please fill all required fields');
            return;
        }

        const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        const now = new Date();

        if (dateTime <= now) {
            alert('Schedule time must be in the future');
            return;
        }

        const groupFilter = JSON.stringify({
            nameContains: filterName,
            adminOnly: filterAdmin
        });

        // Get API Key for the instance (assuming we have it in config or need to fetch it)
        // In 'global' mode, we use the global key. In 'instance' mode, we might need the instance token.
        // For now, we'll store the apiKey from config if available, or empty if it's handled by the worker using global key.
        const apiKey = config.apiKey;

        const { error } = await supabase.from('schedules').insert({
            text: message,
            enviar_em: dateTime.toISOString(),
            instance: selectedInstance,
            api_key: apiKey,
            group_filter: groupFilter,
            min_size_group: filterMinSize,
            mention_everyone: mentionEveryone,
            status: 'pending'
        });

        if (error) {
            addLog(`Failed to save schedule: ${error.message}`, 'error');
            alert('Failed to save schedule');
        } else {
            addLog('Schedule created successfully', 'success');
            setView('list');
            // Reset form
            setMessage('');
            setFilterName('');
            setFilterMinSize(0);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;

        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) {
            addLog(`Failed to delete: ${error.message}`, 'error');
        } else {
            fetchSchedules();
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-white">Message Scheduler</h2>
                    <p className="text-slate-400">Automate your campaigns with precision.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setView('list')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                        <Calendar size={18} /> Calendar
                    </button>
                    <button
                        onClick={() => setView('create')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 ${view === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                        <Plus size={18} /> New Schedule
                    </button>
                </div>
            </div>

            {view === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Clock size={20} /> Schedule Details</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Instance</label>
                                    <select
                                        value={selectedInstance}
                                        onChange={(e) => setSelectedInstance(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3"
                                    >
                                        <option value="">Select Instance</option>
                                        {instances.map((i, idx) => {
                                            const name = i?.instance?.instanceName || i?.instanceName || i?.name;
                                            return name ? <option key={idx} value={name}>{name}</option> : null;
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Date & Time</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 flex-1" />
                                        <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 w-32" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Message Content</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-4"
                                    placeholder="Type your message here..."
                                />
                            </div>

                            <div className="border-t border-slate-700 pt-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><Filter size={20} /> Group Targeting</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Name Contains</label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                                            <input
                                                type="text"
                                                value={filterName}
                                                onChange={e => setFilterName(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-3"
                                                placeholder="e.g. Marketing"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Min. Group Size</label>
                                        <input
                                            type="number"
                                            value={filterMinSize}
                                            onChange={e => setFilterMinSize(parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 mt-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={mentionEveryone} onChange={e => setMentionEveryone(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-emerald-500" />
                                        <span className="text-slate-300">Mention Everyone (@everyone)</span>
                                    </label>
                                    {/* Admin filter not fully supported by simple fetchGroups, but kept as placeholder */}
                                    {/* <label className="flex items-center gap-2 cursor-pointer opacity-50" title="Not available in this version">
                    <input type="checkbox" disabled checked={filterAdmin} onChange={e => setFilterAdmin(e.target.checked)} className="rounded bg-slate-900 border-slate-700" />
                    <span className="text-slate-500">Admin Only (Coming Soon)</span>
                  </label> */}
                                </div>

                                {previewCount !== null && (
                                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                                        <CheckCircle size={16} />
                                        Targeting approximately <strong>{previewCount}</strong> groups based on current filters.
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                            >
                                <Save size={20} /> Schedule Campaign
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                            <h4 className="font-bold text-white mb-4">Tips</h4>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li>• Schedules are executed automatically by the server.</li>
                                <li>• Ensure your instance remains connected.</li>
                                <li>• Large campaigns are sent in batches to avoid bans.</li>
                                <li>• You can edit or cancel pending schedules.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-white">Scheduled Campaigns</h3>
                        <button onClick={fetchSchedules} className="text-slate-400 hover:text-white"><RefreshCw size={18} /></button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-900/50 text-slate-200 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Message</th>
                                    <th className="p-4">Instance</th>
                                    <th className="p-4">Scheduled For</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {schedules.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No schedules found.</td></tr>
                                ) : schedules.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-700/30 transition">
                                        <td className="p-4 max-w-xs truncate" title={s.text}>{s.text}</td>
                                        <td className="p-4">{s.instance}</td>
                                        <td className="p-4">
                                            {new Date(s.enviar_em).toLocaleString()}
                                            {s.enviado_em && <div className="text-xs text-emerald-500">Sent: {new Date(s.enviado_em).toLocaleString()}</div>}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${s.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    s.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
                                                        s.status === 'cancelled' ? 'bg-slate-500/20 text-slate-400' :
                                                            'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                {s.status}
                                            </span>
                                            {s.error_message && <div className="text-xs text-rose-500 mt-1 max-w-xs truncate" title={s.error_message}>{s.error_message}</div>}
                                        </td>
                                        <td className="p-4">
                                            {s.status === 'pending' && (
                                                <button onClick={() => handleDelete(s.id!)} className="text-rose-400 hover:text-rose-300 p-2 rounded hover:bg-rose-500/10">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scheduler;
