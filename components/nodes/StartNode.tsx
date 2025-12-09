import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

export const StartNode = memo(() => {
    return (
        <div className="bg-slate-800 rounded-xl border-2 border-slate-600 p-4 shadow-lg min-w-[150px]">
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-700/50 rounded-full flex items-center justify-center border border-slate-600">
                    <Play className="text-emerald-400 fill-emerald-400" size={24} />
                </div>
                <div className="text-center">
                    <div className="text-sm font-bold text-white">Start</div>
                    <div className="text-[10px] text-slate-400">Workflow Trigger</div>
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
