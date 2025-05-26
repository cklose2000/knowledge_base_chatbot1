import React, { useState } from 'react';
import { Send, Plus, Upload, ChevronRight, Grid3X3, Camera, FileText, Cloud, Folder, ChevronLeft } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showConnectApps, setShowConnectApps] = useState(false);
  const { addMessage, isLoading } = useChatStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      addMessage({
        role: 'user',
        content: message.trim()
      });
      setMessage('');
      
      // Reset textarea height to single line
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = '48px';
      }
      
      // Simulate AI response after a delay
      setTimeout(() => {
        addMessage({
          role: 'assistant',
          content: 'Thank you for your question. I\'m analyzing the data and will provide insights shortly.'
        });
      }, 1000);
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
    <div className="bg-black">
      <div className="max-w-4xl mx-auto p-4">
        {/* Integration Options - shown when + is clicked */}
        {showIntegrations && (
          <div className="mb-4 p-1 bg-zinc-800 rounded-xl border border-zinc-700 shadow-lg">
            {!showConnectApps ? (
              // Main menu
              <>
                {/* Connect apps section */}
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

                {/* Separator */}
                <div className="border-t border-zinc-700 my-1"></div>

                {/* File actions section */}
                <div className="px-3 py-2">
                  {fileActions.map((action) => (
                    <button
                      key={action.name}
                      className="w-full flex items-center gap-3 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors text-left"
                      onClick={() => {
                        console.log(`Action: ${action.name}`);
                        setShowIntegrations(false);
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
              // Connect apps submenu
              <div className="px-3 py-2">
                {/* Back button */}
                <button
                  className="w-full flex items-center gap-2 text-sm text-gray-300 mb-3 px-2 py-2 hover:bg-zinc-700 rounded-lg transition-colors"
                  onClick={handleBackToMain}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Connect apps</span>
                </button>
                
                {/* All integrations */}
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
        
        {/* Main Chat Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center bg-zinc-800 rounded-2xl">
            {/* Plus Button */}
            <button
              type="button"
              onClick={toggleIntegrations}
              className="flex-shrink-0 p-3 text-zinc-400 hover:text-white transition-colors"
              title="Add attachments"
            >
              <Plus size={20} />
            </button>
            
            {/* Text Input */}
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
            
            {/* Send Button */}
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="flex-shrink-0 p-3 text-zinc-400 hover:text-white disabled:text-zinc-600 transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 