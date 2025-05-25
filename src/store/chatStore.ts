import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, ChatSession } from '../types';

interface ChatState {
  messages: Message[];
  activeChat: string;
  chatHistory: ChatSession[];
  isLoading: boolean;
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  sendMessage: (content: string, attachments?: File[]) => void;
  clearMessages: () => void;
  setActiveChat: (chatId: string) => void;
  initializeSampleChats: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const sampleChats: ChatSession[] = [
  {
    id: '1',
    title: 'Q3 Financial Report Analysis',
    lastMessage: 'Let me analyze the Q3 financial report for you.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Can you analyze our Q3 financial report?',
        timestamp: new Date(Date.now() - 1000 * 60 * 35),
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Let me analyze the Q3 financial report for you. I can see strong performance in several key areas.',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
      }
    ]
  },
  {
    id: '2',
    title: 'Portfolio Risk Assessment',
    lastMessage: 'Based on the analysis, your portfolio shows...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // Yesterday
    messages: [
      {
        id: '3',
        role: 'user',
        content: 'What is the current risk level of our portfolio?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 - 5 * 60 * 1000),
      },
      {
        id: '4',
        role: 'assistant',
        content: 'Based on the analysis, your portfolio shows moderate risk levels with good diversification across sectors.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      }
    ]
  },
  {
    id: '3',
    title: 'Market Trends Summary',
    lastMessage: 'The market trends indicate...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    messages: [
      {
        id: '5',
        role: 'user',
        content: 'Can you provide a summary of current market trends?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 - 10 * 60 * 1000),
      },
      {
        id: '6',
        role: 'assistant',
        content: 'The market trends indicate continued growth in technology sectors with some volatility in traditional banking.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      }
    ]
  }
];

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      activeChat: 'new',
      chatHistory: [],
      isLoading: false,
      
      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          timestamp: new Date(),
        };
        
        set((state) => ({
          messages: [...state.messages, newMessage]
        }));
      },
      
      sendMessage: async (content, attachments) => {
        const { addMessage } = get();
        
        // Add user message
        const fileAttachments = attachments?.map(file => ({
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        
        addMessage({
          role: 'user',
          content,
          attachments: fileAttachments,
        });
        
        // Set loading state
        set({ isLoading: true });
        
        // Simulate AI response
        setTimeout(() => {
          const responses = [
            "I've analyzed your request and here's what I found...",
            "Based on the data provided, I can offer the following insights...",
            "Let me break down this information for you...",
            "The analysis shows several key trends that are worth noting...",
            "I've processed the attached files and here are my findings...",
          ];
          
          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          
          addMessage({
            role: 'assistant',
            content: randomResponse,
          });
          
          set({ isLoading: false });
        }, 1500);
      },
      
      clearMessages: () => {
        set({ messages: [] });
      },
      
      setActiveChat: (chatId) => {
        const { chatHistory } = get();
        const chat = chatHistory.find(c => c.id === chatId);
        
        if (chat) {
          set({ 
            activeChat: chatId,
            messages: chat.messages 
          });
        } else {
          set({ 
            activeChat: 'new',
            messages: [] 
          });
        }
      },
      
      initializeSampleChats: () => {
        const { chatHistory } = get();
        if (chatHistory.length === 0) {
          set({ chatHistory: sampleChats });
        }
      },
    }),
    {
      name: 'chat-storage',
    }
  )
); 