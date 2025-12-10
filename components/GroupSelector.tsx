import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, CheckCircle } from 'lucide-react';
import { Group } from '../types';

interface GroupSelectorProps {
    groups: Group[];
    selectedGroupIds: Set<string>;
    onChange: (ids: Set<string>) => void;
    minSize: number;
    onMinSizeChange: (size: number) => void;
    isLoading?: boolean;
}

export const GroupSelector: React.FC<GroupSelectorProps> = ({
    groups,
    selectedGroupIds,
    onChange,
    minSize,
    onMinSizeChange,
    isLoading = false
}) => {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<'subject' | 'size'>('subject');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const filteredGroups = useMemo(() => {
        return groups
            .filter(g => !search || g.subject?.toLowerCase().includes(search.toLowerCase()))
            .filter(g => (g.size || 0) >= minSize)
            .sort((a, b) => {
                if (sortKey === 'size') {
                    return sortOrder === 'asc'
                        ? (a.size || 0) - (b.size || 0)
                        : (b.size || 0) - (a.size || 0);
                } else {
                    return sortOrder === 'asc'
                        ? (a.subject || '').localeCompare(b.subject || '')
                        : (b.subject || '').localeCompare(a.subject || '');
                }
            });
    }, [groups, search, minSize, sortKey, sortOrder]);

    const toggleSelectAll = () => {
        if (selectedGroupIds.size === groups.length) {
            onChange(new Set());
        } else {
            onChange(new Set(groups.map(g => g.id)));
        }
    };

    const toggleGroup = (id: string) => {
        const newSet = new Set(selectedGroupIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        onChange(newSet);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-slate-300">Select Groups ({selectedGroupIds.size})</label>
                <button onClick={toggleSelectAll} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
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
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button
                                type="button"
                                onClick={() => {
                                    if (sortKey === 'subject') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    else { setSortKey('subject'); setSortOrder('asc'); }
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${sortKey === 'subject' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Name {sortKey === 'subject' && <ArrowUpDown size={10} className={sortOrder === 'asc' ? '' : 'rotate-180'} />}
                            </button>
                            <div className="w-px bg-slate-700 mx-1 my-1"></div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (sortKey === 'size') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                    else { setSortKey('size'); setSortOrder('desc'); }
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition ${sortKey === 'size' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                Size {sortKey === 'size' && <ArrowUpDown size={10} className={sortOrder === 'asc' ? 'rotate-180' : ''} />}
                            </button>
                        </div>

                        <label className="text-xs text-slate-400 ml-2">Min Size:</label>
                        <input
                            type="number"
                            value={minSize}
                            onChange={(e) => onMinSizeChange(parseInt(e.target.value) || 0)}
                            className="w-16 bg-slate-800 border-none rounded-lg px-2 py-2 text-sm text-white text-center"
                        />
                    </div>
                </div>

                <div className="h-64 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading groups...</div>
                    ) : filteredGroups.map(group => (
                        <div
                            key={group.id}
                            onClick={() => toggleGroup(group.id)}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${selectedGroupIds.has(group.id) ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                        >
                            <span className="text-sm text-slate-300 truncate">{group.subject}</span>
                            <span className="text-xs text-slate-500">{group.size || '?'} mem</span>
                        </div>
                    ))}
                    {!isLoading && filteredGroups.length === 0 && (
                        <div className="text-center py-8 text-slate-500">No groups found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
