import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Contact } from '../types';
import { useLogs } from '../context/LogContext';
import { Plus, Search, Trash2, Edit2, Phone, Mail, Tag, Save, X, User } from 'lucide-react';

const Contacts: React.FC = () => {
    const { addLog } = useLogs();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [formData, setFormData] = useState<Partial<Contact>>({
        name: '', phone: '', email: '', tags: [], notes: ''
    });
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            addLog(`Error fetching contacts: ${error.message}`, 'error');
        } else {
            setContacts(data || []);
        }
        setLoading(false);
    };

    const handleOpenModal = (contact?: Contact) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({ ...contact });
        } else {
            setEditingContact(null);
            setFormData({ name: '', phone: '', email: '', tags: [], notes: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingContact) {
                const { error } = await supabase
                    .from('contacts')
                    .update(formData)
                    .eq('id', editingContact.id);
                if (error) throw error;
                addLog('Contact updated', 'success');
            } else {
                const { error } = await supabase
                    .from('contacts')
                    .insert(formData);
                if (error) throw error;
                addLog('Contact created', 'success');
            }
            setIsModalOpen(false);
            fetchContacts();
        } catch (error: any) {
            addLog(`Error saving contact: ${error.message}`, 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        try {
            const { error } = await supabase.from('contacts').delete().eq('id', id);
            if (error) throw error;
            addLog('Contact deleted', 'success');
            fetchContacts();
        } catch (error: any) {
            addLog(`Error deleting contact: ${error.message}`, 'error');
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            const currentTags = formData.tags || [];
            if (!currentTags.includes(tagInput.trim())) {
                setFormData({ ...formData, tags: [...currentTags, tagInput.trim()] });
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, tags: (formData.tags || []).filter(t => t !== tag) });
    };

    const filteredContacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-white">Contacts</h2>
                    <p className="text-slate-400">Manage your audience and segments.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition">
                    <Plus size={20} /> Add Contact
                </button>
            </div>

            {/* Search */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                <Search className="text-slate-500" size={20} />
                <input
                    type="text"
                    placeholder="Search by name, phone, or tag..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-white flex-1 placeholder-slate-500"
                />
            </div>

            {/* List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading contacts...</div>
                ) : filteredContacts.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No contacts found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/50 text-slate-400 text-sm uppercase">
                                    <th className="p-4 font-semibold">Name</th>
                                    <th className="p-4 font-semibold">Phone</th>
                                    <th className="p-4 font-semibold">Tags</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {filteredContacts.map(contact => (
                                    <tr key={contact.id} className="hover:bg-slate-700/30 transition">
                                        <td className="p-4">
                                            <div className="font-medium text-white">{contact.name || 'Unknown'}</div>
                                            <div className="text-xs text-slate-500">{contact.email}</div>
                                        </td>
                                        <td className="p-4 text-slate-300 font-mono text-sm">
                                            {contact.phone}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1">
                                                {contact.tags?.map(tag => (
                                                    <span key={tag} className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs border border-slate-600">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => handleOpenModal(contact)} className="p-2 hover:bg-slate-700 rounded-lg text-blue-400 transition" title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(contact.id)} className="p-2 hover:bg-slate-700 rounded-lg text-rose-400 transition" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-800 rounded-xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-900/50">
                            <h3 className="text-xl font-bold text-white">{editingContact ? 'Edit Contact' : 'New Contact'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                                    <input required type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 outline-none" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                                    <input required type="text" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-emerald-500 outline-none" placeholder="5511999999999" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Optional)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                                    <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-3 text-white focus:border-emerald-500 outline-none" placeholder="john@example.com" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags</label>
                                <div className="bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-wrap gap-2 items-center min-h-[50px]">
                                    {formData.tags?.map(tag => (
                                        <span key={tag} className="bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded text-sm flex items-center gap-1 border border-emerald-500/20">
                                            {tag} <button type="button" onClick={() => removeTag(tag)}><X size={12} /></button>
                                        </span>
                                    ))}
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                        className="bg-transparent border-none outline-none text-white text-sm flex-1 min-w-[100px]"
                                        placeholder="Type tag & hit Enter"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                                <textarea value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-24 focus:border-emerald-500 outline-none" placeholder="Optional notes..."></textarea>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium flex items-center gap-2 transition">
                                    <Save size={18} /> Save Contact
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;
