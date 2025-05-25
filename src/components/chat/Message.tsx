import React from 'react';
import { FileText, Download } from 'lucide-react';
import type { Message as MessageType } from '../../types';

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-[70%] ${isUser ? 'order-2' : ''}`}>
        <div className={`
          px-4 py-3 rounded-xl
          ${isUser 
            ? 'bg-zinc-800 text-white ml-8' 
            : 'bg-zinc-900 text-gray-200 mr-8'
          }
        `}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center gap-3 p-2 bg-zinc-800 rounded-lg border border-zinc-700"
                >
                  <FileText size={16} className="text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button className="text-gray-400 hover:text-white transition-colors">
                    <Download size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}; 