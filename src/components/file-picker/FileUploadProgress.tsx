import React from 'react';
import { X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { UploadedFile } from '../../services/fileUploadService';

interface FileUploadProgressProps {
  files: UploadedFile[];
  onRemoveFile: (fileId: string) => void;
  onClose: () => void;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  files,
  onRemoveFile,
  onClose
}) => {
  if (files.length === 0) return null;

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing with AI...';
      case 'completed':
        return 'Ready for analysis';
      case 'error':
        return file.error || 'Upload failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mb-4 p-4 bg-zinc-800 rounded-xl border border-zinc-700 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">File Upload Progress</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {files.map((file) => (
          <div key={file.id} className="bg-zinc-900 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getStatusIcon(file.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {file.name}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onRemoveFile(file.id)}
                className="text-gray-400 hover:text-red-400 transition-colors ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            {(file.status === 'uploading' || file.status === 'processing') && (
              <div className="mb-2">
                <div className="w-full bg-zinc-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Status Text */}
            <div className={`text-xs ${getStatusColor(file.status)}`}>
              {getStatusText(file)}
            </div>

            {/* Financial Metrics Preview (if completed) */}
            {file.status === 'completed' && file.financialMetrics && (
              <div className="mt-2 p-2 bg-zinc-800 rounded text-xs">
                <div className="text-green-400 font-medium mb-1">
                  📊 Financial Data Extracted
                </div>
                <div className="text-gray-300">
                  Document processed and ready for AI analysis
                </div>
              </div>
            )}

            {/* Error Details */}
            {file.status === 'error' && file.error && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs">
                <div className="text-red-400 font-medium mb-1">Error Details:</div>
                <div className="text-red-300">{file.error}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-zinc-700">
        <div className="text-xs text-gray-400">
          {files.filter(f => f.status === 'completed').length} of {files.length} files processed
        </div>
      </div>
    </div>
  );
}; 