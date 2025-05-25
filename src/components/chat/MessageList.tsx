import React, { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Message } from './Message';

export const MessageList: React.FC = () => {
  const { messages, isLoading } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-medium text-white mb-8 leading-tight">
            Where should we begin?
          </h1>
          <p className="text-lg text-zinc-400 mb-8 leading-relaxed">
            I'm your AI investment analyst. Ask me about market trends, portfolio analysis, 
            financial reports, or any data-driven insights you need.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        
        {isLoading && (
          <div className="flex justify-start mb-6">
            <div className="max-w-[70%]">
              <div className="bg-zinc-900 text-gray-200 rounded-xl px-4 py-3 mr-8">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}; 