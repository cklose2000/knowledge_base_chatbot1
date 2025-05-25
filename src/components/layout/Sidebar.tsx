import React, { useEffect } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { Button } from '../ui/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { chatHistory, activeChat, setActiveChat, clearMessages, initializeSampleChats } = useChatStore();

  useEffect(() => {
    initializeSampleChats();
  }, [initializeSampleChats]);

  const handleNewChat = () => {
    clearMessages();
    setActiveChat('new');
    onClose();
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChat(chatId);
    onClose();
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return timestamp.toLocaleDateString();
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50
        w-80 bg-zinc-900 border-r border-zinc-700
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="p-4 border-b border-zinc-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Chat History</h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <Button
              onClick={handleNewChat}
              icon={Plus}
              className="w-full"
              variant="secondary"
            >
              New Chat
            </Button>
          </div>
          
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Chats</h3>
              
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat.id)}
                  className={`
                    w-full text-left p-3 rounded-lg transition-all duration-150 ease-in-out
                    group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-opacity-75
                    ${activeChat === chat.id 
                      ? 'bg-sky-600/30 border border-sky-500/50 shadow-sm'
                      : 'hover:bg-zinc-800/60 active:bg-zinc-700/60'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <MessageSquare size={18} className={`
                      mt-0.5 flex-shrink-0 
                      ${activeChat === chat.id ? 'text-sky-400' : 'text-zinc-500 group-hover:text-zinc-300'}
                    `} />
                    <div className="flex-1 min-w-0">
                      <h4 className={`
                        text-sm font-semibold 
                        ${activeChat === chat.id ? 'text-sky-100' : 'text-zinc-100 group-hover:text-white'}
                        truncate
                      `}>
                        {chat.title}
                      </h4>
                      <p className="text-xs text-zinc-400 group-hover:text-zinc-300 truncate mt-1">
                        {chat.lastMessage}
                      </p>
                      <p className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-1.5">
                        {formatTimestamp(chat.timestamp)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              
              {chatHistory.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chat history yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}; 