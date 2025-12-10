import React, { useState } from 'react';
import { FileText, Image, Music, List, DollarSign, User, MapPin, Split, AtSign, Sparkles } from 'lucide-react';
import { MessageType } from '../types';
import { MediaUploader } from './MediaUploader';
import { supabase } from '../services/supabaseClient';
import { generateMarketingMessage } from '../services/geminiService';
import { uploadToStorage } from '../services/storageService';
import { useLogs } from '../context/LogContext';

interface RichMessageFormProps {
    message: string;
    onMessageChange: (msg: string) => void;
    msgType: MessageType;
    onMsgTypeChange: (type: MessageType) => void;

    // Toggles
    splitByLines: boolean;
    onSplitChange: (val: boolean) => void;
    mentionEveryone: boolean;
    onMentionChange: (val: boolean) => void;

    // Rich Data (Payload)
    payload: any;
    onPayloadChange: (payload: any) => void;

    // Optional: Pre-uploaded media URL (for editing nodes)
    mediaUrl?: string;
    onMediaUrlChange?: (url: string) => void;
}

export const RichMessageForm: React.FC<RichMessageFormProps> = ({
    message, onMessageChange,
    msgType, onMsgTypeChange,
    splitByLines, onSplitChange,
    mentionEveryone, onMentionChange,
    payload, onPayloadChange,
    mediaUrl, onMediaUrlChange
}) => {
    const { addLog } = useLogs();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showAiInput, setShowAiInput] = useState(false);

    // Helpers for Payloads
    const updatePayload = (key: string, value: any) => {
        onPayloadChange({ ...payload, [key]: value });
    };

    const handleFileUpload = async (file: File) => {
        setMediaFile(file);
        // If we have an onMediaUrlChange, we should probably upload immediately so the node data persists?
        // Or we just keep the File in local state?
        // The requirement is to be like Scheduler. Scheduler uploads on Save.
        // BUT Workflow needs to support Templates. Templates need URLs, not File objects.
        // So we should try to upload immediately if possible, or provide a button.

        if (onMediaUrlChange) {
            try {
                addLog('Uploading media...', 'info');
                const url = await uploadToStorage(file);
                onMediaUrlChange(url);
                addLog('Media uploaded successfully', 'success');

                // Validating the payload fields for media
                const typeStr = file.type.split('/')[0] || 'image';
                let mediaType = 'image';
                if (typeStr === 'video') mediaType = 'video';
                else if (typeStr === 'application' || typeStr === 'text') mediaType = 'document';

                updatePayload('mediatype', mediaType);
                updatePayload('mimetype', file.type);
                updatePayload('fileName', file.name); // Store original name
            } catch (e: any) {
                addLog(`Upload failed: ${e.message}`, 'error');
            }
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsAiLoading(true);
        const txt = await generateMarketingMessage(aiPrompt, 'casual', 200);
        if (txt.startsWith('Error')) {
            addLog(txt, 'error');
        } else {
            onMessageChange(txt);
            addLog('AI Content generated', 'success');
            setShowAiInput(false);
        }
        setIsAiLoading(false);
    };

    return (
        <div className="space-y-6">
            {/* Message Type Selector */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">Message Type</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                            onClick={() => onMsgTypeChange(type.id as MessageType)}
                            className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border min-w-[70px] transition ${msgType === type.id ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                        >
                            <type.icon size={18} />
                            <span className="text-[10px] font-medium">{type.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Prompter */}
            {showAiInput && (
                <div className="bg-slate-900 p-3 rounded-lg border border-purple-500/30 mb-2">
                    <input
                        className="w-full bg-transparent text-sm text-white focus:outline-none mb-2"
                        placeholder="What should this message say?"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAiInput(false)} className="text-xs text-slate-400">Cancel</button>
                        <button onClick={handleAiGenerate} disabled={isAiLoading} className="text-xs bg-purple-600 text-white px-3 py-1 rounded">{isAiLoading ? 'Generating...' : 'Generate'}</button>
                    </div>
                </div>
            )}

            {/* Dynamic Inputs */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
                {(msgType === 'text' || msgType === 'media' || msgType === 'location') && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-slate-400">{msgType === 'location' ? 'Address (Optional)' : 'Message / Caption'}</label>
                            <button type="button" onClick={() => setShowAiInput(!showAiInput)} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300"><Sparkles size={12} /> AI Write</button>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => onMessageChange(e.target.value)}
                            rows={4}
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-3 text-sm focus:ring-1 focus:ring-emerald-500"
                            placeholder={msgType === 'location' ? 'Type address...' : 'Type your message here...'}
                        />
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    {msgType === 'text' && (
                        <button type="button" onClick={() => onSplitChange(!splitByLines)} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition ${splitByLines ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                            <Split size={14} /> <span>Split lines</span>
                        </button>
                    )}
                    <button type="button" onClick={() => onMentionChange(!mentionEveryone)} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition ${mentionEveryone ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        <AtSign size={14} /> <span>Mention All</span>
                    </button>
                </div>

                {(msgType === 'media' || msgType === 'audio') && (
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400 mb-1 block">Upload File {msgType === 'audio' ? '(MP3/WAV)' : '(Image/Video/Doc)'}</label>
                        <MediaUploader
                            file={mediaFile}
                            onFileSelect={handleFileUpload}
                            accept={msgType === 'audio' ? 'audio/*' : 'image/*,video/*,application/*'}
                        />
                        {mediaUrl && (
                            <div className="text-xs text-emerald-400 truncate break-all">
                                Uploaded: {mediaUrl}
                            </div>
                        )}
                    </div>
                )}

                {msgType === 'poll' && (
                    <div className="space-y-3">
                        <input type="text" placeholder="Poll Question" value={payload.name || ''} onChange={(e) => updatePayload('name', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                        {(payload.values || ['Option 1', 'Option 2']).map((opt: string, i: number) => (
                            <input key={i} type="text" placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => {
                                const newOpts = [...(payload.values || ['Option 1', 'Option 2'])]; newOpts[i] = e.target.value;
                                updatePayload('values', newOpts);
                            }} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                        ))}
                        <button type="button" onClick={() => updatePayload('values', [...(payload.values || ['Option 1', 'Option 2']), ''])} className="text-xs text-emerald-400">+ Add Option</button>
                    </div>
                )}

                {msgType === 'pix' && (
                    <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Pix Key (CPF/Email)" value={payload.key || ''} onChange={e => updatePayload('key', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                        <input type="number" placeholder="Amount (0.00)" value={payload.amount || ''} onChange={e => updatePayload('amount', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                    </div>
                )}

                {msgType === 'contact' && (
                    <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Full Name" value={payload.contactName || ''} onChange={e => updatePayload('contactName', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                        <input type="text" placeholder="Phone (e.g. 5511...)" value={payload.contactPhone || ''} onChange={e => updatePayload('contactPhone', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                    </div>
                )}

                {msgType === 'location' && (
                    <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="Latitude" value={payload.latitude || ''} onChange={e => updatePayload('latitude', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                        <input type="number" placeholder="Longitude" value={payload.longitude || ''} onChange={e => updatePayload('longitude', e.target.value)} className="bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm" />
                    </div>
                )}
            </div>
        </div>
    );
};
