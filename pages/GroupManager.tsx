
import React, { useState, useEffect } from 'react';
import { Users, Search, Link as LinkIcon, LogOut, PlusCircle, LayoutGrid, List, Trash2, CheckSquare, Square, X, AlertTriangle } from 'lucide-react';
import { EvoConfig, Group } from '../types';
import { useLogs } from '../context/LogContext';
import { useGroupCache } from '../context/GroupCacheContext';
import { getApiClient } from '../services/apiAdapter';
import { supabase } from '../services/supabaseClient';
import { Calendar, Layers, Clock, Settings, Edit, Image as ImageIcon, AlignLeft, RefreshCw } from 'lucide-react';
import * as uuid from 'uuid';

interface GroupManagerProps { config: EvoConfig; }

const GroupManager: React.FC<GroupManagerProps> = ({ config }) => {
    const { addLog } = useLogs();
    const api = getApiClient(config);

    const [instances, setInstances] = useState<any[]>([]);
    const [selectedInstance, setSelectedInstance] = useState('');
    // Data
    const { groups: cachedGroups, getGroups, refreshGroups } = useGroupCache();
    // Derive groups from cache
    const groups = React.useMemo(() => {
        return selectedInstance ? getGroups(selectedInstance) : [];
    }, [selectedInstance, cachedGroups]);

    // Refresh on instance change
    useEffect(() => {
        if (selectedInstance) refreshGroups(selectedInstance);
    }, [selectedInstance]);

    const [loading, setLoading] = useState(false);

    // Filter & View Stats
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortMode, setSortMode] = useState<'name_asc' | 'name_desc' | 'size_asc' | 'size_desc'>('name_asc');

    // Selection
    const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupSubject, setNewGroupSubject] = useState('');
    const [newGroupParticipants, setNewGroupParticipants] = useState(''); // Comma separated numbers

    // Detailed View State
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [inviteInfo, setInviteInfo] = useState<{ code: string, link: string } | null>(null);
    const [editingSubject, setEditingSubject] = useState(false);
    const [tempSubject, setTempSubject] = useState('');
    const [editingDesc, setEditingDesc] = useState(false);
    const [tempDesc, setTempDesc] = useState('');
    const [addingParticipant, setAddingParticipant] = useState(false);
    const [newParticipantNumber, setNewParticipantNumber] = useState('');

    // Bulk Action State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkAction, setBulkAction] = useState<'subject' | 'description' | 'picture' | 'settings'>('subject');
    const [bulkSubject, setBulkSubject] = useState('');
    const [bulkDescription, setBulkDescription] = useState('');
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkSettingsActions, setBulkSettingsActions] = useState<Set<string>>(new Set());

    const toggleBulkSetting = (setting: string) => {
        setBulkSettingsActions(prev => {
            const next = new Set(prev);
            if (next.has(setting)) next.delete(setting);
            else next.add(setting);
            return next;
        });
    };
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [bulkProgress, setBulkProgress] = useState<{ current: number, total: number } | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Schedules Tab
    const [activeTab, setActiveTab] = useState<'groups' | 'schedules'>('groups');
    const [groupSchedules, setGroupSchedules] = useState<any[]>([]);

    // Individual Scheduling State
    const [groupScheduleMode, setGroupScheduleMode] = useState(false);
    const [groupScheduleDate, setGroupScheduleDate] = useState('');
    const [groupScheduleTime, setGroupScheduleTime] = useState('');

    useEffect(() => {
        if (activeTab === 'schedules') fetchSchedules();
    }, [activeTab, selectedInstance]);

    const fetchSchedules = async () => {
        if (activeTab !== 'schedules' || !selectedInstance) return;
        const { data, error } = await supabase
            .from('schedules')
            .select('*, error_message')
            .eq('instance', selectedInstance)
            .eq('type', 'group_action')
            .order('enviar_em', { ascending: false });

        if (error) addLog('Failed to fetch schedules', 'error');
        else setGroupSchedules(data || []);
    };

    const deleteSchedule = async (id: string) => {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        const { error } = await supabase.from('schedules').delete().eq('id', id);
        if (error) addLog('Failed to delete schedule', 'error');
        else {
            addLog('Schedule deleted', 'success');
            fetchSchedules();
        }
    };

    const handleBulkExecute = async () => {
        // Capture context at start to avoid race conditions if user switches tabs during execution
        const currentAction = bulkAction;

        // Prepare Payload
        let payloadValue: any;

        if (currentAction === 'subject') payloadValue = bulkSubject;
        else if (currentAction === 'description') payloadValue = bulkDescription;
        else if (currentAction === 'settings') {
            payloadValue = Array.from(bulkSettingsActions);
            if (payloadValue.length === 0) {
                addLog('Select at least one setting', 'error');
                return;
            }
        }

        if (currentAction === 'picture' && bulkFile) {
            const fileName = `group-icon-${uuid.v4()}-${bulkFile.name}`;
            const { data, error } = await supabase.storage.from('group-media').upload(fileName, bulkFile);
            if (error) {
                addLog('Failed to upload image', 'error');
                return;
            }
            const { data: { publicUrl } } = supabase.storage.from('group-media').getPublicUrl(fileName);
            payloadValue = publicUrl;
        }

        const targetGroups = groups
            .filter(g => selectedGroupIds.has(g.id))
            .sort((a, b) => (b.size || 0) - (a.size || 0)); // Sort by Size DESC

        if (targetGroups.length === 0) return;

        if (isScheduled) {
            // Schedule it
            if (!scheduleDate || !scheduleTime) {
                addLog('Date/Time required for scheduling', 'error');
                return;
            }
            const scheduledDate = new Date(`${scheduleDate}T${scheduleTime}`);
            const { error } = await supabase.from('schedules').insert({
                instance: selectedInstance,
                type: 'group_action',
                status: 'pending',
                enviar_em: scheduledDate.toISOString(),
                payload: {
                    action: `update_${currentAction}`,
                    value: payloadValue,
                    groupIds: targetGroups.map(g => g.id)
                },
                text: `Bulk Group Action: ${currentAction}`,
                api_key: config.apiKey
            });

            if (error) addLog('Failed to schedule action', 'error');
            else {
                addLog('Action scheduled successfully', 'success');
                setShowBulkModal(false);
            }

        } else {
            // Immediate Execution
            setBulkProcessing(true);
            setBulkProgress({ current: 0, total: targetGroups.length });

            for (let i = 0; i < targetGroups.length; i++) {
                const group = targetGroups[i];
                setBulkProgress({ current: i + 1, total: targetGroups.length });
                addLog(`Processing ${group.subject} (${i + 1}/${targetGroups.length})`, 'info');

                try {
                    if (currentAction === 'subject') await api.updateGroupSubject(selectedInstance, group.id, payloadValue);
                    if (currentAction === 'description') await api.updateGroupDescription(selectedInstance, group.id, payloadValue);
                    if (currentAction === 'settings') {
                        const settings = Array.isArray(payloadValue) ? payloadValue : [payloadValue];
                        for (const s of settings) {
                            await api.updateGroupSetting(selectedInstance, group.id, s);
                            // Small delay between settings
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                    if (currentAction === 'picture') {
                        // Fetch the image back as blob to convert to base64 for the current API adapter.
                        const imgRes = await fetch(payloadValue);
                        const blob = await imgRes.blob();
                        const reader = new FileReader();
                        const base64: string = await new Promise((resolve) => {
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        await api.updateGroupPicture(selectedInstance, group.id, base64.split(',')[1]); // remove prefix
                    }
                } catch (e: any) {
                    addLog(`Failed to update ${group.subject}: ${e.message}`, 'error');
                }

                // Delay 3 seconds
                if (i < targetGroups.length - 1) await new Promise(r => setTimeout(r, 3000));
            }

            setBulkProcessing(false);
            setBulkProgress(null);
            setShowBulkModal(false);
            addLog('Bulk action completed', 'success');
            fetchGroups();
        }
    };

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
                if (Array.isArray(data)) {
                    const valid = data.filter((d: any) => !!getInstanceName(d));
                    setInstances(valid);
                    // Automatic selection removed as per user request
                }
            });
    }, [config]);

    // Manual Refresh Function Wrapper
    const fetchGroups = async () => {
        if (!selectedInstance) return;
        setLoading(true);
        addLog(`Refreshing groups for ${selectedInstance}`, 'info');
        await refreshGroups(selectedInstance);
        setSelectedGroupIds(new Set()); // Reset selection on reload
        setLoading(false);
        addLog(`Groups refreshed`, 'success');
    };

    // Effect to reset selection when switching instances
    useEffect(() => {
        setSelectedGroupIds(new Set());
        // We don't fetch here anymore because context does it or already has it.
        // But if user switches instance, they see cached data instantly.
    }, [selectedInstance]);

    // --- Group Actions ---

    const createGroup = async () => {
        addLog(`Creating group: ${newGroupSubject} `, 'request');
        const participants = newGroupParticipants.split(',').map(p => p.trim()).filter(p => p);
        try {
            const res = await api.createGroup(selectedInstance, newGroupSubject, participants);
            if (res.ok) {
                addLog('Group created successfully', 'success');
                setShowCreateModal(false);
                setNewGroupSubject('');
                setNewGroupParticipants('');
                fetchGroups();
            } else {
                addLog('Failed to create group', 'error', await res.text());
            }
        } catch (e: any) {
            addLog(`Error creating group: ${e.message} `, 'error');
        }
    };

    const leaveGroup = async (groupId: string) => {
        if (!window.confirm("Leave group? This cannot be undone.")) return;
        addLog(`Leaving group ${groupId} `, 'warning');
        try {
            await api.leaveGroup(selectedInstance, groupId);
            addLog('Left group successfully', 'success');
            if (selectedGroup?.id === groupId) setSelectedGroup(null);
            fetchGroups();
        } catch (e: any) {
            addLog(`Error leaving group: ${e.message} `, 'error');
        }
    };

    // --- Details & Settings ---

    const scheduleIndividualAction = async (action: string, value: any) => {
        if (!selectedGroup) return;
        if (!groupScheduleDate || !groupScheduleTime) {
            addLog('Please select Date & Time for scheduling', 'error');
            return;
        }
        try {
            const scheduledDate = new Date(`${groupScheduleDate}T${groupScheduleTime}`);
            const { error } = await supabase.from('schedules').insert({
                instance: selectedInstance,
                type: 'group_action',
                status: 'pending',
                enviar_em: scheduledDate.toISOString(),
                payload: {
                    action: action,
                    value: value,
                    groupIds: [selectedGroup.id]
                },
                text: `Scheduled Group Action: ${action}`,
                api_key: config.apiKey
            });

            if (error) throw error;
            addLog('Action scheduled successfully', 'success');
        } catch (e: any) {
            addLog(`Failed to schedule action: ${e.message}`, 'error');
        }
    };

    const openGroupDetails = async (group: Group) => {
        setSelectedGroup(group);
        setDetailsLoading(true);
        setInviteInfo(null);
        setEditingSubject(false);
        setEditingDesc(false);
        setGroupScheduleMode(false); // Reset mode
        setGroupScheduleDate('');
        setGroupScheduleTime('');

        try {
            // Fetch full info including participants
            const info = await api.fetchGroupParticipants(selectedInstance, group.id);
            // Result usually is array of participants or object with participants
            // Evolution v2 fetchParticipants returns { id, participants: [...] } or just [...]
            // Let's assume standard response structure or handle adjustment

            let participants: any[] = [];
            if (Array.isArray(info)) participants = info;
            else if (info.participants) participants = info.participants;

            // Also fetch full metadata if possible or merge
            // For now, we update the local state with participants
            setSelectedGroup(prev => prev ? ({ ...prev, participants }) : null);

        } catch (e: any) {
            addLog(`Error fetching details: ${e.message} `, 'error');
        }
        setDetailsLoading(false);
    };

    const updateSubject = async () => {
        if (!selectedGroup) return;
        if (groupScheduleMode) {
            await scheduleIndividualAction('update_subject', tempSubject);
            setEditingSubject(false);
            return;
        }
        try {
            await api.updateGroupSubject(selectedInstance, selectedGroup.id, tempSubject);
            addLog('Subject updated', 'success');
            setEditingSubject(false);
            setSelectedGroup(prev => prev ? ({ ...prev, subject: tempSubject }) : null);
            fetchGroups(); // Refresh list
        } catch (e: any) {
            addLog(`Error updating subject: ${e.message} `, 'error');
        }
    };

    const updateDescription = async () => {
        if (!selectedGroup) return;
        if (groupScheduleMode) {
            await scheduleIndividualAction('update_description', tempDesc);
            setEditingDesc(false);
            return;
        }
        try {
            await api.updateGroupDescription(selectedInstance, selectedGroup.id, tempDesc);
            addLog('Description updated', 'success');
            setEditingDesc(false);
            setSelectedGroup(prev => prev ? ({ ...prev, desc: tempDesc }) : null);
        } catch (e: any) {
            addLog(`Error updating description: ${e.message} `, 'error');
        }
    };

    const fetchInvite = async () => {
        if (!selectedGroup) return;
        try {
            const res = await api.getInviteCode(selectedInstance, selectedGroup.id);
            // Result might be string code or object
            if (res?.code || res?.link) {
                setInviteInfo({ code: res.code || '', link: res.link || `https://chat.whatsapp.com/${res.code}` });
            } else if (typeof res === 'string') {
                setInviteInfo({ code: res, link: `https://chat.whatsapp.com/${res}` });
            }
        } catch (e: any) {
            addLog(`Error fetching invite: ${e.message}`, 'error');
        }
    };

    const revokeInvite = async () => {
        if (!selectedGroup) return;
        if (!confirm('Revoke current invite link? Previous link will stop working.')) return;
        try {
            await api.revokeInviteCode(selectedInstance, selectedGroup.id);
            addLog('Invite code revoked', 'success');
            fetchInvite(); // Get new one
        } catch (e: any) {
            addLog(`Error revoking invite: ${e.message}`, 'error');
        }
    };

    const updateSetting = async (action: 'announcement' | 'not_announcement' | 'locked' | 'unlocked') => {
        if (!selectedGroup) return;
        if (groupScheduleMode) {
            await scheduleIndividualAction('update_settings', [action]); // Use array for consistency
            return;
        }
        try {
            await api.updateGroupSetting(selectedInstance, selectedGroup.id, action);
            addLog(`Setting updated: ${action}`, 'success');
            // Optimistic update
            setSelectedGroup(prev => {
                if (!prev) return null;
                const next = { ...prev };
                if (action === 'announcement') next.announce = true;
                if (action === 'not_announcement') next.announce = false;
                if (action === 'locked') next.restrict = true;
                if (action === 'unlocked') next.restrict = false;
                return next;
            });
        } catch (e: any) {
            addLog(`Error updating setting: ${e.message}`, 'error');
        }
    };

    const toggleEphemeral = async (seconds: number) => {
        if (!selectedGroup) return;
        try {
            await api.toggleEphemeral(selectedInstance, selectedGroup.id, seconds);
            addLog(`Ephemeral timer set to ${seconds}s`, 'success');
            setSelectedGroup(prev => prev ? ({ ...prev, ephemeral: seconds }) : null);
        } catch (e: any) {
            addLog(`Error setting ephemeral: ${e.message}`, 'error');
        }
    };

    // --- Participant Actions ---

    const handleParticipantAction = async (participant: string, action: 'add' | 'remove' | 'promote' | 'demote') => {
        if (!selectedGroup) return;
        try {
            await api.updateParticipant(selectedInstance, selectedGroup.id, action, [participant]);
            addLog(`Participant action ${action} successful`, 'success');

            // Refresh details
            const info = await api.fetchGroupParticipants(selectedInstance, selectedGroup.id);
            let participants: any[] = [];
            if (Array.isArray(info)) participants = info;
            else if (info.participants) participants = info.participants;
            setSelectedGroup(prev => prev ? ({ ...prev, participants }) : null);
            setAddingParticipant(false);
            setNewParticipantNumber('');

        } catch (e: any) {
            addLog(`Error managing participant: ${e.message}`, 'error');
        }
    };


    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedGroupIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedGroupIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedGroupIds.size === filteredGroups.length) {
            setSelectedGroupIds(new Set());
        } else {
            setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)));
        }
    };

    // Logic for filtered and sorted groups
    const filteredGroups = groups
        .filter(g => g.subject?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortMode === 'name_asc') return (a.subject || '').localeCompare(b.subject || '');
            if (sortMode === 'name_desc') return (b.subject || '').localeCompare(a.subject || '');
            if (sortMode === 'size_asc') return (a.size || 0) - (b.size || 0);
            if (sortMode === 'size_desc') return (b.size || 0) - (a.size || 0);
            return 0;
        });

    return (
        <div className="space-y-6 pb-20 relative h-[calc(100vh-100px)]">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl font-bold text-white">Groups</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} disabled={config.mode === 'instance'} className="bg-slate-800 border-slate-700 text-white rounded-lg px-3 py-2 flex-1 md:flex-none disabled:opacity-50">
                        <option value="" disabled>Select Instance</option>
                        {instances.map((i, idx) => {
                            const name = getInstanceName(i);
                            return name ? <option key={idx} value={name}>{name}</option> : null;
                        })}
                    </select>
                    <button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"><PlusCircle size={18} /> <span className="hidden sm:inline">Create</span></button>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-4 border-b border-slate-700 mb-4 px-2">
                <button
                    onClick={() => setActiveTab('groups')}
                    className={`pb-3 px-2 text-sm font-medium transition ${activeTab === 'groups' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
                >
                    Groups
                </button>
                <button
                    onClick={() => setActiveTab('schedules')}
                    className={`pb-3 px-2 text-sm font-medium transition ${activeTab === 'schedules' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
                >
                    Scheduled Actions
                </button>
            </div>

            {activeTab === 'groups' && (
                <>
                    {/* Search & Toolbar */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col lg:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-4 w-full lg:w-auto">
                            <div className="relative flex-1 lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search groups..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-white rounded-lg pl-10 pr-4 py-2 w-full focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-slate-300 hover:text-white px-3 py-2 rounded hover:bg-slate-700/50 text-sm font-medium whitespace-nowrap">
                                {selectedGroupIds.size > 0 && selectedGroupIds.size === filteredGroups.length ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                                <span className="hidden sm:inline">Select All</span>
                            </button>
                        </div>

                        <div className="flex gap-2 w-full lg:w-auto justify-end">
                            {/* Sort Dropdown */}
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value as any)}
                                className="bg-slate-900 border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 outline-none"
                            >
                                <option value="name_asc">Name (A-Z)</option>
                                <option value="name_desc">Name (Z-A)</option>
                                <option value="size_desc">Size (Largest)</option>
                                <option value="size_asc">Size (Smallest)</option>
                            </select>

                            {/* View Toggle */}
                            <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex">
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutGrid size={18} /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><List size={18} /></button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="h-[calc(100vh-320px)] overflow-y-auto pr-2 custom-scrollbar">
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredGroups.map(g => {
                                    const isSelected = selectedGroupIds.has(g.id);
                                    return (
                                        <div key={g.id} onClick={() => toggleSelection(g.id)} className={`relative p-5 rounded-xl border transition cursor-pointer group hover:bg-slate-700/30 ${isSelected ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                                            <div className="absolute top-4 right-4 z-10">
                                                <input type="checkbox" checked={isSelected} onChange={() => { }} className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                                            </div>
                                            <div className="flex items-center gap-3 mb-3 pr-8">
                                                {g.pictureUrl ? <img src={g.pictureUrl} className="w-10 h-10 rounded-full bg-slate-900 object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-500"><Users size={20} /></div>}
                                                <div className="overflow-hidden">
                                                    <h3 className="font-bold text-white truncate text-sm" title={g.subject}>{g.subject}</h3>
                                                    <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={12} /> {g.size || 0} participants</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 border-t border-slate-700/50 pt-3 mt-2" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openGroupDetails(g)} className="flex-1 py-1.5 text-xs bg-slate-700 hover:bg-emerald-600 hover:text-white rounded text-slate-300 transition flex items-center justify-center gap-1">Manage</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {viewMode === 'list' && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-slate-900/50 text-slate-200 font-medium">
                                        <tr>
                                            <th className="p-4 w-12"><Square size={16} /></th>
                                            <th className="p-4">Group Name</th>
                                            <th className="p-4">ID</th>
                                            <th className="p-4">Participants</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {filteredGroups.map(g => {
                                            const isSelected = selectedGroupIds.has(g.id);
                                            return (
                                                <tr key={g.id} onClick={() => toggleSelection(g.id)} className={`hover:bg-slate-700/30 cursor-pointer transition ${isSelected ? 'bg-emerald-900/10' : ''}`}>
                                                    <td className="p-4">
                                                        <input type="checkbox" checked={isSelected} onChange={() => { }} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            {g.pictureUrl ? <img src={g.pictureUrl} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"><Users size={14} /></div>}
                                                            <span className="font-medium text-white">{g.subject}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-mono text-xs">{g.id.split('@')[0]}</td>
                                                    <td className="p-4">{g.size}</td>
                                                    <td className="p-4 text-right">
                                                        <button onClick={(e) => { e.stopPropagation(); openGroupDetails(g); }} className="px-3 py-1 bg-slate-700 hover:bg-blue-600 text-white rounded text-xs transition">Manage</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Floating Bulk Action Bar */}
                    {selectedGroupIds.size > 0 && (
                        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-40 animate-in slide-in-from-bottom-4">
                            <span className="font-bold text-white whitespace-nowrap">{selectedGroupIds.size} Selected</span>
                            <div className="h-4 w-px bg-slate-700"></div>

                            <button className="text-slate-300 hover:text-emerald-400 flex items-center gap-2 text-sm font-medium transition" onClick={() => setShowBulkModal(true)}>
                                <Layers size={16} /> Bulk Actions
                            </button>

                            <div className="h-4 w-px bg-slate-700"></div>

                            <button className="text-slate-300 hover:text-rose-400 flex items-center gap-2 text-sm font-medium transition" onClick={() => { if (confirm(`Leave ${selectedGroupIds.size} groups?`)) { selectedGroupIds.forEach(id => leaveGroup(id)); } }}>
                                <LogOut size={16} /> Leave All
                            </button>
                            <button className="ml-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-full" onClick={() => setSelectedGroupIds(new Set())}>
                                <Trash2 size={16} className="rotate-45" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'schedules' && (
                <div className="h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar">
                    {groupSchedules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Clock size={48} className="mb-4 opacity-50" />
                            <p>No scheduled group actions found</p>
                        </div>
                    ) : (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-900/50 text-slate-200 font-medium">
                                    <tr>
                                        <th className="p-4">Scheduled For</th>
                                        <th className="p-4">Action</th>
                                        <th className="p-4">Details</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {groupSchedules.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{new Date(s.enviar_em).toLocaleDateString()}</div>
                                                <div className="text-xs text-slate-500">{new Date(s.enviar_em).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-slate-700 text-white px-2 py-1 rounded text-xs font-mono">{s.payload?.action?.replace('update_', '').toUpperCase() || 'UNKNOWN'}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="truncate max-w-[200px]" title={String(s.payload?.value)}>
                                                    {s.payload?.action === 'update_picture' ? (
                                                        <span className="flex items-center gap-1"><ImageIcon size={14} /> Image Update</span>
                                                    ) : (
                                                        <span>{String(s.payload?.value || '-')}</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">{s.payload?.groupIds?.length || 0} groups targeted</div>
                                            </td>
                                            <td className="p-4">
                                                {s.status === 'pending' && <span className="text-amber-400 flex items-center gap-1"><Clock size={14} /> Pending</span>}
                                                {s.status === 'sent' && <span className="text-emerald-400 flex items-center gap-1"><CheckSquare size={14} /> Completed</span>}
                                                {s.status === 'failed' && (
                                                    <button
                                                        onClick={() => alert(`Error: ${s.error_message || 'Unknown error'}`)}
                                                        className="text-rose-400 flex items-center gap-1 hover:underline text-left"
                                                    >
                                                        <AlertTriangle size={14} /> Failed
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {(s.status === 'pending' || s.status === 'failed') && (
                                                    <button onClick={() => deleteSchedule(s.id)} className="text-slate-400 hover:text-rose-400 p-2 hover:bg-slate-700 rounded-full transition" title="Delete Schedule">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Bulk Action Modal */}
            {
                showBulkModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                        <div className="bg-slate-800 p-6 rounded-xl w-full max-w-lg border border-slate-700 relative">
                            <h3 className="text-white font-bold mb-6 text-xl flex items-center gap-2"><Layers className="text-emerald-500" /> Bulk Actions ({selectedGroupIds.size} Groups)</h3>

                            {bulkProcessing ? (
                                <div className="py-10 text-center space-y-4">
                                    <RefreshCw className="animate-spin text-emerald-500 mx-auto" size={48} />
                                    <p className="text-white font-medium">Processing Groups...</p>
                                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${(bulkProgress?.current || 0) / (bulkProgress?.total || 1) * 100}%` }}></div>
                                    </div>
                                    <p className="text-sm text-slate-400">{bulkProgress?.current} / {bulkProgress?.total}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-4 gap-2 mb-6">
                                        {[
                                            { id: 'subject', icon: Edit, label: 'Name' },
                                            { id: 'description', icon: AlignLeft, label: 'Desc' },
                                            { id: 'picture', icon: ImageIcon, label: 'Icon' },
                                            { id: 'settings', icon: Settings, label: 'Settings' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setBulkAction(opt.id as any)}
                                                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition ${bulkAction === opt.id ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                            >
                                                <opt.icon size={20} />
                                                <span className="text-xs font-medium">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6">
                                        {bulkAction === 'subject' && (
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">New Group Name</label>
                                                <input type="text" value={bulkSubject} onChange={e => setBulkSubject(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white p-2 rounded" placeholder="Enter new name..." />
                                            </div>
                                        )}

                                        {bulkAction === 'description' && (
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">New Description</label>
                                                <textarea value={bulkDescription} onChange={e => setBulkDescription(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white p-2 rounded h-24" placeholder="Enter description..." />
                                            </div>
                                        )}

                                        {bulkAction === 'picture' && (
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">Upload Group Icon</label>
                                                <input type="file" onChange={e => setBulkFile(e.target.files?.[0] || null)} className="w-full bg-slate-800 border-slate-700 text-slate-300 p-2 rounded text-sm file:bg-slate-700 file:border-0 file:text-white file:rounded file:px-2 file:mr-2" accept="image/*" />
                                            </div>
                                        )}

                                        {bulkAction === 'settings' && (
                                            <div className="space-y-4">
                                                <div className="text-xs text-slate-500 mb-2">Select settings to apply:</div>
                                                <div>
                                                    <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                                                        <input type="checkbox" checked={bulkSettingsActions.has('locked')} onChange={() => toggleBulkSetting('locked')} className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                                        <span>Lock Settings (Admins Only)</span>
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                                                        <input type="checkbox" checked={bulkSettingsActions.has('unlocked')} onChange={() => toggleBulkSetting('unlocked')} className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                                        <span>Unlock Settings (Everyone)</span>
                                                    </label>
                                                </div>
                                                <div className="h-px bg-slate-700 my-2"></div>
                                                <div>
                                                    <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                                                        <input type="checkbox" checked={bulkSettingsActions.has('announcement')} onChange={() => toggleBulkSetting('announcement')} className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                                        <span>Announcements Only</span>
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="flex items-center gap-3 text-slate-300 cursor-pointer">
                                                        <input type="checkbox" checked={bulkSettingsActions.has('not_announcement')} onChange={() => toggleBulkSetting('not_announcement')} className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                                        <span>Allow All Participants</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Scheduling Option */}
                                    <div className="mb-6">
                                        <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-sm mb-3">
                                            <input type="checkbox" checked={isScheduled} onChange={e => setIsScheduled(e.target.checked)} className="rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                            <Clock size={16} /> Schedule this action
                                        </label>

                                        {isScheduled && (
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">Date</label>
                                                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white p-2 rounded text-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">Time</label>
                                                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white p-2 rounded text-sm" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancel</button>
                                        <button onClick={handleBulkExecute} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition flex items-center gap-2">
                                            {isScheduled ? <Clock size={18} /> : <Layers size={18} />}
                                            {isScheduled ? 'Schedule Action' : 'Execute Now'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Create Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                        <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700">
                            <h3 className="text-white font-bold mb-4">Create New Group</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Subject</label>
                                    <input type="text" placeholder="Group Name" value={newGroupSubject} onChange={e => setNewGroupSubject(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white rounded p-2" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Participants (comma separated numbers)</label>
                                    <textarea placeholder="e.g. 5511999999999, 5511888888888" value={newGroupParticipants} onChange={e => setNewGroupParticipants(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white rounded p-2 h-20 text-sm" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white px-3 py-2">Cancel</button>
                                <button onClick={createGroup} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded">Create</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Group Details Modal */}
            {
                selectedGroup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
                        <div className="bg-slate-900 w-full max-w-4xl h-[90vh] rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-800/50">
                                <div className="flex gap-4 items-center">
                                    <div className="relative group">
                                        {selectedGroup.pictureUrl ? <img src={selectedGroup.pictureUrl} className="w-16 h-16 rounded-full object-cover border-2 border-slate-700" /> : <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 border-2 border-slate-700"><Users size={32} /></div>}
                                    </div>
                                    <div className="flex-1">
                                        {/* Header Title with Schedule Mode Indicator */}
                                        <div className="flex items-center gap-4">
                                            {editingSubject ? (
                                                <div className="flex gap-2 items-center">
                                                    <input autoFocus type="text" value={tempSubject} onChange={e => setTempSubject(e.target.value)} className="bg-slate-950 border border-slate-700 text-white px-2 py-1 rounded font-bold text-xl w-64" />
                                                    <button onClick={updateSubject} className="text-emerald-400 hover:text-emerald-300 p-1"><CheckSquare size={20} /></button>
                                                    <button onClick={() => setEditingSubject(false)} className="text-slate-400 hover:text-white p-1"><Trash2 size={20} className="rotate-45" /></button>
                                                </div>
                                            ) : (
                                                <h2 onClick={() => { setTempSubject(selectedGroup.subject); setEditingSubject(true); }} className="text-2xl font-bold text-white cursor-pointer hover:text-emerald-400 transition flex items-center gap-2">
                                                    {selectedGroup.subject}
                                                </h2>
                                            )}

                                            {/* Schedule Toggle in Header */}
                                            <div className="ml-auto flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
                                                    <div className={`w-8 h-4 rounded-full transition relative ${groupScheduleMode ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                                                        <input type="checkbox" className="hidden" checked={groupScheduleMode} onChange={e => setGroupScheduleMode(e.target.checked)} />
                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${groupScheduleMode ? 'left-4.5 translate-x-3.5' : 'left-0.5'}`}></div>
                                                    </div>
                                                    {groupScheduleMode ? 'Scheduling ON' : 'Scheduling OFF'}
                                                </label>

                                                {groupScheduleMode && (
                                                    <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                                                        <input type="date" value={groupScheduleDate} onChange={e => setGroupScheduleDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1" />
                                                        <input type="time" value={groupScheduleTime} onChange={e => setGroupScheduleTime(e.target.value)} className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-2 py-1" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="text-slate-400 text-sm">Created {selectedGroup.creation ? new Date(selectedGroup.creation * 1000).toLocaleDateString() : 'Unknown'} • {selectedGroup.size} participants</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedGroup(null)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700"><X size={24} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                    {/* Left Column: Settings & Info */}
                                    <div className="space-y-6">
                                        {/* Description */}
                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <h3 className="text-sm font-bold text-slate-300">Description</h3>
                                                <button onClick={() => { setTempDesc(selectedGroup.desc || ''); setEditingDesc(!editingDesc); }} className="text-xs text-blue-400 hover:text-blue-300">{editingDesc ? 'Cancel' : 'Edit'}</button>
                                            </div>
                                            {editingDesc ? (
                                                <div className="space-y-2">
                                                    <textarea value={tempDesc} onChange={e => setTempDesc(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white text-sm p-2 rounded h-24" />
                                                    <button onClick={updateDescription} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded">Save Description</button>
                                                </div>
                                            ) : (
                                                <p className="text-slate-400 text-sm whitespace-pre-wrap">{selectedGroup.desc || 'No description'}</p>
                                            )}
                                        </div>

                                        {/* Settings */}
                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
                                            <h3 className="text-sm font-bold text-slate-300">Settings</h3>

                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-slate-400">Locked (Admins only edit info)</div>
                                                <button onClick={() => updateSetting(selectedGroup.restrict ? 'unlocked' : 'locked')} className={`w-10 h-5 rounded-full transition relative ${selectedGroup.restrict ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedGroup.restrict ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="text-sm text-slate-400">Announcements (Admins only send)</div>
                                                <button onClick={() => updateSetting(selectedGroup.announce ? 'not_announcement' : 'announcement')} className={`w-10 h-5 rounded-full transition relative ${selectedGroup.announce ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedGroup.announce ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div className="pt-2 border-t border-slate-700">
                                                <label className="text-xs text-slate-500 block mb-1">Ephemeral Messages</label>
                                                <select
                                                    value={selectedGroup.ephemeral || 0}
                                                    onChange={e => toggleEphemeral(Number(e.target.value))}
                                                    className="w-full bg-slate-900 border-slate-700 text-white text-xs rounded px-2 py-1"
                                                >
                                                    <option value={0}>Off</option>
                                                    <option value={86400}>24 Hours</option>
                                                    <option value={604800}>7 Days</option>
                                                    <option value={7776000}>90 Days</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Invite Link */}
                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                            <h3 className="text-sm font-bold text-slate-300 mb-3">Invite Link</h3>
                                            {inviteInfo ? (
                                                <div className="space-y-3">
                                                    <div className="bg-slate-900 p-2 rounded text-emerald-400 text-xs font-mono break-all select-all">{inviteInfo.link}</div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteInfo.link)}`)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 rounded">Share</button>
                                                        <button onClick={revokeInvite} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs py-1.5 rounded">Revoke</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={fetchInvite} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded">Generate/View Link</button>
                                            )}
                                        </div>

                                        <button onClick={() => leaveGroup(selectedGroup.id)} className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 flex items-center justify-center gap-2 transition">
                                            <LogOut size={16} /> Leave Group
                                        </button>
                                    </div>

                                    {/* Right Column: Participants */}
                                    <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-[600px]">
                                        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                                            <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} /> Participants ({selectedGroup.participants?.length || 0})</h3>
                                            <button onClick={() => setAddingParticipant(true)} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded flex items-center gap-1"><PlusCircle size={14} /> Add New</button>
                                        </div>

                                        {addingParticipant && (
                                            <div className="p-4 bg-slate-700/30 border-b border-slate-700 flex gap-2">
                                                <input autoFocus type="text" placeholder="Phone Number (e.g. 5511...)" value={newParticipantNumber} onChange={e => setNewParticipantNumber(e.target.value)} className="flex-1 bg-slate-900 border-slate-600 text-white rounded px-3 py-1.5 text-sm" />
                                                <button onClick={() => handleParticipantAction(newParticipantNumber, 'add')} className="bg-emerald-600 text-white px-4 rounded text-sm">Add</button>
                                                <button onClick={() => setAddingParticipant(false)} className="text-slate-400 hover:text-white px-2">Cancel</button>
                                            </div>
                                        )}

                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                            {detailsLoading ? (
                                                <div className="text-center py-12 text-slate-500">Loading participants...</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {(selectedGroup.participants || []).map((p: any) => (
                                                        <div key={p.id} className="flex justify-between items-center p-3 hover:bg-slate-700/50 rounded-lg group">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 text-xs font-mono">
                                                                    {p.id.slice(0, 2)}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm text-slate-200 font-mono">{p.id.split('@')[0]}</div>
                                                                    <div className="flex gap-2">
                                                                        {p.superadmin && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded uppercase tracking-wider">Owner</span>}
                                                                        {p.admin && !p.superadmin && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1 rounded uppercase tracking-wider">Admin</span>}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {!p.superadmin && (
                                                                    <>
                                                                        {p.admin ? (
                                                                            <button onClick={() => handleParticipantAction(p.id, 'demote')} className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 rounded" title="Demote to Member">-A</button>
                                                                        ) : (
                                                                            <button onClick={() => handleParticipantAction(p.id, 'promote')} className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-800 rounded" title="Promote to Admin">+A</button>
                                                                        )}
                                                                        <button onClick={() => { if (confirm('Remove user?')) handleParticipantAction(p.id, 'remove'); }} className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 rounded" title="Remove User"><LogOut size={14} /></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default GroupManager;
