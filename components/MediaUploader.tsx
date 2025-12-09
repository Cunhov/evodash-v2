import React, { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, FileText, Music, Film } from 'lucide-react';

interface MediaUploaderProps {
    file: File | null;
    onFileSelect: (file: File | null) => void;
    accept?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ file, onFileSelect, accept = "image/*,video/*,application/*,audio/*" }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    }, [onFileSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    const clearFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFileSelect(null);
    };

    const getPreview = () => {
        if (!file) return null;
        if (file.type.startsWith('image/')) {
            return <img src={URL.createObjectURL(file)} alt="Preview" className="h-full w-full object-cover rounded-lg" />;
        }
        if (file.type.startsWith('video/')) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-emerald-400">
                    <Film size={32} />
                    <span className="text-xs mt-2">{file.name}</span>
                </div>
            );
        }
        if (file.type.startsWith('audio/')) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-blue-400">
                    <Music size={32} />
                    <span className="text-xs mt-2">{file.name}</span>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <FileText size={32} />
                <span className="text-xs mt-2">{file.name}</span>
            </div>
        );
    };

    return (
        <div
            className={`relative border-2 border-dashed rounded-xl transition-all duration-200 h-48 flex items-center justify-center cursor-pointer overflow-hidden
                ${isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('media-upload-input')?.click()}
        >
            <input
                id="media-upload-input"
                type="file"
                className="hidden"
                accept={accept}
                onChange={handleChange}
            />

            {file ? (
                <div className="w-full h-full relative group p-2">
                    {getPreview()}
                    <button
                        onClick={clearFile}
                        className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-500 rounded-full text-white transition-opacity opacity-0 group-hover:opacity-100"
                    >
                        <X size={16} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-white truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                </div>
            ) : (
                <div className="text-center p-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors ${isDragging ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Upload size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-300">
                        {isDragging ? 'Drop it like it\'s hot!' : 'Click or Drag & Drop'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Image, Video, Audio or Documents</p>
                </div>
            )}
        </div>
    );
};
