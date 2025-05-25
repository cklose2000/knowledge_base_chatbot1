import React, { useState } from 'react';
import { Header } from '../layout/Header';
import { Sidebar } from '../layout/Sidebar';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { FilePickerModal } from '../file-picker/FilePickerModal';

export const ChatContainer: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="h-screen bg-black flex">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header onToggleSidebar={toggleSidebar} />
        
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-black">
          <MessageList />
          <ChatInput />
        </div>
      </div>
      
      {/* File Picker Modal */}
      <FilePickerModal />
    </div>
  );
}; 