const MODULE_UUID = crypto.randomUUID();
console.log(`🧩 financeRagService module loaded: ${MODULE_UUID}`);

(globalThis as any).__FIN_RAG_UUIDS__ ??= [];
(globalThis as any).__FIN_RAG_UUIDS__.push(MODULE_UUID);

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { supabaseService } from './supabaseService';
import { modernRagService } from './modernRagService';
import type { ModernFinancialChunk, ModernSearchResult } from './modernRagService';

// Types for Finance RAG system
export interface FinancialDocumentChunk {
  id: string;
  documentId: string;
  parentChunkId?: string;
  chunkLevel: number;
  chunkOrder: number;
  chunkType: string;
  title?: string;
  content: string;
  tokenCount: number;
  sectionType?: string;
  companyName?: string;
  reportType?: string; // earnings, 10k, 10q, annual_report, etc.
  fiscalPeriod?: string; // Q1 2024, FY 2023, etc.
  fiscalYear?: number;
  quarter?: number;
  metrics?: string[]; // revenue, net_income, eps, etc.
  financialStatements?: string[]; // income_statement, balance_sheet, cash_flow
  reportingDate?: string;
  currency?: string;
  embedding?: number[];
}

export interface FinancialProfile {
  id: string;
  documentId: string;
  companyName?: string;
  ticker?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  reportType?: string;
  fiscalPeriod?: string;
  fiscalYear?: number;
  quarter?: number;
  reportingDate?: string;
  currency?: string;
  
  // Key Financial Metrics
  revenue?: number;
  netIncome?: number;
  eps?: number;
  grossMargin?: number;
  operatingMargin?: number;
  netMargin?: number;
  roe?: number;
  roa?: number;
  debtToEquity?: number;
  currentRatio?: number;
  
  // Growth Metrics
  revenueGrowth?: number;
  netIncomeGrowth?: number;
  epsGrowth?: number;
  
  // Additional Metrics
  totalAssets?: number;
  totalLiabilities?: number;
  shareholdersEquity?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  
  profileCompletenessScore?: number;
}

export interface FinancialSearchResult {
  chunkId: string;
  documentId: string;
  similarity: number;
  chunkType: string;
  title?: string;
  content: string;
  companyName?: string;
  reportType?: string;
  fiscalPeriod?: string;
  metrics?: string[];
  metadata: Record<string, any>;
  parent_id?: string;
  parent_content?: string;
}

export interface FinanceRAGQuery {
  query: string;
  filters?: {
    chunkTypes?: string[];
    companies?: string[];
    reportTypes?: string[];
    fiscalYears?: number[];
    quarters?: number[];
    metrics?: string[];
    sectors?: string[];
    documentId?: string;
  };
  maxResults?: number;
  similarityThreshold?: number;
}

export interface FinanceRAGResponse {
  results: FinancialSearchResult[];
  financialProfiles: FinancialProfile[];
  totalResults: number;
  processingTime: number;
  query: string;
  suggestions?: string[];
  aggregatedMetrics?: {
    avgRevenue?: number;
    avgNetIncome?: number;
    avgEPS?: number;
    avgGrowthRate?: number;
  };
}

// Global storage for demo purposes (in production this would be a database)
const globalChunkStorage: FinancialDocumentChunk[] = [];

// Helper function to rewrite short queries for better embedding context
function rewriteQueryForEmbedding(query: string): string {
  if (query.length < 20 && query.length > 0) { // Adjusted length threshold slightly
    // Check if it's likely a question
    const questionKeywords = ['what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'do', 'does', 'can', 'could', 'summarize'];
    const isQuestion = questionKeywords.some(keyword => query.toLowerCase().startsWith(keyword)) || query.endsWith('?');
    
    if (isQuestion) {
      return `Regarding the uploaded financial documents (like earnings call transcripts or 10-K filings), answer this question: ${query}`;
    } else {
      return `Regarding the uploaded financial documents (like earnings call transcripts or 10-K filings), provide information about: ${query}`;
    }
  }
  return query;
}

class FinanceRAGService {
  private openai;
  private embeddingModel: string;
  private chatModel: string;
  private useSupabase: boolean;
  private useModernRAG: boolean;

  constructor() {
    console.log(`📦 new FinanceRagService() @`, new Error().stack?.split('\n')[2]);
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY!,
      dangerouslyAllowBrowser: true
    });
    
    this.embeddingModel = import.meta.env.VITE_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.chatModel = import.meta.env.VITE_OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    this.useSupabase = supabaseService.isConfigured();
    this.useModernRAG = true; // Re-enable Modern RAG
    // this.useModernRAG = false; // TEMPORARILY force Legacy RAG for testing
    
    if (this.useSupabase) {
      console.log('🗄️ [FinanceRAG] Using Supabase for persistent storage');
    } else {
      console.log('💾 [FinanceRAG] Using in-memory storage (demo mode)');
    }

    if (this.useModernRAG) {
      console.log('🚀 [FinanceRAG] Using Modern RAG with hierarchical chunking');
    }
  }

  /**
   * Process financial document using modern RAG service
   */
  async processDocument(
    documentId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<FinancialDocumentChunk[]> {
    console.log("🔴🔴🔴 TOP OF processDocument REACHED 🔴🔴🔴", documentId, "ModernRAG:", this.useModernRAG);

    // Store the full document content first
    if (this.useSupabase) {
      console.log(`[DEBUG FinanceRAG] this.useSupabase is true. Attempting to store full document.`);
      try {
        await supabaseService.storeProcessedDocument({
          id: documentId,
          document_title: metadata.filename || `Document ${documentId.substring(0,8)}`,
          company_name: metadata.companyName, // Assuming metadata might have this
          report_type: metadata.reportType,   // Assuming metadata might have this
          full_text_content: content,
          token_count: this.estimateTokens(content) 
        });
        console.log(`[DEBUG FinanceRAG] Successfully called storeProcessedDocument for documentId: ${documentId}`);
      } catch (error) {
        console.error('[DEBUG FinanceRAG] Error calling storeProcessedDocument:', error);
      }
    } else {
      console.log(`[DEBUG FinanceRAG] this.useSupabase is false. Skipping storeProcessedDocument.`);
    }
    
    // Forcing Modern RAG path for this test
    console.log(`[DEBUG FinanceRAG] FORCING call to processWithModernRAG for documentId: ${documentId}`);
    return this.processWithModernRAG(documentId, content, metadata);

    // Original routing logic commented out for this test:
    // if (this.useModernRAG) {
    //   console.log(`[DEBUG FinanceRAG] Routing to processWithModernRAG for documentId: ${documentId}`);
    //   return this.processWithModernRAG(documentId, content, metadata);
    // } else {
    //   console.log(`[DEBUG FinanceRAG] Routing to processFinancialDocument (legacy path) for documentId: ${documentId}`);
    //   return this.processFinancialDocument(documentId, content, metadata);
    // }
  }

  /**
   * Process document using modern RAG service
   */
  private async processWithModernRAG(
    documentId: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<FinancialDocumentChunk[]> {
    console.log(`🚀 [FinanceRAG] Processing with Modern RAG...`);
    
    try {
      // Use modern RAG service for processing
      const modernChunks = await modernRagService.processDocument(content, documentId, {
        companyName: metadata.companyName,
        reportType: metadata.reportType,
        filename: metadata.filename
      });

      // Convert modern chunks to legacy format for backward compatibility
      const legacyChunks = this.convertModernToLegacyChunks(modernChunks);

      // Store in Supabase using existing storage method
      if (this.useSupabase) {
        await this.storeFinancialChunks(legacyChunks);
      } else {
        globalChunkStorage.push(...legacyChunks);
      }

      // Create financial profile from structured data
      await this.createFinancialProfileFromContent(documentId, content, metadata);

      console.log(`✅ [FinanceRAG] Modern RAG processing complete: ${legacyChunks.length} chunks created`);
      return legacyChunks;
    } catch (error) {
      console.error('🚨 [FinanceRAG] Modern RAG processing failed:', error);
      // Fallback to legacy processing
      console.log('🔄 [FinanceRAG] Falling back to legacy processing...');
      return this.processFinancialDocument(documentId, content, metadata);
    }
  }

  /**
   * Convert modern chunks to legacy format
   */
  private convertModernToLegacyChunks(modernChunks: ModernFinancialChunk[]): FinancialDocumentChunk[] {
    return modernChunks.map((modernChunk, index) => ({
      id: modernChunk.id,
      documentId: modernChunk.metadata.documentId,
      parentChunkId: modernChunk.parentId,
      chunkLevel: modernChunk.level === 'parent' ? 1 : 2,
      chunkOrder: modernChunk.metadata.position,
      chunkType: modernChunk.metadata.chunkType,
      title: modernChunk.metadata.section || `Chunk ${index + 1}`,
      content: modernChunk.content,
      tokenCount: this.estimateTokens(modernChunk.content),
      sectionType: modernChunk.metadata.chunkType,
      companyName: modernChunk.metadata.companyName,
      reportType: modernChunk.metadata.reportType,
      embedding: modernChunk.embedding
    }));
  }

  /**
   * Enhanced search using modern RAG service
   */
  async searchFinancialDocuments(query: FinanceRAGQuery): Promise<FinanceRAGResponse> {
    const startTime = Date.now();
    console.log(`🔍 [FinanceRAG] Received search query: "${query.query}"`, query.filters);

    if (this.useModernRAG) {
      try {
        console.log('🚀 [FinanceRAG] Attempting search with Modern RAG...');
        const modernSearchResults = await modernRagService.search(query.query, {
          maxResults: query.maxResults,
          similarityThreshold: query.similarityThreshold !== undefined ? Math.min(query.similarityThreshold, 0.05) : 0.05,
          documentId: query.filters?.documentId
        });
        
        const legacyResults = this.convertModernToLegacyResults(modernSearchResults);
        
        const processingTime = Date.now() - startTime;
        console.log(`⏱️ [FinanceRAG] Modern RAG search completed in ${processingTime}ms, found ${legacyResults.length} results.`);
        
        // Placeholder for financial profiles and suggestions for modern path
        return {
          results: legacyResults,
          financialProfiles: [], 
          totalResults: legacyResults.length,
          processingTime,
          query: query.query,
          suggestions: [],
        };
      } catch (modernRagError) {
        console.warn('⚠️ [FinanceRAG] Modern RAG search failed, falling back to legacy RAG:', modernRagError);
        // Fall through to legacy RAG
      }
    }
    
    console.log(' legacy RAG search starting ');
    return this.searchWithLegacyRAG(query, startTime);
  }

  private async searchWithModernRAG(query: FinanceRAGQuery, startTime: number): Promise<FinanceRAGResponse> {
    try {
      console.log(`🚀 [FinanceRAG] Using Modern RAG enhanced search...`);
      
      // Use modern RAG enhanced search
      const modernResults = await modernRagService.enhancedSearch(query.query);
      
      // Convert modern results to legacy format
      const legacyResults = this.convertModernToLegacyResults(modernResults);
      
      // Get financial profiles
      const profiles = await this.getFinancialProfiles();
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [FinanceRAG] Modern search complete: ${legacyResults.length} results in ${processingTime}ms`);
      
      return {
        results: legacyResults,
        financialProfiles: profiles,
        totalResults: legacyResults.length,
        processingTime,
        query: query.query,
        suggestions: await this.generateFinancialSearchSuggestions(query.query)
      };
    } catch (error) {
      console.error('🚨 [FinanceRAG] Modern search failed:', error);
      // Fallback to legacy search
      console.log('🔄 [FinanceRAG] Falling back to legacy search...');
      return this.searchWithLegacyRAG(query, startTime);
    }
  }

  /**
   * Convert modern search results to legacy format
   */
  private convertModernToLegacyResults(modernResults: ModernSearchResult[]): FinancialSearchResult[] {
    if (!modernResults) return [];
    return modernResults.map(mr => ({
      chunkId: mr.chunk.id,
      documentId: mr.chunk.metadata.documentId,
      similarity: mr.similarity,
      chunkType: mr.chunk.metadata.chunkType as string,
      title: mr.chunk.metadata.section,
      content: mr.chunk.content,
      companyName: mr.chunk.metadata.companyName,
      reportType: mr.chunk.metadata.reportType,
      fiscalPeriod: undefined,
      metrics: undefined,
      metadata: { 
        ...mr.chunk.metadata, 
      },
      parent_id: mr.chunk.parentId,
      parent_content: mr.context?.content
    }));
  }

  /**
   * Create financial profile from content analysis
   */
  private async createFinancialProfileFromContent(
    documentId: string,
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Extract basic financial data using LLM
      const structuredData = await this.extractFinancialData(content);
      
      // Create profile using existing method
      await this.createFinancialProfile(documentId, structuredData);
    } catch (error) {
      console.error('🚨 [FinanceRAG] Failed to create financial profile:', error);
      // Create basic profile with available metadata
      const basicProfile: FinancialProfile = {
        id: uuidv4(),
        documentId,
        companyName: metadata.companyName,
        reportType: metadata.reportType,
        profileCompletenessScore: 0.3 // Low score for basic profile
      };
      
      if (this.useSupabase) {
        await supabaseService.storeProfile(basicProfile);
      }
    }
  }

  /**
   * Get financial profiles
   */
  private async getFinancialProfiles(): Promise<FinancialProfile[]> {
    if (this.useSupabase) {
      return await supabaseService.getFinancialProfiles();
    }
    return [];
  }

  /**
   * Generate embeddings for financial text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Process financial document using hierarchical strategy
   */
  async processFinancialDocument(
    documentId: string,
    content: string,
    _metadata: Record<string, any> = {}
  ): Promise<FinancialDocumentChunk[]> {
    console.error('❌ legacy processFinancialDocument hit! Path to this method should be removed or conditional logic reviewed. Call stack:', new Error().stack);
    console.log(`🏦 [FinanceRAG] Processing document ${documentId} with ${content.length} characters`);
    
    try {
      // Step 1: Extract structured financial data using LLM
      console.log(`🔍 [FinanceRAG] Extracting structured data...`);
      const structuredData = await this.extractFinancialData(content);
      console.log(`📊 [FinanceRAG] Extracted structured data:`, structuredData);
      
      // Step 2: Create hierarchical chunks for financial documents
      console.log(`🔧 [FinanceRAG] Creating hierarchical chunks...`);
      const chunks = await this.createFinancialHierarchicalChunks(
        documentId,
        content,
        structuredData
      );
      console.log(`📝 [FinanceRAG] Created ${chunks.length} chunks`);
      
      // Step 3: Generate embeddings for each chunk
      console.log(`🧠 [FinanceRAG] Generating embeddings for ${chunks.length} chunks...`);
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk, index) => {
          const embeddingText = this.createFinancialEmbeddingText(chunk);
          console.log(`🔗 [FinanceRAG] Chunk ${index + 1}/${chunks.length}: "${chunk.title}" (${embeddingText.length} chars)`);
          const embedding = await this.generateEmbedding(embeddingText);
          console.log(`✅ [FinanceRAG] Generated embedding for chunk ${index + 1} (${embedding.length} dimensions)`);
          return { ...chunk, embedding };
        })
      );
      
      // Step 4: Store chunks in database
      console.log(`💾 [FinanceRAG] Storing ${chunksWithEmbeddings.length} chunks in database...`);
      await this.storeFinancialChunks(chunksWithEmbeddings);
      
      // Step 5: Create financial profile
      console.log(`👤 [FinanceRAG] Creating financial profile...`);
      await this.createFinancialProfile(documentId, structuredData);
      
      console.log(`🎉 [FinanceRAG] Successfully processed document ${documentId}`);
      return chunksWithEmbeddings;
    } catch (error) {
      console.error('Error processing financial document:', error);
      throw new Error('Failed to process financial document');
    }
  }

  /**
   * Extract structured financial data using LLM
   */
  private async extractFinancialData(content: string): Promise<any> {
    const prompt = `
    Analyze this financial document and extract structured information. Return a JSON object with the following structure:

    {
      "companyInfo": {
        "companyName": "string",
        "ticker": "string",
        "sector": "string",
        "industry": "string",
        "marketCap": "number",
        "currency": "string"
      },
      "reportInfo": {
        "reportType": "earnings|10k|10q|annual_report|quarterly_report",
        "fiscalPeriod": "string (e.g., Q3 2024, FY 2023)",
        "fiscalYear": "number",
        "quarter": "number (1-4, null for annual)",
        "reportingDate": "string (YYYY-MM-DD)"
      },
      "financialMetrics": {
        "revenue": "number",
        "netIncome": "number",
        "eps": "number",
        "grossMargin": "number",
        "operatingMargin": "number",
        "netMargin": "number",
        "roe": "number",
        "roa": "number",
        "debtToEquity": "number",
        "currentRatio": "number",
        "totalAssets": "number",
        "totalLiabilities": "number",
        "shareholdersEquity": "number",
        "operatingCashFlow": "number",
        "freeCashFlow": "number"
      },
      "growthMetrics": {
        "revenueGrowth": "number (percentage)",
        "netIncomeGrowth": "number (percentage)",
        "epsGrowth": "number (percentage)"
      },
      "incomeStatement": {
        "revenue": "number",
        "costOfRevenue": "number",
        "grossProfit": "number",
        "operatingExpenses": "number",
        "operatingIncome": "number",
        "interestExpense": "number",
        "taxExpense": "number",
        "netIncome": "number"
      },
      "balanceSheet": {
        "totalAssets": "number",
        "currentAssets": "number",
        "totalLiabilities": "number",
        "currentLiabilities": "number",
        "shareholdersEquity": "number",
        "retainedEarnings": "number"
      },
      "cashFlowStatement": {
        "operatingCashFlow": "number",
        "investingCashFlow": "number",
        "financingCashFlow": "number",
        "freeCashFlow": "number",
        "capitalExpenditures": "number"
      },
      "keyHighlights": [
        "string array of key financial highlights and insights"
      ],
      "risks": [
        "string array of identified risks and concerns"
      ],
      "outlook": {
        "guidance": "string",
        "keyDrivers": ["string array"],
        "challenges": ["string array"]
      }
    }

    Financial document content:
    ${content}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = response.choices[0].message.content;
      console.log(`🤖 [FinanceRAG] LLM raw response:`, result);
      
      // Try to extract JSON from the response
      let jsonMatch = result?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        console.log(`📋 [FinanceRAG] Extracted JSON:`, jsonStr);
        return JSON.parse(jsonStr);
      } else {
        console.warn(`⚠️ [FinanceRAG] No JSON found in LLM response, using fallback`);
        return this.createFallbackStructuredData(content);
      }
    } catch (error) {
      console.error('🚨 [FinanceRAG] Error extracting financial data:', error);
      console.log(`🔄 [FinanceRAG] Using fallback structured data extraction`);
      return this.createFallbackStructuredData(content);
    }
  }

  /**
   * Create fallback structured data when LLM extraction fails
   */
  private createFallbackStructuredData(content: string): any {
    console.log(`🔄 [FinanceRAG] Creating fallback structured data from content`);
    
    // Extract basic information using simple text analysis
    const lines = content.toLowerCase().split('\n');
    const text = content.toLowerCase();
    
    // Try to find company name
    let companyName = 'Unknown Company';
    const companyPatterns = [
      /snowflake/i,
      /company[:\s]+([^,\n]+)/i,
      /corporation[:\s]+([^,\n]+)/i,
      /inc[:\s]+([^,\n]+)/i,
      /^([^,\n]+)\s+(financial|earnings|report)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|Corporation|Company|Ltd)/i
    ];
    
    // Special case for Snowflake
    if (content.toLowerCase().includes('snowflake')) {
      companyName = 'Snowflake Inc.';
    } else {
      for (const pattern of companyPatterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          companyName = match[1].trim();
          break;
        }
      }
    }
    
    // Extract financial numbers with more comprehensive patterns
    const revenue = this.extractFinancialNumber(text, ['revenue', 'sales', 'total revenue', 'product revenue', 'total product revenue']);
    const netIncome = this.extractFinancialNumber(text, ['net income', 'profit', 'earnings', 'net loss', 'loss']);
    const eps = this.extractFinancialNumber(text, ['eps', 'earnings per share', 'diluted eps', 'basic eps']);
    
    // Extract more specific financial metrics
    const grossProfit = this.extractFinancialNumber(text, ['gross profit', 'gross margin']);
    const operatingIncome = this.extractFinancialNumber(text, ['operating income', 'operating profit', 'operating loss']);
    const freeCashFlow = this.extractFinancialNumber(text, ['free cash flow', 'fcf', 'cash flow']);
    
    return {
      companyInfo: {
        companyName: companyName,
        currency: 'USD'
      },
      reportInfo: {
        reportType: 'financial_report',
        fiscalPeriod: 'Unknown Period'
      },
      financialMetrics: {
        revenue: revenue,
        netIncome: netIncome,
        eps: eps,
        grossProfit: grossProfit,
        operatingIncome: operatingIncome,
        freeCashFlow: freeCashFlow
      },
      keyHighlights: [
        `Financial report for ${companyName}`,
        revenue ? `Revenue: $${revenue.toLocaleString()}` : 'Revenue information available',
        netIncome ? `Net Income: $${netIncome.toLocaleString()}` : 'Earnings information available',
        grossProfit ? `Gross Profit: $${grossProfit.toLocaleString()}` : null,
        operatingIncome ? `Operating Income: $${operatingIncome.toLocaleString()}` : null,
        freeCashFlow ? `Free Cash Flow: $${freeCashFlow.toLocaleString()}` : null
      ].filter(Boolean)
    };
  }

  /**
   * Extract financial numbers from text
   */
  private extractFinancialNumber(text: string, keywords: string[]): number | null {
    for (const keyword of keywords) {
      const patterns = [
        // Pattern: "Revenue: $123.4 million" or "Revenue of $123.4 million"
        new RegExp(`${keyword}[:\\s]+(?:of\\s+)?\\$?([\\d,]+(?:\\.\\d+)?)\\s*(million|billion|m|b)?`, 'i'),
        // Pattern: "$123.4 million revenue" or "$123.4M in revenue"
        new RegExp(`\\$([\\d,]+(?:\\.\\d+)?)\\s*(million|billion|m|b)?\\s+(?:in\\s+)?${keyword}`, 'i'),
        // Pattern: "Revenue was $123.4 million"
        new RegExp(`${keyword}\\s+(?:was|were|of)\\s+\\$?([\\d,]+(?:\\.\\d+)?)\\s*(million|billion|m|b)?`, 'i'),
        // Pattern: Numbers in parentheses like "(123.4)" for millions
        new RegExp(`${keyword}[^\\d]*\\(?([\\d,]+(?:\\.\\d+)?)\\)?\\s*(million|billion|m|b)?`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let num = parseFloat(match[1].replace(/,/g, ''));
          const unit = match[2]?.toLowerCase();
          
          if (unit === 'million' || unit === 'm') {
            num *= 1000000;
          } else if (unit === 'billion' || unit === 'b') {
            num *= 1000000000;
          }
          
          console.log(`💰 [FinanceRAG] Extracted ${keyword}: ${num} from "${match[0]}"`);
          return num;
        }
      }
    }
    return null;
  }

  /**
   * Create hierarchical chunks for financial documents
   */
  private async createFinancialHierarchicalChunks(
    documentId: string,
    _content: string,
    structuredData: any
  ): Promise<FinancialDocumentChunk[]> {
    const chunks: FinancialDocumentChunk[] = [];
    let chunkOrder = 0;

    // Level 1: Executive Summary chunk
    const summaryChunk: FinancialDocumentChunk = {
      id: uuidv4(),
      documentId,
      chunkLevel: 1,
      chunkOrder: chunkOrder++,
      chunkType: 'executive_summary',
      title: 'Executive Summary',
      content: this.createExecutiveSummary(structuredData),
      tokenCount: this.estimateTokens(this.createExecutiveSummary(structuredData)),
      sectionType: 'summary',
      companyName: structuredData.companyInfo?.companyName,
      reportType: structuredData.reportInfo?.reportType,
      fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
      fiscalYear: structuredData.reportInfo?.fiscalYear,
      quarter: structuredData.reportInfo?.quarter,
      currency: structuredData.companyInfo?.currency,
    };
    chunks.push(summaryChunk);

    // Level 2: Financial Statements
    if (structuredData.incomeStatement) {
      const incomeChunk: FinancialDocumentChunk = {
        id: uuidv4(),
        documentId,
        // parentChunkId: summaryChunk.id, // Temporarily removed to fix foreign key constraint
        chunkLevel: 2,
        chunkOrder: chunkOrder++,
        chunkType: 'income_statement',
        title: 'Income Statement',
        content: this.createIncomeStatementContent(structuredData.incomeStatement),
        tokenCount: this.estimateTokens(this.createIncomeStatementContent(structuredData.incomeStatement)),
        sectionType: 'financial_statement',
        companyName: structuredData.companyInfo?.companyName,
        reportType: structuredData.reportInfo?.reportType,
        fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
        metrics: ['revenue', 'net_income', 'operating_income', 'gross_profit'],
        financialStatements: ['income_statement'],
      };
      chunks.push(incomeChunk);
    }

    if (structuredData.balanceSheet) {
      const balanceChunk: FinancialDocumentChunk = {
        id: uuidv4(),
        documentId,
        // parentChunkId: summaryChunk.id, // Temporarily removed to fix foreign key constraint
        chunkLevel: 2,
        chunkOrder: chunkOrder++,
        chunkType: 'balance_sheet',
        title: 'Balance Sheet',
        content: this.createBalanceSheetContent(structuredData.balanceSheet),
        tokenCount: this.estimateTokens(this.createBalanceSheetContent(structuredData.balanceSheet)),
        sectionType: 'financial_statement',
        companyName: structuredData.companyInfo?.companyName,
        reportType: structuredData.reportInfo?.reportType,
        fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
        metrics: ['total_assets', 'total_liabilities', 'shareholders_equity'],
        financialStatements: ['balance_sheet'],
      };
      chunks.push(balanceChunk);
    }

    if (structuredData.cashFlowStatement) {
      const cashFlowChunk: FinancialDocumentChunk = {
        id: uuidv4(),
        documentId,
        // parentChunkId: summaryChunk.id, // Temporarily removed to fix foreign key constraint
        chunkLevel: 2,
        chunkOrder: chunkOrder++,
        chunkType: 'cash_flow',
        title: 'Cash Flow Statement',
        content: this.createCashFlowContent(structuredData.cashFlowStatement),
        tokenCount: this.estimateTokens(this.createCashFlowContent(structuredData.cashFlowStatement)),
        sectionType: 'financial_statement',
        companyName: structuredData.companyInfo?.companyName,
        reportType: structuredData.reportInfo?.reportType,
        fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
        metrics: ['operating_cash_flow', 'free_cash_flow', 'capex'],
        financialStatements: ['cash_flow'],
      };
      chunks.push(cashFlowChunk);
    }

    // Level 2: Key Metrics and Ratios
    if (structuredData.financialMetrics) {
      const metricsChunk: FinancialDocumentChunk = {
        id: uuidv4(),
        documentId,
        // parentChunkId: summaryChunk.id, // Temporarily removed to fix foreign key constraint
        chunkLevel: 2,
        chunkOrder: chunkOrder++,
        chunkType: 'key_metrics',
        title: 'Key Financial Metrics',
        content: this.createMetricsContent(structuredData.financialMetrics),
        tokenCount: this.estimateTokens(this.createMetricsContent(structuredData.financialMetrics)),
        sectionType: 'metrics',
        companyName: structuredData.companyInfo?.companyName,
        reportType: structuredData.reportInfo?.reportType,
        fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
        metrics: Object.keys(structuredData.financialMetrics),
      };
      chunks.push(metricsChunk);
    }

    // Level 3: Detailed highlights and insights
    if (structuredData.keyHighlights?.length) {
      for (let i = 0; i < structuredData.keyHighlights.length; i++) {
        const highlight = structuredData.keyHighlights[i];
        const highlightChunk: FinancialDocumentChunk = {
          id: uuidv4(),
          documentId,
          // parentChunkId: summaryChunk.id, // Temporarily removed to fix foreign key constraint
          chunkLevel: 3,
          chunkOrder: chunkOrder++,
          chunkType: 'highlight',
          title: `Key Highlight ${i + 1}`,
          content: highlight,
          tokenCount: this.estimateTokens(highlight),
          sectionType: 'insight',
          companyName: structuredData.companyInfo?.companyName,
          reportType: structuredData.reportInfo?.reportType,
          fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
        };
        chunks.push(highlightChunk);
      }
    }

    return chunks;
  }

  /**
   * Create embedding text with financial context
   */
  private createFinancialEmbeddingText(chunk: FinancialDocumentChunk): string {
    const parts = [chunk.content];
    
    if (chunk.companyName) parts.push(`Company: ${chunk.companyName}`);
    if (chunk.reportType) parts.push(`Report Type: ${chunk.reportType}`);
    if (chunk.fiscalPeriod) parts.push(`Period: ${chunk.fiscalPeriod}`);
    if (chunk.metrics?.length) parts.push(`Metrics: ${chunk.metrics.join(', ')}`);
    if (chunk.sectionType) parts.push(`Section: ${chunk.sectionType}`);
    
    return parts.join(' | ');
  }

  // Helper methods for content creation
  private createExecutiveSummary(data: any): string {
    const parts = [];
    
    // Company and period info
    if (data.companyInfo?.companyName) parts.push(`Company: ${data.companyInfo.companyName}`);
    if (data.reportInfo?.fiscalPeriod) parts.push(`Period: ${data.reportInfo.fiscalPeriod}`);
    
    // Key financial metrics
    if (data.financialMetrics?.revenue) parts.push(`Revenue: ${this.formatCurrency(data.financialMetrics.revenue, data.companyInfo?.currency)}`);
    if (data.financialMetrics?.netIncome) parts.push(`Net Income: ${this.formatCurrency(data.financialMetrics.netIncome, data.companyInfo?.currency)}`);
    if (data.financialMetrics?.grossProfit) parts.push(`Gross Profit: ${this.formatCurrency(data.financialMetrics.grossProfit, data.companyInfo?.currency)}`);
    if (data.financialMetrics?.operatingIncome) parts.push(`Operating Income: ${this.formatCurrency(data.financialMetrics.operatingIncome, data.companyInfo?.currency)}`);
    if (data.financialMetrics?.eps) parts.push(`EPS: $${data.financialMetrics.eps}`);
    if (data.financialMetrics?.freeCashFlow) parts.push(`Free Cash Flow: ${this.formatCurrency(data.financialMetrics.freeCashFlow, data.companyInfo?.currency)}`);
    
    // Growth metrics
    if (data.growthMetrics?.revenueGrowth) parts.push(`Revenue Growth: ${data.growthMetrics.revenueGrowth}%`);
    
    // Key highlights
    if (data.keyHighlights?.length) {
      parts.push(`Key Highlights: ${data.keyHighlights.slice(0, 3).join('; ')}`);
    }
    
    return parts.join(' | ');
  }

  private createIncomeStatementContent(incomeStatement: any): string {
    const parts = [];
    if (incomeStatement.revenue) parts.push(`Revenue: ${this.formatNumber(incomeStatement.revenue)}`);
    if (incomeStatement.grossProfit) parts.push(`Gross Profit: ${this.formatNumber(incomeStatement.grossProfit)}`);
    if (incomeStatement.operatingIncome) parts.push(`Operating Income: ${this.formatNumber(incomeStatement.operatingIncome)}`);
    if (incomeStatement.netIncome) parts.push(`Net Income: ${this.formatNumber(incomeStatement.netIncome)}`);
    return parts.join(' | ');
  }

  private createBalanceSheetContent(balanceSheet: any): string {
    const parts = [];
    if (balanceSheet.totalAssets) parts.push(`Total Assets: ${this.formatNumber(balanceSheet.totalAssets)}`);
    if (balanceSheet.totalLiabilities) parts.push(`Total Liabilities: ${this.formatNumber(balanceSheet.totalLiabilities)}`);
    if (balanceSheet.shareholdersEquity) parts.push(`Shareholders Equity: ${this.formatNumber(balanceSheet.shareholdersEquity)}`);
    return parts.join(' | ');
  }

  private createCashFlowContent(cashFlow: any): string {
    const parts = [];
    if (cashFlow.operatingCashFlow) parts.push(`Operating Cash Flow: ${this.formatNumber(cashFlow.operatingCashFlow)}`);
    if (cashFlow.freeCashFlow) parts.push(`Free Cash Flow: ${this.formatNumber(cashFlow.freeCashFlow)}`);
    if (cashFlow.capitalExpenditures) parts.push(`CapEx: ${this.formatNumber(cashFlow.capitalExpenditures)}`);
    return parts.join(' | ');
  }

  private createMetricsContent(metrics: any): string {
    const parts: string[] = [];
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        parts.push(`${key}: ${this.formatMetric(key, value as number)}`);
      }
    });
    return parts.join(' | ');
  }

  private formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private formatNumber(num: number): string {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  }

  private formatMetric(key: string, value: number): string {
    const percentageMetrics = ['grossMargin', 'operatingMargin', 'netMargin', 'roe', 'roa', 'revenueGrowth', 'netIncomeGrowth', 'epsGrowth'];
    if (percentageMetrics.includes(key)) {
      return `${value.toFixed(1)}%`;
    }
    return value.toString();
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async storeFinancialChunks(chunks: FinancialDocumentChunk[]): Promise<void> {
    if (this.useSupabase) {
      // Store in Supabase database (parent-child relationships temporarily disabled)
      console.log(`💾 [FinanceRAG] Storing ${chunks.length} chunks in Supabase...`);
      await supabaseService.storeChunks(chunks);
    } else {
      // Fallback to in-memory storage for demo purposes
      globalChunkStorage.push(...chunks);
      console.log(`💾 [FinanceRAG] Stored ${chunks.length} chunks in memory. Total stored: ${globalChunkStorage.length}`);
    }
    console.log(`📋 [FinanceRAG] Stored chunk types:`, chunks.map(c => c.chunkType));
  }

  private async createFinancialProfile(documentId: string, structuredData: any): Promise<void> {
    if (this.useSupabase && structuredData) {
      try {
        const profile: FinancialProfile = {
          id: uuidv4(),
          documentId: documentId,
          companyName: structuredData.companyInfo?.companyName,
          ticker: structuredData.companyInfo?.ticker,
          sector: structuredData.companyInfo?.sector,
          industry: structuredData.companyInfo?.industry,
          marketCap: structuredData.companyInfo?.marketCap,
          reportType: structuredData.reportInfo?.reportType,
          fiscalPeriod: structuredData.reportInfo?.fiscalPeriod,
          fiscalYear: structuredData.reportInfo?.fiscalYear,
          quarter: structuredData.reportInfo?.quarter,
          reportingDate: structuredData.reportInfo?.reportingDate,
          currency: structuredData.companyInfo?.currency || 'USD',
          
          revenue: structuredData.financialMetrics?.revenue,
          netIncome: structuredData.financialMetrics?.netIncome,
          eps: structuredData.financialMetrics?.eps,
          grossMargin: structuredData.financialMetrics?.grossMargin,
          operatingMargin: structuredData.financialMetrics?.operatingMargin,
          netMargin: structuredData.financialMetrics?.netMargin,
          roe: structuredData.financialMetrics?.roe,
          roa: structuredData.financialMetrics?.roa,
          debtToEquity: structuredData.financialMetrics?.debtToEquity,
          currentRatio: structuredData.financialMetrics?.currentRatio,

          revenueGrowth: structuredData.growthMetrics?.revenueGrowth,
          netIncomeGrowth: structuredData.growthMetrics?.netIncomeGrowth,
          epsGrowth: structuredData.growthMetrics?.epsGrowth,

          totalAssets: structuredData.financialMetrics?.totalAssets, // Or balanceSheet?.totalAssets
          totalLiabilities: structuredData.financialMetrics?.totalLiabilities, // Or balanceSheet?.totalLiabilities
          shareholdersEquity: structuredData.financialMetrics?.shareholdersEquity, // Or balanceSheet?.shareholdersEquity
          operatingCashFlow: structuredData.financialMetrics?.operatingCashFlow, // Or cashFlowStatement?.operatingCashFlow
          freeCashFlow: structuredData.financialMetrics?.freeCashFlow, // Or cashFlowStatement?.freeCashFlow

          profileCompletenessScore: 0.8 // TODO: Calculate based on available data
        };
        
        await supabaseService.storeProfile(profile);
      } catch (error) {
        console.error('Error creating financial profile:', error);
      }
    } else {
      console.log('👤 [FinanceRAG] Creating financial profile for document:', documentId);
    }
  }

  /**
   * Debug method to check stored chunks
   */
  async getStoredChunksDebugInfo(): Promise<any> {
    if (this.useSupabase) {
      try {
        const stats = await supabaseService.getStats();
        return {
          storage: 'supabase',
          totalChunks: stats.totalChunks,
          totalProfiles: stats.totalProfiles,
          totalDocuments: stats.totalDocuments,
          chunkTypes: Object.keys(stats.chunksByType),
          chunksByType: stats.chunksByType,
          companies: stats.companiesProcessed,
          hasEmbeddings: stats.totalChunks // Assume all chunks have embeddings in Supabase
        };
      } catch (error) {
        console.error('Error getting Supabase stats:', error);
        return { storage: 'supabase', error: error instanceof Error ? error.message : 'Unknown error' };
      }
    } else {
      return {
        storage: 'memory',
        totalChunks: globalChunkStorage.length,
        chunkTypes: globalChunkStorage.map((c: FinancialDocumentChunk) => c.chunkType),
        companies: [...new Set(globalChunkStorage.map((c: FinancialDocumentChunk) => c.companyName).filter(Boolean))],
        hasEmbeddings: globalChunkStorage.filter((c: FinancialDocumentChunk) => c.embedding).length,
        sampleContent: globalChunkStorage.slice(0, 2).map((c: FinancialDocumentChunk) => ({
          title: c.title,
          contentPreview: c.content.substring(0, 100) + '...',
          hasEmbedding: !!c.embedding
        }))
      };
    }
  }

  private async generateFinancialSearchSuggestions(query: string): Promise<string[]> {
    const suggestions = [
      'revenue growth trends',
      'profit margin analysis',
      'cash flow performance',
      'debt-to-equity ratios',
      'earnings per share',
      'return on equity',
      'quarterly comparisons',
      'year-over-year growth',
    ];
    
    return suggestions.filter(s => 
      s.toLowerCase().includes(query.toLowerCase().split(' ')[0])
    ).slice(0, 3);
  }

  /**
   * Legacy search implementation (fallback)
   */
  private async searchWithLegacyRAG(query: FinanceRAGQuery, startTime: number): Promise<FinanceRAGResponse> {
    console.log(`🔍 [FinanceRAG] Performing legacy search for: "${query.query}"`);
    
    const initialRpcThreshold = 0.01; // For fetching top K from DB

    const finalResults = await this._performAdvancedVectorSearch(
      query.query,
      query.filters,
      query.maxResults ? query.maxResults * 2 : 20, 
      query.maxResults || 10,
      initialRpcThreshold
    );

    // Optional: Apply a final hard threshold if the user specified one in the query,
    // and if it's stricter than what the adaptive filter might have allowed.
    let hardFilteredResults = finalResults; 
    // if (query.similarityThreshold && query.similarityThreshold > 0) { // <-- COMMENTED OUT
    //   const userThreshold = query.similarityThreshold;
    //   hardFilteredResults = finalResults.filter(r => r.similarity >= userThreshold);
    //   if (hardFilteredResults.length < finalResults.length) {
    //     console.log(`🔪 [FinanceRAG] Applied final hard threshold of ${userThreshold}, reduced results from ${finalResults.length} to ${hardFilteredResults.length}`);
    //   }
    // }
    
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ [FinanceRAG] Legacy search completed in ${processingTime}ms, found ${hardFilteredResults.length} results.`);

    const financialProfiles: FinancialProfile[] = [];
    if (hardFilteredResults.length > 0 && this.useSupabase) {
      const companyNames = [...new Set(hardFilteredResults.map(r => r.companyName).filter(Boolean) as string[])];
      if (companyNames.length > 0) {
        console.log(`ℹ️ [FinanceRAG] Profile fetching for companies: ${companyNames.join(', ')} (currently placeholder)`);
      }
    } else if (hardFilteredResults.length > 0 && !this.useSupabase) {
        console.log('ℹ️ [FinanceRAG] In-memory profile retrieval (placeholder)');
    }
    
    const suggestions = await this.generateFinancialSearchSuggestions(query.query);

    return {
      results: hardFilteredResults, 
      financialProfiles,
      totalResults: hardFilteredResults.length,
      processingTime,
      query: query.query,
      suggestions,
    };
  }

  // New method for advanced vector search with adaptive filtering
  private async _performAdvancedVectorSearch(
    originalQuery: string,
    filters?: FinanceRAGQuery['filters'],
    maxResultsInitial: number = 20,
    maxResultsFinal: number = 10,
    // Use a very low threshold for initial DB fetch to get top K
    // The user's threshold from query.similarityThreshold can be used as a final hard cut if needed,
    // or to adjust the adaptive filter's strictness.
    // For now, this initial threshold is for the DB call.
    similarityThresholdInitialRpc: number = 0.01 
  ): Promise<FinancialSearchResult[]> {
    
    const rewrittenQuery = rewriteQueryForEmbedding(originalQuery);
    if (originalQuery !== rewrittenQuery) {
      console.log(`🔄 [FinanceRAG] Query rewritten for embedding: "${rewrittenQuery}"`);
    }

    const queryEmbedding = await this.generateEmbedding(rewrittenQuery);

    let searchResults = await supabaseService.searchChunks(queryEmbedding, {
      similarityThreshold: similarityThresholdInitialRpc, // Pass the low threshold for DB RPC
      maxResults: maxResultsInitial,
      companyFilter: filters?.companies?.[0], 
      reportTypeFilter: filters?.reportTypes?.[0],
      fiscalYearFilter: filters?.fiscalYears?.[0],
    });

    searchResults.sort((a, b) => b.similarity - a.similarity);

    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    const bestSimilarity = searchResults[0].similarity;
    // Adaptive filter: s_current >= 1.5 * s_best - 0.5
    // Clamped at 0 to prevent negative thresholds for very low bestSimilarity.
    let minAcceptedSimilarityAdaptive = Math.max(0, (1.5 * bestSimilarity) - 0.5);
    
    console.log(`📊 [FinanceRAG] Adaptive filtering: Best similarity=${bestSimilarity.toFixed(4)}, Calculated adaptive min_sim=${minAcceptedSimilarityAdaptive.toFixed(4)}`);

    // Optional: If user provided a threshold in the original query, ensure we don't go below that.
    // const userOriginalThreshold = filters?. // This was not part of FinanceRAGQuery structure for searchWithLegacyRAG call before
    // Let's assume query.similarityThreshold is the user's desired *final* minimum if provided
    // This field is on FinanceRAGQuery, not filters.
    // For now, the _performAdvancedVectorSearch doesn't directly see query.similarityThreshold.
    // searchWithLegacyRAG should decide how to use it.

    const adaptivelyFilteredResults = searchResults.filter(
      (result) => result.similarity >= minAcceptedSimilarityAdaptive
    );
    
    console.log(`🔎 [FinanceRAG] Results after adaptive filter: ${adaptivelyFilteredResults.length}`);

    return adaptivelyFilteredResults.slice(0, maxResultsFinal);
  }

  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const financeRagService = new FinanceRAGService();

// Step 4: Pinpoint rogue flags / alternate paths
Object.defineProperty(financeRagService, 'useModernRAG', {
  get() { return true; }, // Keep it true as per current logic
  set(v) { console.warn('useModernRAG mutation ignored', v); return true; } // Prevent mutation and log
});

// Debug function for browser console
(window as any).debugFinanceRAG = async () => {
  const debugInfo = await financeRagService.getStoredChunksDebugInfo();
  console.log('🔍 [Debug] Finance RAG Storage Info:', debugInfo);
  return debugInfo;
};

// Step 5: Eliminate hot-reload artefacts
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('♻️ financeRagService HMR accept – full reload forced');
    location.reload();
  });
} 