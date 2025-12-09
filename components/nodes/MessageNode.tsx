import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MessageSquare, Image, Music, List, DollarSign, User, MapPin, FileText } from 'lucide-react';

const icons = {
    text: FileText,
    media: Image,
    audio: Music,
    poll: List,
    pix: DollarSign,
    contact: User,
    location: MapPin,
};

export const MessageNode = memo(({ data }: NodeProps) => {
    const type = (data.msgType as string) || 'text';
    const Icon = icons[type as keyof typeof icons] || MessageSquare;

    return (
        <div className="bg-slate-800 rounded-xl border-2 border-slate-600 p-3 shadow-lg min-w-[140px] max-w-[200px]">
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-slate-400 border-2 border-slate-800"
            />

            <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-slate-600 ${data.message ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}>
                    <Icon className={data.message ? 'text-emerald-400' : 'text-slate-400'} size={20} />
                </div>
                <div className="text-center w-full">
                    <div className="text-xs font-bold text-white truncate px-2">{data.label || 'Message'}</div>
                    <div className="text-[10px] text-slate-400 truncate px-2">
                        {type}
                    </div>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3 bg-slate-400 border-2 border-slate-800"
            />
        </div>
    );
});
