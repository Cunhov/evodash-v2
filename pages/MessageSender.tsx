
import React, { useState, useEffect } from 'react';
import { Send, Image, MapPin, User, List, DollarSign, FileText, Phone, Users, Sparkles, Search, ArrowUpDown, AlertTriangle, Music, Split, AtSign } from 'lucide-react';
import { EvoConfig, Group, MessageType } from '../types';
import { generateMarketingMessage } from '../services/geminiService';
import { useLogs } from '../context/LogContext';
import { getApiClient } from '../services/apiAdapter';

interface MessageSenderProps { config: EvoConfig; }

const MessageSender: React.FC<MessageSenderProps> = ({ config }) => {
  const { addLog } = useLogs();
  const api = getApiClient(config);
  
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [targetMode, setTargetMode] = useState<'individual' | 'groups'>('individual');
  const [phone, setPhone] = useState('');
  const [msgType, setMsgType] = useState<MessageType>('text');
  
  // Content States
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  
  // Advanced Options
  const [splitByLines, setSplitByLines] = useState(false);
  const [mentionAll, setMentionAll] = useState(false);
  
  // Advanced Message States
  const [pollName, setPollName] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [pixKey, setPixKey] = useState('');
  const [pixAmount, setPixAmount] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  // Group Selection
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSortSize, setGroupSortSize] = useState(false); // false = name, true = size

  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  // AI
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const getInstanceName = (item: any): string | null => {
    return item?.instance?.instanceName || item?.instanceName || item?.name || null;
  };

  useEffect(() => {
    if (config.mode === 'instance' && config.instanceName) {
        setInstances([{ instance: { instanceName: config.instanceName } }]);
        setSelectedInstance(config.instanceName);
        return;
    }

    addLog('Fetching instances list...', 'info');
    api.fetchInstances()
      .then((data: any) => {
         if (Array.isArray(data)) {
             const valid = data.filter((d: any) => !!getInstanceName(d));
             setInstances(valid);
             if (valid.length > 0) {
                 const first = getInstanceName(valid[0]);
                 if (first) setSelectedInstance(first);
             }
             addLog(`Loaded ${valid.length} instances`, 'success');
         } else {
             addLog('Failed to load instances or empty list', 'warning', data);
         }
      }).catch((e: any) => addLog(`Error fetching instances: ${e.message}`, 'error'));
  }, [config]);

  useEffect(() => {
    if (targetMode === 'groups' && selectedInstance) {
        addLog(`Fetching groups for ${selectedInstance}...`, 'info');
        api.fetchGroups(selectedInstance)
        .then((data: any) => {
            if (Array.isArray(data)) {
                setGroups(data);
                addLog(`Loaded ${data.length} groups`, 'success');
            } else {
                setGroups([]);
                addLog('Failed to load groups (invalid response)', 'warning', data);
            }
        })
        .catch((e: any) => {
            setGroups([]);
            addLog(`Error fetching groups: ${e.message}`, 'error');
        });
    }
  }, [targetMode, selectedInstance, config]);

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
      });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstance) return;
    setIsSending(true); setProgress(0);

    // Normalize targets
    const targets: string[] = targetMode === 'individual' 
        ? [phone.replace(/\D/g, '') + (phone.includes('@') ? '' : '')] // Handle pure numbers or JIDs
        : Array.from(selectedGroupIds);
    
    // Prepare message chunks
    let textChunks: string[] = [message];
    if (msgType === 'text' && splitByLines) {
        textChunks = message.split('\n').filter(line => line.trim() !== '');
        if (textChunks.length === 0) textChunks = [message]; 
    }

    const totalTargets = targets.length;
    const totalChunks = textChunks.length;
    const totalSteps = totalTargets * totalChunks;

    addLog(`Starting batch send. Targets: ${totalTargets}, Chunks per target: ${totalChunks}`, 'info');

    let base64Media = '';
    if (mediaFile && (msgType === 'media' || msgType === 'audio')) {
        try {
            base64Media = await fileToBase64(mediaFile);
            addLog(`Media prepared: ${mediaFile.name} (${mediaFile.type})`, 'info');
        } catch (e) {
            addLog('Failed to process media file', 'error');
            setIsSending(false);
            return;
        }
    }

    let globalStepCount = 0;

    for (let i = 0; i < totalTargets; i++) {
        let number = targets[i];
        
        // Delay between different targets
        if (i > 0) await new Promise(r => setTimeout(r, 2500));

        for (let c = 0; c < totalChunks; c++) {
            // Delay between chunks within the same target
            if (c > 0) await new Promise(r => setTimeout(r, 3000));

            globalStepCount++;
            const currentText = textChunks[c];

            let dataPayload: any = {
                number: number,
                delay: 1200,
                mentionsEveryOne: mentionAll
            };

            if (msgType === 'text') {
                dataPayload.text = currentText;
            } 
            else if (msgType === 'media') {
                const typeStr = mediaFile?.type.split('/')[0] || 'image';
                dataPayload.mediatype = typeStr === 'video' ? 'video' : 'image';
                dataPayload.mimetype = mediaFile?.type || 'image/png';
                dataPayload.caption = currentText;
                dataPayload.media = base64Media;
                dataPayload.fileName = mediaFile?.name || 'file';
            }
            else if (msgType === 'audio') {
                dataPayload.audio = base64Media;
            }
            else if (msgType === 'poll') {
                dataPayload.pollMessage = { 
                    name: pollName, 
                    selectableCount: 1, 
                    values: pollOptions.filter(o => o.trim() !== '') 
                };
            }
            else if (msgType === 'pix') {
                 dataPayload.pixMessage = { key: pixKey, type: 'cpf', amount: parseFloat(pixAmount) || 0 };
            }
            else if (msgType === 'contact') {
                 dataPayload.contactMessage = [{ fullName: contactName, wuid: contactPhone, phoneNumber: contactPhone }];
            }
            else if (msgType === 'location') {
                 dataPayload.locationMessage = { 
                    latitude: parseFloat(latitude), 
                    longitude: parseFloat(longitude), 
                    name: 'Location', 
                    address: currentText 
                 };
            }

            try {
                const debugPayload = { ...dataPayload };
                if (debugPayload.media) debugPayload.media = '[BASE64_HIDDEN]';
                if (debugPayload.audio) debugPayload.audio = '[BASE64_HIDDEN]';
                
                const chunkInfo = totalChunks > 1 ? ` (Part ${c+1}/${totalChunks})` : '';
                addLog(`Sending ${msgType}${chunkInfo} to ${number} via ${config.provider}...`, 'request', debugPayload);
                
                const res = await api.sendMessage(selectedInstance, msgType, dataPayload);
                const resText = await res.text();
                
                if (res.ok) {
                    let jsonRes;
                    try { jsonRes = JSON.parse(resText); } catch { jsonRes = resText; }
                    addLog(`Sent successfully to ${number}`, 'success', jsonRes);
                } else {
                    let errorDetails;
                    try { errorDetails = JSON.parse(resText); } catch { errorDetails = resText; }
                    addLog(`Failed to send to ${number}. Status: ${res.status}`, 'error', errorDetails);
                }
            } catch (e: any) { 
                addLog(`Network error sending to ${number}: ${e.message}`, 'error');
            }
            
            setProgress(Math.round((globalStepCount / totalSteps) * 100));
        }
    }
    
    setIsSending(false);
    addLog('Batch sending completed', 'info');
    if(targetMode === 'individual') alert('Process finished. Check the console on the right for details.');
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
            <h2 className="text-3xl font-bold text-white">Messenger</h2>
            <p className="text-slate-400">Advanced message dispatching center.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
                <div className="flex border-b border-slate-700">
                    <button onClick={() => setTargetMode('individual')} className={`flex-1 py-4 font-medium flex items-center justify-center gap-2 ${targetMode === 'individual' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}><Phone size={18} /> Individual</button>
                    <button onClick={() => setTargetMode('groups')} className={`flex-1 py-4 font-medium flex items-center justify-center gap-2 ${targetMode === 'groups' ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}><Users size={18} /> Groups</button>
                </div>

                <form onSubmit={handleSend} className="p-6 space-y-6">
                    {/* Instance Selector */}
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">From Instance</label>
                        <select value={selectedInstance} onChange={(e) => setSelectedInstance(e.target.value)} disabled={config.mode === 'instance'} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 disabled:opacity-50">
                            {instances.map((i, idx) => {
                                const name = getInstanceName(i);
                                return name ? <option key={idx} value={name}>{name}</option> : null;
                            })}
                        </select>
                    </div>

                    {/* Targets */}
                    {targetMode === 'individual' ? (
                        <div>
                             <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">Phone Number</label>
                             <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3" />
                             <p className="text-xs text-slate-500 mt-1">Include country code. Do not include (+) or (-).</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             <div className="flex justify-between items-end">
                                 <label className="text-xs uppercase font-bold text-slate-500 block">Select Groups ({selectedGroupIds.size})</label>
                                 <div className="flex gap-2">
                                     <button type="button" onClick={() => setGroupSortSize(!groupSortSize)} className={`p-1 rounded ${groupSortSize ? 'text-emerald-400' : 'text-slate-500'}`} title="Sort by Size"><ArrowUpDown size={14}/></button>
                                     <button type="button" onClick={() => {
                                        if (selectedGroupIds.size === filteredGroups.length) setSelectedGroupIds(new Set());
                                        else setSelectedGroupIds(new Set(filteredGroups.map(g => g.id)));
                                     }} className="text-xs text-blue-400 hover:text-blue-300">
                                         {selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0 ? 'Deselect All' : 'Select All'}
                                     </button>
                                 </div>
                             </div>
                             
                             {/* Group Search */}
                             <div className="relative">
                                 <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                 <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Search group name..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"/>
                             </div>

                             <div className="h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-2 space-y-1">
                                 {filteredGroups.length === 0 ? (
                                     <div className="text-center text-slate-500 text-sm py-4">No groups found</div>
                                 ) : filteredGroups.map(g => (
                                     <div key={g.id} onClick={() => {
                                         const newSet = new Set(selectedGroupIds);
                                         if(newSet.has(g.id)) newSet.delete(g.id); else newSet.add(g.id);
                                         setSelectedGroupIds(newSet);
                                     }} className={`p-2 rounded cursor-pointer text-sm flex justify-between items-center group ${selectedGroupIds.has(g.id) ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'text-slate-300 hover:bg-slate-800 border border-transparent'}`}>
                                         <span className="truncate flex-1 pr-2">{g.subject}</span>
                                         <span className="text-xs text-slate-500 group-hover:text-slate-400 whitespace-nowrap">{g.size || 0} mem</span>
                                     </div>
                                 ))}
                             </div>
                             {selectedGroupIds.size === 0 && (
                                 <div className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={12}/> Select at least one group to send</div>
                             )}
                        </div>
                    )}

                    {/* Message Type Selector */}
                    <div>
                        <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Message Type</label>
                        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                             {[
                                {id: 'text', icon: <FileText size={18} />, label: 'Text'},
                                {id: 'media', icon: <Image size={18} />, label: 'Media'},
                                {id: 'audio', icon: <Music size={18} />, label: 'Audio'},
                                {id: 'poll', icon: <List size={18} />, label: 'Poll'},
                                {id: 'pix', icon: <DollarSign size={18} />, label: 'Pix'},
                                {id: 'contact', icon: <User size={18} />, label: 'Contact'},
                                {id: 'location', icon: <MapPin size={18} />, label: 'Map'}
                             ].map(t => (
                                 <button key={t.id} type="button" onClick={() => setMsgType(t.id as MessageType)} className={`flex flex-col items-center justify-center p-3 rounded-lg border transition ${msgType === t.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                     {t.icon}
                                     <span className="text-xs mt-1">{t.label}</span>
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
                                    <button type="button" onClick={() => setShowAiModal(true)} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300"><Sparkles size={12}/> AI Write</button>
                                </div>
                                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3" />
                            </div>
                        )}
                        
                        {/* Advanced Options Toggles */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-2">
                             {msgType === 'text' && (
                                <button 
                                    type="button" 
                                    onClick={() => setSplitByLines(!splitByLines)} 
                                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${splitByLines ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                >
                                    <Split size={16} />
                                    <span>Split separate lines</span>
                                </button>
                             )}
                             
                             <button 
                                type="button" 
                                onClick={() => setMentionAll(!mentionAll)} 
                                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition ${mentionAll ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                             >
                                <AtSign size={16} />
                                <span>Mention Everyone</span>
                             </button>
                        </div>
                        
                        {splitByLines && msgType === 'text' && (
                             <div className="text-xs text-blue-400/80 bg-blue-500/5 p-2 rounded">
                                 Each line break will be sent as a separate message with a 3-second delay.
                             </div>
                        )}

                        {(msgType === 'media' || msgType === 'audio') && (
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Upload File {msgType === 'audio' ? '(MP3/WAV)' : '(Image/Video/Doc)'}</label>
                                <input type="file" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20" />
                            </div>
                        )}

                        {msgType === 'poll' && (
                            <div className="space-y-3">
                                <input type="text" placeholder="Poll Question" value={pollName} onChange={(e) => setPollName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"/>
                                {pollOptions.map((opt, i) => (
                                    <input key={i} type="text" placeholder={`Option ${i+1}`} value={opt} onChange={(e) => {
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

                    <button type="submit" disabled={isSending || !selectedInstance || (targetMode === 'groups' && selectedGroupIds.size === 0)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition disabled:opacity-50">
                        <Send size={18} /> <span>{isSending ? `Sending (${progress}%)` : 'Send Message'}</span>
                    </button>
                </form>
            </div>
        </div>

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
    </div>
  );
};

export default MessageSender;
