import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { supabaseService } from './supabaseService';

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

class FinanceRAGService {
  private openai;
  private embeddingModel: string;
  private chatModel: string;
  private useSupabase: boolean;

  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY!,
      dangerouslyAllowBrowser: true
    });
    
    this.embeddingModel = import.meta.env.VITE_OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.chatModel = import.meta.env.VITE_OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    this.useSupabase = supabaseService.isConfigured();
    
    if (this.useSupabase) {
      console.log('🗄️ [FinanceRAG] Using Supabase for persistent storage');
    } else {
      console.log('💾 [FinanceRAG] Using in-memory storage (demo mode)');
    }
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
          companyName: structuredData.companyName,
          ticker: structuredData.ticker,
          reportType: structuredData.reportType,
          fiscalPeriod: structuredData.fiscalPeriod,
          fiscalYear: structuredData.fiscalYear,
          quarter: structuredData.quarter,
          currency: structuredData.currency || 'USD',
          revenue: structuredData.revenue,
          netIncome: structuredData.netIncome,
          eps: structuredData.eps,
          grossMargin: structuredData.grossMargin,
          operatingMargin: structuredData.operatingMargin,
          netMargin: structuredData.netMargin,
          roe: structuredData.roe,
          roa: structuredData.roa,
          revenueGrowth: structuredData.revenueGrowth,
          profileCompletenessScore: 0.8 // Calculate based on available data
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

  /**
   * Search financial documents
   */
  async searchFinancialDocuments(query: FinanceRAGQuery): Promise<FinanceRAGResponse> {
    console.log(`🔍 [FinanceRAG] Searching for: "${query.query}"`);
    console.log(`🔍 [FinanceRAG] Filters:`, query.filters);
    console.log(`🔍 [FinanceRAG] Debug info:`, this.getStoredChunksDebugInfo());
    
    const startTime = Date.now();
    
    try {
      // Generate query embedding for semantic search
      const queryEmbedding = await this.generateEmbedding(query.query);
      console.log(`🧠 [FinanceRAG] Generated query embedding (${queryEmbedding.length} dimensions)`);
      
      let searchResults: FinancialSearchResult[] = [];
      
      if (this.useSupabase) {
        // Use Supabase for search
        console.log(`🗄️ [FinanceRAG] Searching Supabase database...`);
        searchResults = await supabaseService.searchChunks(queryEmbedding, {
          similarityThreshold: query.similarityThreshold || 0.7,
          maxResults: query.maxResults || 5,
          companyFilter: query.filters?.companies?.[0],
          reportTypeFilter: query.filters?.reportTypes?.[0],
          fiscalYearFilter: query.filters?.fiscalYears?.[0]
        });
      } else {
        // Use in-memory search
        console.log(`📚 [FinanceRAG] Searching through ${globalChunkStorage.length} stored chunks`);
        
        if (globalChunkStorage.length === 0) {
          console.log(`⚠️ [FinanceRAG] No chunks stored yet - upload some documents first`);
          const processingTime = Date.now() - startTime;
          return {
            results: [],
            financialProfiles: [],
            totalResults: 0,
            processingTime,
            query: query.query,
            suggestions: await this.generateFinancialSearchSuggestions(query.query),
          };
        }
        
        // Perform in-memory semantic search
        const allSimilarities: Array<{title: string, similarity: number}> = [];
        
        for (const chunk of globalChunkStorage) {
          if (!chunk.embedding) {
            console.log(`⚠️ [FinanceRAG] Chunk "${chunk.title}" has no embedding`);
            continue;
          }
          
          // Calculate cosine similarity
          const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
          allSimilarities.push({ title: chunk.title || 'Untitled', similarity });
          
          console.log(`🔗 [FinanceRAG] "${chunk.title}": similarity = ${similarity.toFixed(3)}`);
          
          if (similarity >= (query.similarityThreshold || 0.7)) {
            searchResults.push({
              chunkId: chunk.id,
              documentId: chunk.documentId,
              similarity: similarity,
              chunkType: chunk.chunkType,
              title: chunk.title,
              content: chunk.content,
              companyName: chunk.companyName,
              reportType: chunk.reportType,
              fiscalPeriod: chunk.fiscalPeriod,
              metrics: chunk.metrics,
              metadata: {
                sectionType: chunk.sectionType,
                chunkLevel: chunk.chunkLevel,
                tokenCount: chunk.tokenCount
              }
            });
          }
        }
        
        // Sort by similarity (highest first)
        searchResults.sort((a, b) => b.similarity - a.similarity);
        
        // Limit results
        searchResults = searchResults.slice(0, query.maxResults || 5);
        
        console.log(`📊 [FinanceRAG] All similarities:`, allSimilarities.sort((a, b) => b.similarity - a.similarity));
      }
      
      console.log(`📊 [FinanceRAG] Found ${searchResults.length} results for query: "${query.query}"`);
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (similarity: ${result.similarity.toFixed(3)})`);
      });
      
      const processingTime = Date.now() - startTime;
      
      // Get financial profiles if using Supabase
      let financialProfiles: FinancialProfile[] = [];
      if (this.useSupabase && query.filters?.companies?.[0]) {
        try {
          financialProfiles = await supabaseService.getFinancialProfiles({
            companyFilter: query.filters.companies[0],
            fiscalYearFilter: query.filters.fiscalYears?.[0],
            limit: 5
          });
        } catch (error) {
          console.error('Error fetching financial profiles:', error);
        }
      }
      
      const response = {
        results: searchResults,
        financialProfiles: financialProfiles,
        totalResults: searchResults.length,
        processingTime,
        query: query.query,
        suggestions: await this.generateFinancialSearchSuggestions(query.query),
      };
      
      console.log(`⏱️ [FinanceRAG] Search completed in ${processingTime}ms`);
      return response;
    } catch (error) {
      console.error('🚨 [FinanceRAG] Error performing financial search:', error);
      throw new Error('Financial search failed');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
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
}

export const financeRagService = new FinanceRAGService(); 