import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';

export const DelayNode = memo(({ data }: NodeProps) => {
    return (
        <div className="bg-slate-800 rounded-xl border-2 border-slate-600 p-3 shadow-lg min-w-[120px]">
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3 bg-slate-400 border-2 border-slate-800"
            />

            <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-slate-700/50 rounded-full flex items-center justify-center border border-slate-600">
                    <Clock className="text-amber-400" size={20} />
                </div>
                <div className="text-center">
                    <div className="text-xs font-bold text-white uppercase tracking-wider">Delay</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                        {data.duration ? `${data.duration} ${data.unit}` : 'Not set'}
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
