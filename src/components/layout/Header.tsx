import React from 'react';
import { Menu, LogOut, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Button } from '../ui/Button';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { logout, username } = useAuthStore();
  const { clearMessages } = useChatStore();

  const handleLogout = () => {
    logout();
  };

  const handleClearChat = () => {
    clearMessages();
  };

  return (
    <header className="bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={Menu}
          onClick={onToggleSidebar}
        >
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <h1 className="text-xl font-semibold text-white">AI Analyst</h1>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Welcome, {username}</span>
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          onClick={handleClearChat}
          title="Clear current chat"
        >
          Clear Chat
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={LogOut}
          onClick={handleLogout}
        >
          Sign Out
        </Button>
      </div>
    </header>
  );
}; 