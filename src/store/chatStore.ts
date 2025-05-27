import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, ChatSession } from '../types';
import { financeRagService } from '../services/financeRagService';
import OpenAI from 'openai';

interface ChatState {
  messages: Message[];
  activeChat: string;
  chatHistory: ChatSession[];
  isLoading: boolean;
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  sendMessage: (content: string, attachments?: File[]) => void;
  clearMessages: () => void;
  clearChatHistory: () => void;
  setActiveChat: (chatId: string) => void;
  initializeSampleChats: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true
});

/**
 * Generate conversational response using OpenAI based on RAG results
 */
async function generateLLMResponse(userQuery: string, ragResults: any[]): Promise<string> {
  try {
    console.log(`🤖 [ChatStore] Generating LLM response for query: "${userQuery}"`);
    console.log(`📊 [ChatStore] Using ${ragResults.length} RAG results`);

    // Prepare context from RAG results
    const context = ragResults.map((result, index) => 
      `Document ${index + 1} (${result.companyName || 'Financial Document'}):\n${result.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are an expert financial analyst AI assistant. You help investment banking professionals analyze financial documents and provide insights.

Your role:
- Analyze financial data and documents with precision
- Provide clear, actionable insights for investment decisions
- Explain complex financial concepts in professional terms
- Focus on key metrics, trends, and strategic implications
- Always cite specific data points from the provided documents

Guidelines:
- Be concise but comprehensive
- Use professional financial terminology
- Highlight key numbers, percentages, and trends
- Provide context and implications for investment decisions
- If asked about specific metrics, extract exact figures from the documents`;

    const userPrompt = `Based on the following financial documents, please answer this question: "${userQuery}"

Financial Documents Context:
${context}

Please provide a comprehensive analysis based on the documents provided. Include specific numbers, percentages, and key insights that would be valuable for investment banking analysis.`;

    const response = await openai.chat.completions.create({
      model: import.meta.env.VITE_OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for factual financial analysis
      max_tokens: 1000,
    });

    const llmResponse = response.choices[0].message.content;
    
    if (!llmResponse) {
      throw new Error('Empty response from OpenAI');
    }

    console.log(`✅ [ChatStore] Generated LLM response (${llmResponse.length} characters)`);
    return llmResponse;

  } catch (error) {
    console.error('❌ [ChatStore] Error generating LLM response:', error);
    
    // Fallback to structured summary if LLM fails
    let fallbackResponse = `Based on the uploaded financial documents, here are the key findings:\n\n`;
    
    ragResults.slice(0, 3).forEach((result, index) => {
      fallbackResponse += `${index + 1}. ${result.content.substring(0, 200)}...\n\n`;
    });
    
    const sources = [...new Set(ragResults.map(r => r.companyName || 'Document').filter(Boolean))];
    if (sources.length > 0) {
      fallbackResponse += `\n📄 Sources: ${sources.join(', ')}`;
    }
    
    return fallbackResponse;
  }
}

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
        
        try {
          // Try to use RAG service for intelligent responses
          console.log(`💬 [ChatStore] User query: "${content}"`);
          const ragResponse = await financeRagService.searchFinancialDocuments({
            query: content,
            maxResults: 5,
            similarityThreshold: 0.3  // Lower threshold for testing
          });
          console.log(`💬 [ChatStore] RAG response:`, ragResponse);
          console.log(`💬 [ChatStore] Found ${ragResponse.results.length} results`);
          
          let responseContent = '';
          
          if (ragResponse.results.length > 0) {
            // Generate intelligent response using OpenAI based on retrieved documents
            responseContent = await generateLLMResponse(content, ragResponse.results);
          } else {
            // Use OpenAI for general financial assistant responses when no documents are found
            try {
              const generalResponse = await openai.chat.completions.create({
                model: import.meta.env.VITE_OPENAI_CHAT_MODEL || 'gpt-4o-mini',
                messages: [
                  { 
                    role: 'system', 
                    content: 'You are a professional financial analyst AI assistant for investment banking. Provide helpful, professional responses about financial analysis and document processing.' 
                  },
                  { 
                    role: 'user', 
                    content: `User asked: "${content}". I don't have any financial documents uploaded yet. Please provide a helpful response encouraging them to upload documents for analysis.` 
                  }
                ],
                temperature: 0.3,
                max_tokens: 200,
              });
              
              responseContent = generalResponse.choices[0].message.content || 
                "I'd be happy to help with your financial analysis. Please upload some financial documents so I can provide specific insights.";
            } catch (error) {
              console.error('Error generating general response:', error);
              responseContent = "I'd be happy to help with your financial analysis. Please upload some financial documents so I can provide specific insights.";
            }
          }
          
          addMessage({
            role: 'assistant',
            content: responseContent,
          });
          
        } catch (error) {
          console.error('RAG service error:', error);
          
          // Fallback response
          addMessage({
            role: 'assistant',
            content: "I'm here to help with financial analysis. Please upload your financial documents and I'll provide detailed insights and analysis.",
          });
        }
        
        set({ isLoading: false });
      },
      
      clearMessages: () => {
        set({ messages: [] });
      },
      
      clearChatHistory: () => {
        set({ 
          chatHistory: [],
          messages: [],
          activeChat: 'new'
        });
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