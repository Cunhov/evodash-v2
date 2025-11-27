
import React, { useState, useEffect } from 'react';
import { Users, Search, Link as LinkIcon, LogOut, PlusCircle, LayoutGrid, List, SortAsc, SortDesc, Trash2, CheckSquare, Square } from 'lucide-react';
import { EvoConfig, Group } from '../types';
import { useLogs } from '../context/LogContext';
import { getApiClient } from '../services/apiAdapter';

interface GroupManagerProps { config: EvoConfig; }

const GroupManager: React.FC<GroupManagerProps> = ({ config }) => {
  const { addLog } = useLogs();
  const api = getApiClient(config);
  
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filtering & Viewing
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'name_asc' | 'name_desc' | 'size_asc' | 'size_desc'>('name_asc');
  
  // Selection
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);

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

  useEffect(() => { if(selectedInstance) fetchGroups(); }, [selectedInstance]);

  const fetchGroups = async () => {
    setLoading(true);
    addLog(`Fetching groups for ${selectedInstance}`, 'info');
    try {
      const data = await api.fetchGroups(selectedInstance);
      if (Array.isArray(data)) {
          setGroups(data);
          addLog(`Loaded ${data.length} groups`, 'success');
      } else {
          setGroups([]);
          addLog('Received invalid group data', 'warning', data);
      }
      setSelectedGroupIds(new Set()); // Reset selection on reload
    } catch(e: any) { 
        setGroups([]); 
        addLog(`Failed to fetch groups: ${e.message}`, 'error');
    }
    setLoading(false);
  };

  const createGroup = async () => {
    addLog(`Creating group: ${newGroupSubject}`, 'request');
    try {
        const res = await api.createGroup(selectedInstance, newGroupSubject, []);
        if(res.ok) {
            addLog('Group created successfully', 'success');
            setShowCreateModal(false); setNewGroupSubject(''); fetchGroups();
        } else {
            addLog('Failed to create group', 'error', await res.text());
        }
    } catch(e: any) { 
        alert("Failed to create group"); 
        addLog(`Error creating group: ${e.message}`, 'error');
    }
  };

  const fetchInviteLink = async (groupId: string) => {
      addLog(`Fetching invite link for ${groupId}`, 'request');
      try {
          const data = await api.getInviteLink(selectedInstance, groupId);
          const link = typeof data === 'string' ? data : (data.link || data.inviteCode);
          setInviteLink(link);
          addLog('Invite link fetched', 'success');
      } catch (e: any) { 
          alert("Cannot fetch link");
          addLog(`Error fetching link: ${e.message}`, 'error');
      }
  };

  const leaveGroup = async (groupId: string) => {
      if(!window.confirm("Leave group?")) return;
      addLog(`Leaving group ${groupId}`, 'warning');
      try {
        await api.leaveGroup(selectedInstance, groupId);
        fetchGroups();
      } catch(e: any) {
          addLog(`Error leaving group: ${e.message}`, 'error');
      }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedGroupIds);
      if(newSet.has(id)) newSet.delete(id);
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold text-white">Groups</h2>
        <div className="flex gap-2 w-full md:w-auto">
            <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} disabled={config.mode === 'instance'} className="bg-slate-800 border-slate-700 text-white rounded-lg px-3 py-2 flex-1 md:flex-none disabled:opacity-50">
                {instances.map((i,idx) => {
                    const name = getInstanceName(i);
                    return name ? <option key={idx} value={name}>{name}</option> : null;
                })}
            </select>
            <button onClick={() => setShowCreateModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap"><PlusCircle size={18}/> <span className="hidden sm:inline">Create</span></button>
        </div>
      </div>

      {/* Toolbar */}
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
                 {selectedGroupIds.size > 0 && selectedGroupIds.size === filteredGroups.length ? <CheckSquare size={18} className="text-emerald-500"/> : <Square size={18} />}
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
                 <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutGrid size={18}/></button>
                 <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><List size={18}/></button>
             </div>
         </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredGroups.map(g => {
                  const isSelected = selectedGroupIds.has(g.id);
                  return (
                    <div key={g.id} onClick={() => toggleSelection(g.id)} className={`relative p-5 rounded-xl border transition cursor-pointer group ${isSelected ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                        <div className="absolute top-4 right-4 z-10">
                             <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-3 mb-3 pr-8">
                            {g.pictureUrl ? <img src={g.pictureUrl} className="w-10 h-10 rounded-full bg-slate-900" /> : <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-500"><Users size={20}/></div>}
                            <div className="overflow-hidden">
                                <h3 className="font-bold text-white truncate text-sm" title={g.subject}>{g.subject}</h3>
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={12}/> {g.size || 0} participants</span>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 border-t border-slate-700/50 pt-3 mt-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => fetchInviteLink(g.id)} className="flex-1 py-1.5 text-xs bg-slate-700 hover:bg-blue-600 hover:text-white rounded text-slate-300 transition flex items-center justify-center gap-1"><LinkIcon size={12}/> Link</button>
                            <button onClick={() => leaveGroup(g.id)} className="p-1.5 text-xs bg-slate-700 hover:bg-rose-600 hover:text-white rounded text-slate-300 transition"><LogOut size={14}/></button>
                        </div>
                    </div>
                  );
              })}
          </div>
      )}

      {/* List View */}
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
                                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-emerald-500" />
                                  </td>
                                  <td className="p-4">
                                      <div className="flex items-center gap-3">
                                          {g.pictureUrl ? <img src={g.pictureUrl} className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"><Users size={14}/></div>}
                                          <span className="font-medium text-white">{g.subject}</span>
                                      </div>
                                  </td>
                                  <td className="p-4 font-mono text-xs">{g.id.split('@')[0]}</td>
                                  <td className="p-4">{g.size}</td>
                                  <td className="p-4 text-right">
                                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                          <button onClick={() => fetchInviteLink(g.id)} className="p-1.5 hover:bg-blue-600 hover:text-white rounded transition" title="Get Invite Link"><LinkIcon size={16}/></button>
                                          <button onClick={() => leaveGroup(g.id)} className="p-1.5 hover:bg-rose-600 hover:text-white rounded transition" title="Leave Group"><LogOut size={16}/></button>
                                      </div>
                                  </td>
                              </tr>
                           );
                      })}
                  </tbody>
              </table>
          </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedGroupIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-40 animate-in slide-in-from-bottom-4">
              <span className="font-bold text-white whitespace-nowrap">{selectedGroupIds.size} Selected</span>
              <div className="h-4 w-px bg-slate-700"></div>
              <button className="text-slate-300 hover:text-blue-400 flex items-center gap-2 text-sm font-medium transition" onClick={() => alert('Bulk Edit Name coming soon')}>
                  Edit Name
              </button>
              <button className="text-slate-300 hover:text-rose-400 flex items-center gap-2 text-sm font-medium transition" onClick={() => { if(confirm(`Leave ${selectedGroupIds.size} groups?`)) { selectedGroupIds.forEach(id => leaveGroup(id)); } }}>
                  <LogOut size={16} /> Leave All
              </button>
              <button className="ml-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-full" onClick={() => setSelectedGroupIds(new Set())}>
                  <Trash2 size={16} className="rotate-45" /> {/* Close icon visual hack */}
              </button>
          </div>
      )}

      {/* Modals */}
      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700">
                  <h3 className="text-white font-bold mb-4">Create New Group</h3>
                  <input type="text" placeholder="Group Subject" value={newGroupSubject} onChange={e => setNewGroupSubject(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white rounded p-2 mb-4" />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">Cancel</button>
                      <button onClick={createGroup} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded">Create</button>
                  </div>
              </div>
          </div>
      )}

      {inviteLink && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="bg-slate-800 p-6 rounded-xl w-full max-w-sm border border-slate-700 text-center">
                  <h3 className="text-white font-bold mb-4">Invite Link</h3>
                  <div className="bg-slate-900 p-3 rounded text-emerald-400 font-mono text-sm break-all select-all border border-slate-700">{inviteLink}</div>
                  <button onClick={() => setInviteLink(null)} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg">Close</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default GroupManager;
