import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, Save, Trash2, AlertCircle, CheckCircle, RefreshCw, Plus, Search, FileText, Image, Music, List, DollarSign, User, MapPin, Split, AtSign, Sparkles, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { EvoConfig, Group, Schedule, MessageType } from '../types';
import { getApiClient } from '../services/apiAdapter';
import { supabase } from '../services/supabaseClient';
import { useLogs } from '../context/LogContext';
import { generateMarketingMessage } from '../services/geminiService';

interface SchedulerProps {
    config: EvoConfig;
}

const Scheduler: React.FC<SchedulerProps> = ({ config }) => {
    const { addLog } = useLogs();
    const api = getApiClient(config);

    // View Mode
    const [view, setView] = useState<'list' | 'create'>('list');
    const [listFilter, setListFilter] = useState<'pending' | 'history'>('pending');
    const [editingId, setEditingId] = useState<number | null>(null);

    // Data
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [instances, setInstances] = useState<any[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);

    // Form State
    const [selectedInstance, setSelectedInstance] = useState('');
    const [message, setMessage] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [msgType, setMsgType] = useState<MessageType>('text');

    // Filters & Options
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
    const [groupSearch, setGroupSearch] = useState('');
    const [groupSortSize, setGroupSortSize] = useState(false);
    const [filterMinSize, setFilterMinSize] = useState(0);
    const [mentionEveryone, setMentionEveryone] = useState(false);
    const [splitByLines, setSplitByLines] = useState(false);

    // AI
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');

    // Loading
    const [loading, setLoading] = useState(false);

    // Fetch Instances
    useEffect(() => {
        if (config.mode === 'instance' && config.instanceName) {
            setInstances([{ instance: { instanceName: config.instanceName } }]);
            setSelectedInstance(config.instanceName);
        } else {
            api.fetchInstances().then((data: any) => {
                console.log('Fetched instances:', data);
                if (Array.isArray(data)) {
                    setInstances(data.filter((d: any) => d?.instance?.instanceName || d?.instanceName || d?.name));
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

    // Fetch Schedules
    const fetchSchedules = async () => {
        setLoading(true);
        let query = supabase
            .from('schedules')
            .select('*')
            .order('enviar_em', { ascending: true });

        if (listFilter === 'pending') {
            query = query.eq('status', 'pending');
        } else {
            query = query.neq('status', 'pending');
        }

        const { data, error } = await query;

        if (error) {
            addLog(`Error fetching schedules: ${error.message}`, 'error');
        } else {
            setSchedules(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (view === 'list') fetchSchedules();
    }, [view, listFilter]);

    const handleEdit = (schedule: Schedule) => {
        setEditingId(schedule.id || null);
        setSelectedInstance(schedule.instance);
        setMessage(schedule.text);

        const dateObj = new Date(schedule.enviar_em);
        setScheduleDate(dateObj.toISOString().split('T')[0]);
        setScheduleTime(dateObj.toTimeString().slice(0, 5));

        setMentionEveryone(schedule.mention_everyone || false);
        setFilterMinSize(schedule.min_size_group || 0);

        // Parse group filter to restore selection if possible
        try {
            const filter = JSON.parse(schedule.group_filter || '{}');
            if (filter.ids && Array.isArray(filter.ids)) {
                setSelectedGroupIds(new Set(filter.ids));
            }
        } catch (e) {
            // Ignore parse error
        }

        setView('create');
    };

    const handleSave = async () => {
        if (!selectedInstance || !message || !scheduleDate || !scheduleTime) {
            alert('Please fill all required fields');
            return;
        }

        if (selectedGroupIds.size === 0) {
            alert('Please select at least one group');
            return;
        }

        const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        const now = new Date();

        if (dateTime <= now) {
            alert('Schedule time must be in the future');
            return;
        }

        const groupFilter = JSON.stringify({
            ids: Array.from(selectedGroupIds),
            minSize: filterMinSize
        });

        const apiKey = config.apiKey;
        const payload = {
            text: message,
            enviar_em: dateTime.toISOString(),
            instance: selectedInstance,
            api_key: apiKey,
            group_filter: groupFilter,
            min_size_group: filterMinSize,
            mention_everyone: mentionEveryone,
            status: 'pending'
        };

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('schedules')
                .update(payload)
                .eq('id', editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('schedules')
                .insert(payload);
            error = insertError;
        }

        if (error) {
            addLog(`Failed to save schedule: ${error.message}`, 'error');
            alert('Failed to save schedule');
        } else {
            addLog(editingId ? 'Schedule updated' : 'Schedule created', 'success');
            setView('list');
            setEditingId(null);
            setMessage('');
            setSelectedGroupIds(new Set());
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) addLog(`Failed to delete: ${error.message}`, 'error');
        else fetchSchedules();
    };

    const handleAiGenerate = async () => {
        addLog('Generating AI content...', 'info');
        const txt = await generateMarketingMessage(aiPrompt, 'casual', 200);
        if (txt.startsWith('Error')) {
            addLog(txt, 'error');
        } else {
            setMessage(txt);
            addLog('AI Content generated', 'success');
        }
        setShowAiModal(false);
    };

    const filteredGroups = groups
        .filter(g => g.subject?.toLowerCase().includes(groupSearch.toLowerCase()))
        .sort((a, b) => groupSortSize ? (b.size || 0) - (a.size || 0) : (a.subject || '').localeCompare(b.subject || ''));

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white">Scheduler</h2>
                    <p className="text-slate-400">Plan and automate your campaigns.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setView('list'); setEditingId(null); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Calendar size={18} /> Calendar
                    </button>
                    <button onClick={() => { setView('create'); setEditingId(null); setMessage(''); setSelectedGroupIds(new Set()); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 ${view === 'create' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Plus size={18} /> New Schedule
                    </button>
                </div>
            </div>

            {view === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden p-6 space-y-6">

                            {/* Instance Selector */}
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">From Instance</label>
                                <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} disabled={config.mode === 'instance'} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 disabled:opacity-50">
                                    <option value="">Select Instance</option>
                                    {instances.map((i, idx) => {
                                        const name = i?.instance?.instanceName || i?.instanceName || i?.name;
                                        return name ? <option key={idx} value={name}>{name}</option> : null;
                                    })}
                                </select>
                            </div>

                            {/* Group Selection (Messenger Style) */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs uppercase font-bold text-slate-500 block">Select Groups ({selectedGroupIds.size})</label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setGroupSortSize(!groupSortSize)} className={`p-1 rounded ${groupSortSize ? 'text-emerald-400' : 'text-slate-500'}`} title="Sort by Size"><ArrowUpDown size={14} /></button>
                                        <button type="button" onClick={() => {
                                            if (selectedGroupIds.size === filteredGroups.length) setSelectedGroupIds(new Set());
                                            else setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)));
                                        }} className="text-xs text-blue-400 hover:text-blue-300">
                                            {selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0 ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                    <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Search group name..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                                </div>

                                <div className="h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-1">
                                    {filteredGroups.length === 0 ? (
                                        <div className="text-center text-slate-500 text-sm py-4">No groups found</div>
                                    ) : filteredGroups.map(g => (
                                        <div key={g.id} onClick={() => {
                                            const newSet = new Set(selectedGroupIds);
                                            if (newSet.has(g.id)) newSet.delete(g.id); else newSet.add(g.id);
                                            setSelectedGroupIds(newSet);
                                        }} className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center group ${selectedGroupIds.has(g.id) ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:bg-slate-800 border border-transparent'}`}>
                                            <span className="truncate flex-1 pr-2">{g.subject}</span>
                                            <span className="text-xs text-slate-500 group-hover:text-slate-400 whitespace-nowrap">{g.size || 0} mem</span>
                                        </div>
                                    ))}
                                </div>
                                {selectedGroupIds.size === 0 && (
                                    <div className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> Select at least one group to send</div>
                                )}
                            </div>

                            {/* Message Type Selector */}
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Message Type</label>
                                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                                    {[
                                        { id: 'text', icon: <FileText size={18} />, label: 'Text' },
                                        { id: 'media', icon: <Image size={18} />, label: 'Media' },
                                        { id: 'audio', icon: <Music size={18} />, label: 'Audio' },
                                        { id: 'poll', icon: <List size={18} />, label: 'Poll' },
                                        { id: 'pix', icon: <DollarSign size={18} />, label: 'Pix' },
                                        { id: 'contact', icon: <User size={18} />, label: 'Contact' },
                                        { id: 'location', icon: <MapPin size={18} />, label: 'Map' }
                                    ].map(t => (
                                        <button key={t.id} type="button" onClick={() => setMsgType(t.id as MessageType)} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition ${msgType === t.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {t.icon}
                                            <span className="text-xs mt-1">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message Content */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-slate-400">Message / Caption</label>
                                    <button type="button" onClick={() => setShowAiModal(true)} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300"><Sparkles size={12} /> AI Write</button>
                                </div>
                                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" placeholder="Type your message here..." />

                                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                    <button type="button" onClick={() => setSplitByLines(!splitByLines)} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${splitByLines ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        <Split size={16} /> <span>Split separate lines</span>
                                    </button>
                                    <button type="button" onClick={() => setMentionEveryone(!mentionEveryone)} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${mentionEveryone ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        <AtSign size={16} /> <span>Mention Everyone</span>
                                    </button>
                                </div>
                            </div>

                            {/* Schedule Time */}
                            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Schedule For</label>
                                <div className="flex gap-4">
                                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 flex-1" />
                                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 w-32" />
                                </div>
                            </div>

                            <button onClick={handleSave} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                                <Save size={20} /> {editingId ? 'Update Schedule' : 'Schedule Campaign'}
                            </button>
                        </div>
                    </div>

                    {/* Sidebar / Tips */}
                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                            <h4 className="font-bold text-white mb-4">Tips</h4>
                            <ul className="space-y-2 text-sm text-slate-400">
                                <li>• Schedules are executed automatically by the server.</li>
                                <li>• Ensure your instance remains connected.</li>
                                <li>• Large campaigns are sent in batches.</li>
                                <li>• Timezone is set to Server Time.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* List View */}
            {view === 'list' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => setListFilter('pending')} className={`px-3 py-1 rounded text-sm font-medium ${listFilter === 'pending' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Scheduled</button>
                            <button onClick={() => setListFilter('history')} className={`px-3 py-1 rounded text-sm font-medium ${listFilter === 'history' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-white'}`}>History</button>
                        </div>
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
                                    <tr><td colSpan={5} className="p-8 text-center text-slate-500">No {listFilter} schedules found.</td></tr>
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
                                        <td className="p-4 flex gap-2">
                                            {s.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleEdit(s)} className="text-blue-400 hover:text-blue-300 p-2 rounded hover:bg-blue-500/10" title="Edit">
                                                        <FileText size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(s.id!)} className="text-rose-400 hover:text-rose-300 p-2 rounded hover:bg-rose-500/10" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* AI Modal */}
            {showAiModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
                        <h3 className="text-white font-bold mb-4">AI Assistant</h3>
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe your message..." className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white mb-4" rows={4} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAiModal(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                            <button onClick={handleAiGenerate} className="px-4 py-2 bg-purple-600 text-white rounded">Generate</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Scheduler;
