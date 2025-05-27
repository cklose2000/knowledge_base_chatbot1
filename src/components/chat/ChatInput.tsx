import React, { useState } from 'react';
import { Send, Plus, Upload, ChevronRight, Grid3X3, Camera, FileText, Cloud, Folder, ChevronLeft } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { fileUploadService } from '../../services/fileUploadService';

export const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showConnectApps, setShowConnectApps] = useState(false);
  const { sendMessage, addMessage, isLoading } = useChatStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      const messageContent = message.trim();
      setMessage('');
      
      // Reset textarea height to single line
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = '48px';
      }
      
      // Use sendMessage which includes RAG functionality
      sendMessage(messageContent);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleIntegrations = () => {
    setShowIntegrations(prev => !prev);
    setShowConnectApps(false); // Reset submenu when closing
  };

  const handleConnectAppsClick = () => {
    setShowConnectApps(true);
  };

  const handleBackToMain = () => {
    setShowConnectApps(false);
  };

  const handleFileUpload = async () => {
    try {
      setShowIntegrations(false);
      
      // Add a message indicating file upload started
      addMessage({
        role: 'assistant',
        content: 'Please select the files you want to upload...'
      });

      const uploadedFiles = await fileUploadService.selectAndUploadFiles({
        onProgress: (fileId, progress) => {
          console.log(`File ${fileId} progress: ${progress}%`);
        },
        onComplete: (fileId, result) => {
          console.log(`File ${fileId} completed:`, result);
        },
        onError: (fileId, error) => {
          console.error(`File ${fileId} error:`, error);
          addMessage({
            role: 'assistant',
            content: `❌ File upload failed: ${error}`
          });
        }
      });

      if (uploadedFiles.length > 0) {
        const successfulUploads = uploadedFiles.filter(f => f.status === 'completed');
        const failedUploads = uploadedFiles.filter(f => f.status === 'error');

        if (successfulUploads.length > 0) {
          const fileNames = successfulUploads.map(f => f.name).join(', ');
          addMessage({
            role: 'assistant',
            content: `✅ Successfully processed ${successfulUploads.length} file(s): ${fileNames}. You can now ask me questions about the content!`
          });
        }

        if (failedUploads.length > 0) {
          const errorMessages = failedUploads.map(f => `${f.name}: ${f.error}`).join('\n');
          addMessage({
            role: 'assistant',
            content: `❌ Failed to process ${failedUploads.length} file(s):\n${errorMessages}`
          });
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      addMessage({
        role: 'assistant',
        content: `❌ File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const allIntegrations = [
    { 
      name: 'Google Drive', 
      icon: <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-white text-xs font-bold">G</div>,
      description: 'Access your Google Drive files'
    },
    { 
      name: 'Microsoft OneDrive', 
      icon: <div className="w-4 h-4 bg-blue-600 rounded-sm flex items-center justify-center text-white text-xs">📁</div>,
      description: 'Connect to OneDrive for Business'
    },
    { 
      name: 'SharePoint', 
      icon: <div className="w-4 h-4 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs">📊</div>,
      description: 'Access SharePoint documents'
    },
    { 
      name: 'Dropbox', 
      icon: <div className="w-4 h-4 bg-blue-600 rounded-sm flex items-center justify-center text-white text-xs">📦</div>,
      description: 'Connect to your Dropbox files'
    },
    { 
      name: 'Box', 
      icon: <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center text-white text-xs">📁</div>,
      description: 'Access Box cloud storage'
    },
    { 
      name: 'Salesforce', 
      icon: <div className="w-4 h-4 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs">☁️</div>,
      description: 'Connect to Salesforce data'
    },
    { 
      name: 'Network Drives', 
      icon: <Folder className="w-4 h-4 text-gray-400" />,
      description: 'Access local network drives'
    },
  ];

  const fileActions = [
    { 
      name: 'Add from Microsoft OneDrive (personal)', 
      icon: <Cloud className="w-4 h-4 text-blue-500" />,
      description: null
    },
    { 
      name: 'Add photos and files', 
      icon: <Camera className="w-4 h-4 text-gray-400" />,
      description: null
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-8 py-4">
      <div className="relative flex flex-col-reverse">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex items-center bg-zinc-800 rounded-2xl">
            <button
              type="button"
              onClick={toggleIntegrations}
              className="flex-shrink-0 p-3 text-zinc-400 hover:text-white transition-colors"
              title="Add attachments"
            >
              <Plus size={20} />
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask anything"
                className="w-full px-3 py-3 bg-transparent text-white placeholder-zinc-400 focus:outline-none resize-none min-h-[48px] max-h-32 border-none"
                rows={1}
                disabled={isLoading}
                style={{
                  height: 'auto',
                  minHeight: '48px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="flex-shrink-0 p-3 text-zinc-400 hover:text-white disabled:text-zinc-600 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </form>

        {showIntegrations && (
          <div 
            className="absolute bottom-0 left-0 mb-1 w-80 p-1 bg-zinc-800 rounded-xl border border-zinc-700 shadow-lg z-50"
            style={{ transform: 'translateY(-100%)' }}
          >
            {!showConnectApps ? (
              <>
                <div className="px-3 py-2">
                  <button
                    className="w-full flex items-center justify-between text-sm text-gray-300 mb-2 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors"
                    onClick={handleConnectAppsClick}
                  >
                    <div className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4" />
                      <span>Connect apps</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-zinc-700 my-1"></div>

                <div className="px-3 py-2">
                  {fileActions.map((action) => (
                    <button
                      key={action.name}
                      className="w-full flex items-center gap-3 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                      onClick={() => {
                        if (action.name === 'Add photos and files') {
                          handleFileUpload();
                        } else {
                          console.log(`Action: ${action.name}`);
                          setShowIntegrations(false);
                        }
                      }}
                    >
                      {action.icon}
                      <div className="flex-1">
                        <div className="text-white text-sm">{action.name}</div>
                        {action.description && (
                          <div className="text-gray-400 text-xs">{action.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-3 py-2">
                <button
                  className="w-full flex items-center gap-2 text-sm text-gray-300 mb-3 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors"
                  onClick={handleBackToMain}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Connect apps</span>
                </button>
                
                {allIntegrations.map((integration) => (
                  <button
                    key={integration.name}
                    className="w-full flex items-center gap-3 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                    onClick={() => {
                      console.log(`Connecting to ${integration.name}`);
                      setShowIntegrations(false);
                      setShowConnectApps(false);
                    }}
                  >
                    {integration.icon}
                    <div className="flex-1">
                      <div className="text-white text-sm">{integration.name}</div>
                      {integration.description && (
                        <div className="text-gray-400 text-xs">{integration.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 