import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    Connection,
    Edge,
    Node,
    Panel,
    BackgroundVariant
} from '@xyflow/react';
import * as uuid from 'uuid';
import { StartNode } from './nodes/StartNode';
import { DelayNode } from './nodes/DelayNode';
import { MessageNode } from './nodes/MessageNode';
import { Save, Play, Plus, Trash2, X, Archive, FolderOpen, Copy } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useLogs } from '../context/LogContext';
import { useGroupCache } from '../context/GroupCacheContext';
import { EvoConfig } from '../types';
import { GroupSelector } from './GroupSelector';
import { RichMessageForm } from './RichMessageForm';
import { getApiClient } from '../services/apiAdapter';

interface WorkflowEditorProps {
    config: EvoConfig;
    onClose: () => void;
}

const nodeTypes = {
    start: StartNode,
    delay: DelayNode,
    message: MessageNode,
};

const initialNodes: Node[] = [
    {
        id: 'start-1',
        type: 'start',
        position: { x: 50, y: 50 },
        data: { label: 'Start' },
    },
];

const WorkflowEditorContent: React.FC<WorkflowEditorProps> = ({ config, onClose }) => {
    const { addLog } = useLogs();
    const api = useMemo(() => getApiClient(config), [config]);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // Data for Selectors
    // Data for Selectors
    const { groups: cachedGroups, getGroups } = useGroupCache();
    // Derive groups for active selection
    // We only need groups when ConfigModal is open and we have an instance selected in that node.
    // simpler: just access getGroups directly when passing to props.

    // We can keep `groups` state if we want to memoize or just derive it on render.
    // Let's derive it.

    // Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [nodeData, setNodeData] = useState<any>({});

    // Template State
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);

    // Instances State (needed for the modal selector)
    const [instances, setInstances] = useState<any[]>([]);

    // Fetch Instances once
    useEffect(() => {
        api.fetchInstances().then((data: any) => {
            if (Array.isArray(data)) {
                setInstances(data.filter((d: any) => d?.instance?.instanceName || d?.instanceName || d?.name));
            }
        });
    }, [api]);

    // Derived groups for the currently configured node
    const activeGroups = useMemo(() => {
        if (showConfigModal && selectedNode?.type === 'start' && nodeData.instance) {
            return getGroups(nodeData.instance);
        }
        return [];
    }, [showConfigModal, selectedNode, nodeData.instance, cachedGroups]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowWrapper.current?.getBoundingClientRect();
            if (!position) return;

            const clientX = event.clientX - position.left;
            const clientY = event.clientY - position.top;

            const newNode: Node = {
                id: uuid.v4(),
                type,
                position: { x: clientX, y: clientY },
                data: { label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes],
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        // Deep copy data to avoid mutations affecting graph before save
        setNodeData(JSON.parse(JSON.stringify(node.data)));
        setShowConfigModal(true);
    }, []);

    const updateNodeData = () => {
        // Generate label update
        let label = nodeData.label;
        if (selectedNode?.type === 'message') {
            label = nodeData.message ? nodeData.message.substring(0, 20) + (nodeData.message.length > 20 ? '...' : '') : 'Message';
        }

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === selectedNode?.id) {
                    return {
                        ...node,
                        data: { ...nodeData, label },
                    };
                }
                return node;
            })
        );
        setShowConfigModal(false);
    };

    const deleteNode = () => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setShowConfigModal(false);
        setSelectedNode(null);
    };

    const duplicateNode = () => {
        if (!selectedNode) return;
        const newNode = {
            ...selectedNode,
            id: uuid.v4(),
            position: {
                x: selectedNode.position.x + 50,
                y: selectedNode.position.y + 50
            },
            data: JSON.parse(JSON.stringify(selectedNode.data))
        };
        setNodes((nds) => nds.concat(newNode));
        setShowConfigModal(false);
        addLog('Node duplicated', 'info');
    };

    // Template Handlers
    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('workflow_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) addLog(`Failed to fetch templates: ${error.message}`, 'error');
        else setTemplates(data || []);
    };

    const handleSaveTemplate = async () => {
        const name = prompt("Template Name:");
        if (!name) return;
        const { error } = await supabase.from('workflow_templates').insert({
            name,
            content: { nodes, edges }
        });
        if (error) addLog(`Failed to save template: ${error.message}`, 'error');
        else addLog('Template saved', 'success');
    };

    const handleLoadTemplate = (template: any) => {
        try {
            if (!template.content || !template.content.nodes) throw new Error("Invalid template format");
            setNodes(template.content.nodes || []);
            setEdges(template.content.edges || []);
            addLog(`Template "${template.name}" loaded`, 'success');
            setShowLoadModal(false);
        } catch (e: any) {
            addLog(`Failed to load: ${e.message}`, 'error');
        }
    };

    const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete this template?")) return;
        const { error } = await supabase.from('workflow_templates').delete().eq('id', id);
        if (error) addLog(`Delete failed: ${error.message}`, 'error');
        else fetchTemplates();
    };

    const handleExecute = async () => {
        const startNode = nodes.find(n => n.type === 'start');
        if (!startNode) {
            alert("No Start Node found");
            return;
        }

        const instanceName = startNode.data.instance as string;
        const groupsList = startNode.data.groups as string[];

        if (!instanceName) {
            alert("Please configure the Start Node with an Instance.");
            return;
        }

        let scheduleItems: any[] = [];
        let baseTime = new Date();

        const executionTimes: Record<string, Date> = {};
        executionTimes[startNode.id] = baseTime;

        const queue = [startNode.id];
        const visited = new Set<string>();
        visited.add(startNode.id);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentTime = executionTimes[currentId];
            const outgoingEdges = edges.filter(e => e.source === currentId);

            for (const edge of outgoingEdges) {
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!targetNode) continue;

                let nextTime = new Date(currentTime);
                const currentNode = nodes.find(n => n.id === currentId);

                if (currentNode?.type === 'delay') {
                    const duration = parseInt(currentNode.data.duration as string) || 0;
                    const unit = currentNode.data.unit as string || 'seconds';
                    let ms = 0;
                    if (unit === 'seconds') ms = duration * 1000;
                    if (unit === 'minutes') ms = duration * 60 * 1000;
                    if (unit === 'hours') ms = duration * 60 * 60 * 1000;
                    if (unit === 'days') ms = duration * 24 * 60 * 60 * 1000;
                    nextTime = new Date(nextTime.getTime() + ms);
                }

                executionTimes[targetNode.id] = nextTime;

                if (targetNode.type === 'message') {
                    // Reconstruct payload correctly
                    const nd = targetNode.data;
                    const type = nd.msgType || 'text';

                    // Construct payload based on type (logic from Scheduler)
                    const sourcePayload = (nd.payload && typeof nd.payload === 'object') ? nd.payload : {};
                    let payloadFull: any = { ...sourcePayload };
                    if (type === 'contact') {
                        payloadFull = { contactMessage: [{ fullName: payloadFull.contactName, wuid: payloadFull.contactPhone, phoneNumber: payloadFull.contactPhone }] };
                    } else if (type === 'location') {
                        payloadFull = { locationMessage: { latitude: parseFloat(payloadFull.latitude), longitude: parseFloat(payloadFull.longitude) } };
                    } else if (type === 'pix') {
                        payloadFull = { key: payloadFull.key, type: 'cpf', amount: parseFloat(payloadFull.amount) || 0 };
                    } else if (type === 'poll') {
                        payloadFull = { name: payloadFull.name, selectableCount: 1, values: (payloadFull.values || []).filter((o: string) => o) };
                    } else if (type === 'media' || type === 'audio') {
                        // Ensure required fields
                        if (!payloadFull.media && !payloadFull.audio) {
                            // warning?
                        }
                    }

                    const item = {
                        text: nd.message || '',
                        enviar_em: nextTime.toISOString(),
                        instance: instanceName,
                        api_key: config.apiKey,
                        group_filter: JSON.stringify({ ids: groupsList || [], minSize: nd.minSize || 0 }),
                        min_size_group: nd.minSize || 0,
                        mention_everyone: nd.mentionEveryone || false,
                        status: 'pending',
                        type: type,
                        payload: payloadFull,
                    };
                    scheduleItems.push(item);
                }

                if (!visited.has(targetNode.id)) {
                    visited.add(targetNode.id);
                    queue.push(targetNode.id);
                }
            }
        }

        if (scheduleItems.length === 0) {
            alert("No action nodes to schedule.");
            return;
        }

        if (!confirm(`Schedule ${scheduleItems.length} messages starting from ${baseTime.toLocaleTimeString()}?`)) return;

        const { error } = await supabase.from('schedules').insert(scheduleItems);
        if (error) addLog(`Execution failed: ${error.message}`, 'error');
        else {
            addLog(`${scheduleItems.length} messages scheduled successfully.`, 'success');
            onClose();
        }
    };

    return (
        <div className="flex h-[80vh] bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
            {/* Sidebar */}
            <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-4">
                <div className="text-xs font-bold text-slate-500 uppercase">Nodes</div>
                <div
                    className="bg-slate-700 p-3 rounded cursor-pointer hover:bg-slate-600 transition flex items-center gap-2"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'message')}
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-sm text-white">Message</span>
                </div>
                <div
                    className="bg-slate-700 p-3 rounded cursor-pointer hover:bg-slate-600 transition flex items-center gap-2"
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('application/reactflow', 'delay')}
                >
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-sm text-white">Delay</span>
                </div>

                <div className="mt-auto space-y-2">
                    <button onClick={handleSaveTemplate} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-500 flex items-center justify-center gap-2 text-sm">
                        <Save size={14} /> Save Template
                    </button>
                    <button onClick={() => { setShowLoadModal(true); fetchTemplates(); }} className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-500 flex items-center justify-center gap-2 text-sm">
                        <FolderOpen size={14} /> Load Template
                    </button>
                    <button onClick={handleExecute} className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 flex items-center justify-center gap-2 text-sm">
                        <Play size={14} /> Execute
                    </button>
                    <button onClick={onClose} className="w-full py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 flex items-center justify-center gap-2 text-sm">
                        Close
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                >
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                    <Controls />
                    <Panel position="top-right" className="bg-slate-800/80 p-2 rounded text-xs text-slate-400">
                        Drag nodes from sidebar
                    </Panel>
                </ReactFlow>
            </div>

            {/* Load Template Modal */}
            {showLoadModal && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-600 w-96 shadow-2xl max-h-[500px] flex flex-col">
                        {/* ... same as before ... */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Load Template</h3>
                            <button onClick={() => setShowLoadModal(false)}><X className="text-slate-400 hover:text-white" size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {templates.length === 0 ? <p className="text-slate-500 text-center py-4">No templates found.</p> :
                                templates.map(t => (
                                    <div key={t.id} onClick={() => handleLoadTemplate(t)} className="p-3 bg-slate-700/50 rounded flex justify-between items-center cursor-pointer hover:bg-slate-700">
                                        <span className="text-white text-sm">{t.name}</span>
                                        <button onClick={(e) => handleDeleteTemplate(e, t.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal - RICH & ENHANCED */}
            {showConfigModal && selectedNode && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
                    <div className="bg-slate-800 rounded-xl border border-slate-600 w-[600px] shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white capitalize">{selectedNode.type} Settings</h3>
                            <button onClick={() => setShowConfigModal(false)}><X className="text-slate-400 hover:text-white" size={20} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {selectedNode.type === 'start' && (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">From Instance</label>
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white appearance-none"
                                            value={nodeData.instance || ''}
                                            onChange={(e) => setNodeData({ ...nodeData, instance: e.target.value })}
                                        >
                                            <option value="">Select Instance...</option>
                                            {instances.map(inst => {
                                                const name = inst.instance?.instanceName || inst.instanceName || inst.name;
                                                return <option key={name} value={name}>{name}</option>
                                            })}
                                        </select>
                                    </div>

                                    {nodeData.instance && (
                                        <GroupSelector
                                            groups={activeGroups}
                                            selectedGroupIds={new Set(nodeData.groups || [])}
                                            onChange={(ids) => setNodeData({ ...nodeData, groups: Array.from(ids) })}
                                            minSize={nodeData.minSize || 0}
                                            onMinSizeChange={(size) => setNodeData({ ...nodeData, minSize: size })}
                                            isLoading={false} // Cache is instant or silently loading
                                        />
                                    )}
                                </div>
                            )}

                            {selectedNode.type === 'delay' && (
                                <div className="space-y-4">
                                    <label className="text-sm text-slate-300">Wait Duration</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="number"
                                            className="w-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                                            value={nodeData.duration || 0}
                                            onChange={(e) => setNodeData({ ...nodeData, duration: parseInt(e.target.value) })}
                                        />
                                        <select
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                                            value={nodeData.unit || 'seconds'}
                                            onChange={(e) => setNodeData({ ...nodeData, unit: e.target.value })}
                                        >
                                            <option value="seconds">Seconds</option>
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {selectedNode.type === 'message' && (
                                <RichMessageForm
                                    message={nodeData.message || ''}
                                    onMessageChange={(msg) => setNodeData({ ...nodeData, message: msg })}
                                    msgType={nodeData.msgType || 'text'}
                                    onMsgTypeChange={(type) => setNodeData({ ...nodeData, msgType: type })}
                                    splitByLines={nodeData.splitByLines || false}
                                    onSplitChange={(val) => setNodeData({ ...nodeData, splitByLines: val })}
                                    mentionEveryone={nodeData.mentionEveryone || false}
                                    onMentionChange={(val) => setNodeData({ ...nodeData, mentionEveryone: val })}
                                    payload={nodeData.payload || {}}
                                    onPayloadChange={(p) => setNodeData({ ...nodeData, payload: p })}
                                    mediaUrl={nodeData.payload?.media || nodeData.payload?.audio || ''}
                                    onMediaUrlChange={(url) => {
                                        // Update payload with new media URL
                                        const p = nodeData.payload || {};
                                        if (nodeData.msgType === 'audio') p.audio = url;
                                        else p.media = url;
                                        setNodeData({ ...nodeData, payload: p });
                                    }}
                                />
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-700 flex justify-between bg-slate-800 rounded-b-xl">
                            <button onClick={deleteNode} className="text-red-400 hover:text-red-300 flex items-center gap-2 text-sm font-medium"><Trash2 size={16} /> Delete Node</button>
                            <div className="flex gap-3">
                                {selectedNode.type !== 'start' && <button onClick={duplicateNode} className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-600/50 flex items-center gap-2"><Copy size={16} /> Duplicate</button>}
                                <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700">Cancel</button>
                                <button onClick={updateNodeData} className="px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const WorkflowEditor = (props: WorkflowEditorProps) => (
    <ReactFlowProvider>
        <WorkflowEditorContent {...props} />
    </ReactFlowProvider>
);
