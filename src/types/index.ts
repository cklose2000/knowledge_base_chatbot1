export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: FileAttachment[];
  timestamp: Date;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export interface User {
  username: string;
  isAuthenticated: boolean;
}

export interface FileConnector {
  id: string;
  name: string;
  icon: string;
  description: string;
  isAvailable: boolean;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  isComplete: boolean;
} 