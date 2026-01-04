import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Image, File, Music, Video, CheckCircle, Trash2 } from 'lucide-react';

interface MediaLibraryModalProps {
    onSelect: (url: string, mimetype: string, filename: string) => void;
    onClose: () => void;
}

interface MediaFile {
    name: string;
    id: string; // or any unique id if available from listing
    metadata: {
        mimetype: string;
        size: number;
    };
    created_at: string;
    url: string;
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({ onSelect, onClose }) => {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .storage
                .from('schedules')
                .list('', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' },
                });

            if (error) {
                console.error('Error fetching files:', error);
                return;
            }

            if (data) {
                const mappedFiles = data.map((item: any) => {
                    const { data: publicUrlData } = supabase.storage.from('schedules').getPublicUrl(item.name);
                    return {
                        name: item.name,
                        id: item.id,
                        metadata: item.metadata,
                        created_at: item.created_at,
                        url: publicUrlData.publicUrl
                    };
                });
                setFiles(mappedFiles);
            }
        } catch (e) {
            console.error('Error in fetchFiles:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDelete = async (e: React.MouseEvent, fileName: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this file?')) return;
        
        const { error } = await supabase.storage.from('schedules').remove([fileName]);
        if (error) {
            alert('Failed to delete file');
        } else {
            setFiles(prev => prev.filter(f => f.name !== fileName));
            if (selectedFile?.name === fileName) setSelectedFile(null);
        }
    };

    const getIcon = (mime: string) => {
        if (mime.startsWith('image/')) return <Image className="text-emerald-400" size={24} />;
        if (mime.startsWith('video/')) return <Video className="text-blue-400" size={24} />;
        if (mime.startsWith('audio/')) return <Music className="text-purple-400" size={24} />;
        return <File className="text-slate-400" size={24} />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-slate-700 shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Image size={20} className="text-emerald-400" />
                        Media Library
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition" title="Close Modal">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex text-slate-500 justify-center items-center h-40">Loading media...</div>
                    ) : files.length === 0 ? (
                        <div className="text-slate-500 text-center py-10">No media files found.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {files.map((file) => (
                                <div 
                                    key={file.name}
                                    onClick={() => setSelectedFile(file)}
                                    className={`relative group rounded-lg border cursor-pointer overflow-hidden aspect-square flex flex-col justify-end transition hover:shadow-lg ${selectedFile?.name === file.name ? 'border-emerald-500 ring-2 ring-emerald-500/50 bg-slate-800' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                                >
                                    {/* Preview */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 p-2">
                                        {file.metadata?.mimetype?.startsWith('image/') ? (
                                            <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                {getIcon(file.metadata?.mimetype || '')}
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">{file.name.split('.').pop()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Overlay Info */}
                                    <div className="relative z-10 bg-slate-900/90 p-2 text-xs truncate border-t border-slate-700/50 backdrop-blur-sm">
                                        <div className="text-white truncate" title={file.name}>{file.name}</div>
                                        <div className="text-slate-500 text-[10px]">{new Date(file.created_at).toLocaleDateString()}</div>
                                    </div>

                                    {/* Selection Indicator */}
                                    {selectedFile?.name === file.name && (
                                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 z-20 shadow-lg">
                                            <CheckCircle size={16} />
                                        </div>
                                    )}

                                    {/* Delete Button (Hover) */}
                                    <button 
                                        onClick={(e) => handleDelete(e, file.name)}
                                        className="absolute top-2 left-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition z-20"
                                        title="Delete File"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
                    <div className="text-sm text-slate-400">
                        {selectedFile ? (
                            <span>Selected: <span className="text-white font-medium">{selectedFile.name}</span></span>
                        ) : (
                            <span>Select a file to confirm</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:text-white transition">Cancel</button>
                        <button 
                            disabled={!selectedFile}
                            onClick={() => selectedFile && onSelect(selectedFile.url, selectedFile.metadata?.mimetype || '', selectedFile.name)}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <CheckCircle size={18} />
                            Confirm Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
