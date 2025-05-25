import React, { useState } from 'react';
import { Send, Plus, Upload } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [showIntegrations, setShowIntegrations] = useState(false);
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
  };

  const integrations = [
    { name: 'Upload File/Photo', color: 'bg-gray-500', icon: <Upload size={16} /> },
    { name: 'Google Drive', color: 'bg-blue-500', icon: '📄' },
    { name: 'OneDrive', color: 'bg-orange-500', icon: '📁' },
    { name: 'Dropbox', color: 'bg-blue-600', icon: '📦' },
    { name: 'Salesforce', color: 'bg-blue-700', icon: '☁️' },
    { name: 'SharePoint', color: 'bg-blue-800', icon: '🗂️' },
  ];

  return (
    <div className="bg-black">
      <div className="max-w-4xl mx-auto p-4">
        {/* Integration Options - shown when + is clicked */}
        {showIntegrations && (
          <div className="mb-4 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Connect to your data sources</h3>
            <div className="flex flex-wrap gap-2">
              {integrations.map((integration) => (
                <button
                  key={integration.name}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 hover:text-white text-sm rounded-lg transition-colors"
                  onClick={() => {
                    console.log(`Connecting to ${integration.name}`);
                    setShowIntegrations(false);
                  }}
                >
                  <span className="text-sm">{integration.icon}</span>
                  {integration.name}
                </button>
              ))}
            </div>
            <button 
              className="mt-2 text-xs text-zinc-400 hover:text-zinc-300"
              onClick={() => setShowIntegrations(false)}
            >
              Cancel
            </button>
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