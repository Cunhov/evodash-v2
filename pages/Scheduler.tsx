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
    const [listFilter, setListFilter] = useState<'pending' | 'history' | 'draft'>('pending');
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

    // Rich Message States
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [pollName, setPollName] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['Option 1', 'Option 2']);
    const [pixKey, setPixKey] = useState('');
    const [pixAmount, setPixAmount] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');

    // Preview
    const [previewItem, setPreviewItem] = useState<Schedule | null>(null);

    const uploadToStorage = async (file: File): Promise<string> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('schedules')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('schedules')
            .getPublicUrl(filePath);

        return data.publicUrl;
    };

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
        } else if (listFilter === 'draft') {
            query = query.eq('status', 'draft');
        } else {
            query = query.in('status', ['sent', 'failed', 'cancelled']);
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

        setMsgType(schedule.type || 'text');

        // Restore payload data
        const payload = schedule.payload || {};
        if (schedule.type === 'poll') {
            setPollName(payload.name || '');
            setPollOptions(payload.values || ['Option 1', 'Option 2']);
        } else if (schedule.type === 'pix') {
            setPixKey(payload.key || '');
            setPixAmount(payload.amount?.toString() || '');
        } else if (schedule.type === 'contact') {
            const contact = payload.contactMessage?.[0] || {};
            setContactName(contact.fullName || '');
            setContactPhone(contact.phoneNumber || '');
        } else if (schedule.type === 'location') {
            const loc = payload.locationMessage || {};
            setLatitude(loc.latitude?.toString() || '');
            setLongitude(loc.longitude?.toString() || '');
        }

        setView('create');
    };

    const handleDuplicate = (schedule: Schedule) => {
        handleEdit(schedule);
        setEditingId(null); // Clear ID to ensure it creates a new entry
        addLog('Schedule duplicated. You can now edit and save it.', 'info');
    };

    const handleSave = async (targetStatus: 'pending' | 'draft' = 'pending') => {
        if (!selectedInstance || !scheduleDate || !scheduleTime) {
            alert('Please fill all required fields');
            return;
        }

        if (msgType === 'text' && !message) {
            alert('Please enter a message');
            return;
        }

        if (selectedGroupIds.size === 0) {
            alert('Please select at least one group');
            return;
        }

        const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        const now = new Date();

        if (targetStatus === 'pending' && dateTime <= now) {
            alert('Schedule time must be in the future');
            return;
        }

        const groupFilter = JSON.stringify({
            ids: Array.from(selectedGroupIds),
            minSize: filterMinSize
        });

        // Construct Payload
        let payload: any = {};
        let mediaUrl = '';

        if (mediaFile && (msgType === 'media' || msgType === 'audio')) {
            try {
                addLog('Uploading media...', 'info');
                mediaUrl = await uploadToStorage(mediaFile);
            } catch (e: any) {
                addLog(`Failed to upload media: ${e.message}`, 'error');
                alert(`Failed to upload media: ${e.message}`);
                return;
            }
        }

        if (msgType === 'media') {
            const typeStr = mediaFile?.type.split('/')[0] || 'image';
            // Sanitize filename: remove special chars, truncate to 50 chars, preserve extension
            const originalName = mediaFile?.name || 'file';
            const ext = originalName.split('.').pop() || 'png'; // Default to png if no ext
            const name = originalName.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
            const saneFileName = `${name}.${ext}`;

            // Evolution API expects "image" or "video" or "document"
            const mediaType = typeStr === 'video' ? 'video' : 'image';

            payload = {
                mediatype: mediaType,
                mimetype: mediaFile?.type || 'image/png',
                caption: message,
                media: mediaUrl,
                fileName: saneFileName
            };
        } else if (msgType === 'audio') {
            payload = { audio: mediaUrl };
        } else if (msgType === 'poll') {
            payload = {
                name: pollName,
                selectableCount: 1,
                values: pollOptions.filter(o => o.trim() !== '')
            };
        } else if (msgType === 'pix') {
            payload = { key: pixKey, type: 'cpf', amount: parseFloat(pixAmount) || 0 };
        } else if (msgType === 'contact') {
            payload = { contactMessage: [{ fullName: contactName, wuid: contactPhone, phoneNumber: contactPhone }] };
        } else if (msgType === 'location') {
            payload = {
                locationMessage: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    name: 'Location',
                    address: message
                }
            };
        }

        const apiKey = config.apiKey;
        const dbPayload = {
            text: message, // Keep for backward compatibility / display
            enviar_em: dateTime.toISOString(),
            instance: selectedInstance,
            api_key: apiKey,
            group_filter: groupFilter,
            min_size_group: filterMinSize,
            mention_everyone: mentionEveryone,
            status: targetStatus,
            type: msgType,
            payload: payload
        };

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('schedules')
                .update(dbPayload)
                .eq('id', editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('schedules')
                .insert(dbPayload);
            error = insertError;
        }

        if (error) {
            addLog(`Failed to save schedule: ${error.message}`, 'error');
            alert('Failed to save schedule');
        } else {
            addLog(editingId ? 'Schedule updated' : (targetStatus === 'draft' ? 'Draft saved' : 'Schedule created'), 'success');
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
        <div className="max-w-6xl mx-auto space-y-6 p-6">
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

            {/* List View */}
            {view === 'list' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex gap-4">
                        <button onClick={() => setListFilter('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${listFilter === 'pending' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-white'}`}>Scheduled</button>
                        <button onClick={() => setListFilter('draft')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${listFilter === 'draft' ? 'bg-amber-500/10 text-amber-400' : 'text-slate-400 hover:text-white'}`}>Drafts</button>
                        <button onClick={() => setListFilter('history')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${listFilter === 'history' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-white'}`}>History</button>
                        <div className="flex-1" />
                        <button onClick={fetchSchedules} className="p-2 text-slate-400 hover:text-white transition"><RefreshCw size={18} /></button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-900/50 text-xs uppercase font-medium text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">Message</th>
                                    <th className="px-6 py-4">Instance</th>
                                    <th className="px-6 py-4">Scheduled For</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {schedules.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            No {listFilter} schedules found.
                                        </td>
                                    </tr>
                                ) : (
                                    schedules.map((schedule) => (
                                        <tr key={schedule.id} className="hover:bg-slate-700/20 transition">
                                            <td className="px-6 py-4 font-medium text-white truncate max-w-[200px]">{schedule.text || `[${schedule.type}]`}</td>
                                            <td className="px-6 py-4">{schedule.instance}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span>{new Date(schedule.enviar_em).toLocaleDateString()}</span>
                                                    <span className="text-xs text-slate-500">{new Date(schedule.enviar_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {schedule.enviado_em && <span className="text-xs text-emerald-500 mt-1">Sent: {new Date(schedule.enviado_em).toLocaleTimeString()}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                                    ${schedule.status === 'pending' ? 'bg-emerald-500/10 text-emerald-400' :
                                                        schedule.status === 'sent' ? 'bg-blue-500/10 text-blue-400' :
                                                            schedule.status === 'draft' ? 'bg-amber-500/10 text-amber-400' :
                                                                'bg-red-500/10 text-red-400'}`}>
                                                    {schedule.status}
                                                </span>
                                                {schedule.error_message && <div className="text-xs text-red-400 mt-1 max-w-[150px] truncate" title={schedule.error_message}>{schedule.error_message}</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setPreviewItem(schedule)} className="p-2 text-slate-400 hover:text-blue-400 transition" title="View Details">
                                                        <AlertCircle size={16} />
                                                    </button>
                                                    <button onClick={() => handleDuplicate(schedule)} className="p-2 text-slate-400 hover:text-purple-400 transition" title="Duplicate">
                                                        <RefreshCw size={16} />
                                                    </button>
                                                    {(schedule.status === 'pending' || schedule.status === 'draft') && (
                                                        <>
                                                            <button onClick={() => handleEdit(schedule)} className="p-2 text-slate-400 hover:text-emerald-400 transition" title="Edit">
                                                                <FileText size={16} />
                                                            </button>
                                                            <button onClick={() => handleDelete(schedule.id!)} className="p-2 text-slate-400 hover:text-red-400 transition" title="Delete">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create/Edit View */}
            {view === 'create' && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-semibold text-white">{editingId ? 'Edit Schedule' : 'New Schedule'}</h2>
                        <button onClick={() => { setView('list'); setEditingId(null); }} className="text-slate-400 hover:text-white transition">Cancel</button>
                    </div>

                    <div className="space-y-8">
                        {/* Instance Selection */}
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-slate-300">From Instance</label>
                            <div className="relative">
                                <select
                                    value={selectedInstance}
                                    onChange={(e) => setSelectedInstance(e.target.value)}
                                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
                                    disabled={config.mode === 'instance'}
                                >
                                    <option value="">Select an instance...</option>
                                    {instances.map((inst: any) => {
                                        const name = inst.instance?.instanceName || inst.instanceName || inst.name;
                                        return <option key={name} value={name}>{name}</option>;
                                    })}
                                </select>
                            </div>
                        </div>

                        {/* Group Selection */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label className="text-sm font-medium text-slate-300">Select Groups ({selectedGroupIds.size})</label>
                                <button onClick={() => {
                                    if (selectedGroupIds.size === groups.length) setSelectedGroupIds(new Set());
                                    else setSelectedGroupIds(new Set(groups.map(g => g.id)));
                                }} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                                    <CheckCircle size={14} /> Select All
                                </button>
                            </div>

                            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                                <div className="flex gap-4 mb-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search group name..."
                                            value={groupSearch}
                                            onChange={(e) => setGroupSearch(e.target.value)}
                                            className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-slate-400">Min Size:</label>
                                        <input
                                            type="number"
                                            value={filterMinSize}
                                            onChange={(e) => setFilterMinSize(parseInt(e.target.value) || 0)}
                                            className="w-16 bg-slate-800 border-none rounded-lg px-2 py-2 text-sm text-white text-center"
                                        />
                                    </div>
                                </div>

                                <div className="h-64 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {loading ? (
                                        <div className="text-center py-8 text-slate-500">Loading groups...</div>
                                    ) : groups
                                        .filter(g => !groupSearch || g.subject.toLowerCase().includes(groupSearch.toLowerCase()))
                                        .filter(g => (g.size || 0) >= filterMinSize)
                                        .map(group => (
                                            <div
                                                key={group.id}
                                                onClick={() => {
                                                    const newSet = new Set(selectedGroupIds);
                                                    if (newSet.has(group.id)) newSet.delete(group.id);
                                                    else newSet.add(group.id);
                                                    setSelectedGroupIds(newSet);
                                                }}
                                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${selectedGroupIds.has(group.id) ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                                            >
                                                <span className="text-sm text-slate-300 truncate">{group.subject}</span>
                                                <span className="text-xs text-slate-500">{group.size || '?'} mem</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>

                        {/* Message Type */}
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-slate-300">Message Type</label>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {[
                                    { id: 'text', label: 'Text', icon: FileText },
                                    { id: 'media', label: 'Media', icon: Image },
                                    { id: 'audio', label: 'Audio', icon: Music },
                                    { id: 'poll', label: 'Poll', icon: List },
                                    { id: 'pix', label: 'Pix', icon: DollarSign },
                                    { id: 'contact', label: 'Contact', icon: User },
                                    { id: 'location', label: 'Map', icon: MapPin },
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setMsgType(type.id as MessageType)}
                                        className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border min-w-[80px] transition ${msgType === type.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                    >
                                        <type.icon size={20} />
                                        <span className="text-xs font-medium">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dynamic Fields */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                            {(msgType === 'text' || msgType === 'media' || msgType === 'location') && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-slate-400">{msgType === 'location' ? 'Address (Optional)' : 'Message / Caption'}</label>
                                        <button type="button" onClick={() => setShowAiModal(true)} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300"><Sparkles size={12} /> AI Write</button>
                                    </div>
                                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" placeholder={msgType === 'location' ? 'Type address...' : 'Type your message here...'} />
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                {msgType === 'text' && (
                                    <button type="button" onClick={() => setSplitByLines(!splitByLines)} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${splitByLines ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                        <Split size={16} /> <span>Split separate lines</span>
                                    </button>
                                )}
                                <button type="button" onClick={() => setMentionEveryone(!mentionEveryone)} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${mentionEveryone ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                                    <AtSign size={16} /> <span>Mention Everyone</span>
                                </button>
                            </div>

                            {(msgType === 'media' || msgType === 'audio') && (
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Upload File {msgType === 'audio' ? '(MP3/WAV)' : '(Image/Video/Doc)'}</label>
                                    <input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20" />
                                </div>
                            )}

                            {msgType === 'poll' && (
                                <div className="space-y-3">
                                    <input type="text" placeholder="Poll Question" value={pollName} onChange={(e) => setPollName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                    {pollOptions.map((opt, i) => (
                                        <input key={i} type="text" placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => {
                                            const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts);
                                        }} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                    ))}
                                    <button type="button" onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-emerald-400">+ Add Option</button>
                                </div>
                            )}

                            {msgType === 'pix' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Pix Key (CPF/CNPJ/Email)" value={pixKey} onChange={e => setPixKey(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                    <input type="number" placeholder="Amount (0.00)" value={pixAmount} onChange={e => setPixAmount(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                </div>
                            )}

                            {msgType === 'contact' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Full Name" value={contactName} onChange={e => setContactName(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                    <input type="text" placeholder="Phone (e.g. 5511...)" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                </div>
                            )}

                            {msgType === 'location' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="number" placeholder="Latitude" value={latitude} onChange={e => setLatitude(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                    <input type="number" placeholder="Longitude" value={longitude} onChange={e => setLongitude(e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white" />
                                </div>
                            )}
                        </div>

                        {/* Schedule Time */}
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-slate-300">Schedule For</label>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
                                <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => handleSave('draft')} className="flex-1 bg-slate-700 text-white font-medium py-3 rounded-xl hover:bg-slate-600 transition flex items-center justify-center gap-2">
                                <Save size={20} /> Save as Draft
                            </button>
                            <button onClick={() => handleSave('pending')} className="flex-[2] bg-emerald-500 text-white font-medium py-3 rounded-xl hover:bg-emerald-600 transition flex items-center justify-center gap-2">
                                <Calendar size={20} /> Schedule Campaign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {previewItem && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="font-semibold text-white">Message Preview</h3>
                            <button onClick={() => setPreviewItem(null)} className="text-slate-400 hover:text-white"><Plus className="rotate-45" size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    {previewItem.type === 'text' && <FileText size={20} />}
                                    {previewItem.type === 'media' && <Image size={20} />}
                                    {previewItem.type === 'audio' && <Music size={20} />}
                                    {previewItem.type === 'poll' && <List size={20} />}
                                    {previewItem.type === 'pix' && <DollarSign size={20} />}
                                    {previewItem.type === 'contact' && <User size={20} />}
                                    {previewItem.type === 'location' && <MapPin size={20} />}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white capitalize">{previewItem.type} Message</div>
                                    <div className="text-xs text-slate-400">{new Date(previewItem.enviar_em).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300 space-y-2">
                                {previewItem.text && <p className="whitespace-pre-wrap">{previewItem.text}</p>}

                                {previewItem.type === 'poll' && previewItem.payload?.values && (
                                    <div className="space-y-2 mt-2">
                                        <div className="font-medium text-white">{previewItem.payload.name}</div>
                                        {previewItem.payload.values.map((opt: string, i: number) => (
                                            <div key={i} className="bg-slate-700/50 px-3 py-2 rounded text-xs">{opt}</div>
                                        ))}
                                    </div>
                                )}

                                {previewItem.type === 'pix' && (
                                    <div className="text-emerald-400 font-mono bg-emerald-500/10 p-2 rounded text-center">
                                        PIX: {previewItem.payload?.key} <br />
                                        R$ {previewItem.payload?.amount}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 pt-2 border-t border-slate-700/50">
                                <div>
                                    <span className="block text-slate-500 mb-1">Instance</span>
                                    <span className="text-white">{previewItem.instance}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-500 mb-1">Status</span>
                                    <span className={`capitalize ${previewItem.status === 'sent' ? 'text-emerald-400' : 'text-amber-400'}`}>{previewItem.status}</span>
                                </div>
                            </div>
                        </div>
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
