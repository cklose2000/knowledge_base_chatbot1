import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { MessageSquare, Plus, X } from 'lucide-react';

export const Chat: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };
  
  const closeSidebar = () => {
    setSidebarOpen(false);
  };
  
  return (
    <div className="min-h-screen bg-black flex">
      {/* Simple Sidebar */}
      {sidebarOpen && (
        <div className="w-80 bg-zinc-900 border-r border-zinc-700 flex flex-col fixed left-0 top-0 h-full z-50">
          <div className="p-4 border-b border-zinc-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Chat History</h2>
              <button
                onClick={closeSidebar}
                className="p-2 text-gray-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
              <Plus size={16} />
              New Chat
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Chats</h3>
            
            <div className="space-y-2">
              <div className="p-3 rounded-lg hover:bg-zinc-800 cursor-pointer">
                <div className="flex items-start gap-3">
                  <MessageSquare size={16} className="text-zinc-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">Q3 Financial Report Analysis</h4>
                    <p className="text-xs text-zinc-400 mt-1">Let me analyze the Q3 financial report...</p>
                    <p className="text-xs text-zinc-500 mt-1">Today</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg hover:bg-zinc-800 cursor-pointer">
                <div className="flex items-start gap-3">
                  <MessageSquare size={16} className="text-zinc-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">Portfolio Risk Assessment</h4>
                    <p className="text-xs text-zinc-400 mt-1">Based on the analysis, your portfolio...</p>
                    <p className="text-xs text-zinc-500 mt-1">Yesterday</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg hover:bg-zinc-800 cursor-pointer">
                <div className="flex items-start gap-3">
                  <MessageSquare size={16} className="text-zinc-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-100">Market Trends Summary</h4>
                    <p className="text-xs text-zinc-400 mt-1">The market trends indicate...</p>
                    <p className="text-xs text-zinc-500 mt-1">2 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-80' : ''}`}>
        <Header onToggleSidebar={toggleSidebar} />
        <div className="flex-1 flex flex-col">
          <MessageList />
          <ChatInput />
        </div>
      </div>
    </div>
  );
}; 