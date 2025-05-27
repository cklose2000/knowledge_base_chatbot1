import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { FinancialDocumentChunk, FinancialProfile, FinancialSearchResult } from './financeRagService';

// Database types based on our schema
export interface DatabaseChunk {
  id: string;
  document_id: string;
  parent_chunk_id?: string;
  chunk_level: number;
  chunk_order: number;
  chunk_type: string;
  title?: string;
  content: string;
  token_count: number;
  section_type?: string;
  company_name?: string;
  ticker?: string;
  report_type?: string;
  fiscal_period?: string;
  fiscal_year?: number;
  quarter?: number;
  reporting_date?: string;
  currency?: string;
  metrics?: string[];
  financial_statements?: string[];
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseProfile {
  id: string;
  document_id: string;
  company_name?: string;
  ticker?: string;
  sector?: string;
  industry?: string;
  market_cap?: number;
  report_type?: string;
  fiscal_period?: string;
  fiscal_year?: number;
  quarter?: number;
  reporting_date?: string;
  currency?: string;
  revenue?: number;
  net_income?: number;
  eps?: number;
  gross_margin?: number;
  operating_margin?: number;
  net_margin?: number;
  roe?: number;
  roa?: number;
  debt_to_equity?: number;
  current_ratio?: number;
  revenue_growth?: number;
  net_income_growth?: number;
  eps_growth?: number;
  total_assets?: number;
  total_liabilities?: number;
  shareholders_equity?: number;
  operating_cash_flow?: number;
  free_cash_flow?: number;
  profile_completeness_score?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessingLogEntry {
  id: string;
  document_id: string;
  filename: string;
  file_size?: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_method?: 'llmwhisperer' | 'pdf_js' | 'manual';
  total_chunks_created?: number;
  total_characters_extracted?: number;
  processing_time_ms?: number;
  error_message?: string;
  error_details?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
}

class SupabaseService {
  private supabase: SupabaseClient;
  private isEnabled: boolean;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    this.isEnabled = !!(supabaseUrl && supabaseKey);
    
    if (this.isEnabled) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('🗄️ [Supabase] Service initialized successfully');
    } else {
      console.log('⚠️ [Supabase] Service disabled - missing environment variables');
      // Create a mock client to prevent errors
      this.supabase = {} as SupabaseClient;
    }
  }

  /**
   * Check if Supabase is properly configured
   */
  isConfigured(): boolean {
    return this.isEnabled;
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Connection test skipped - service disabled');
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('financial_document_chunks')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('🚨 [Supabase] Connection test failed:', error);
        return false;
      }
      
      console.log('✅ [Supabase] Connection test successful');
      return true;
    } catch (error) {
      console.error('🚨 [Supabase] Connection test error:', error);
      return false;
    }
  }

  /**
   * Store financial document chunks
   */
  async storeChunks(chunks: FinancialDocumentChunk[]): Promise<void> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Chunk storage skipped - service disabled');
      return;
    }

    try {
      console.log(`💾 [Supabase] Storing ${chunks.length} chunks...`);
      
      const dbChunks: Omit<DatabaseChunk, 'id' | 'created_at' | 'updated_at'>[] = chunks.map(chunk => ({
        document_id: chunk.documentId,
        parent_chunk_id: chunk.parentChunkId,
        chunk_level: chunk.chunkLevel,
        chunk_order: chunk.chunkOrder,
        chunk_type: chunk.chunkType,
        title: chunk.title,
        content: chunk.content,
        token_count: chunk.tokenCount,
        section_type: chunk.sectionType,
        company_name: chunk.companyName,
        report_type: chunk.reportType,
        fiscal_period: chunk.fiscalPeriod,
        fiscal_year: chunk.fiscalYear,
        quarter: chunk.quarter,
        reporting_date: chunk.reportingDate,
        currency: chunk.currency,
        metrics: chunk.metrics,
        financial_statements: chunk.financialStatements,
        embedding: chunk.embedding,
        metadata: {}
      }));

      const { data, error } = await this.supabase
        .from('financial_document_chunks')
        .insert(dbChunks)
        .select();

      if (error) {
        console.error('🚨 [Supabase] Error storing chunks:', error);
        throw new Error(`Failed to store chunks: ${error.message}`);
      }

      console.log(`✅ [Supabase] Successfully stored ${data?.length || 0} chunks`);
    } catch (error) {
      console.error('🚨 [Supabase] Chunk storage error:', error);
      throw error;
    }
  }

  /**
   * Store financial profile
   */
  async storeProfile(profile: FinancialProfile): Promise<void> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Profile storage skipped - service disabled');
      return;
    }

    try {
      console.log(`👤 [Supabase] Storing financial profile for ${profile.companyName}...`);
      
      const dbProfile: Omit<DatabaseProfile, 'id' | 'created_at' | 'updated_at'> = {
        document_id: profile.documentId,
        company_name: profile.companyName,
        ticker: profile.ticker,
        sector: profile.sector,
        industry: profile.industry,
        market_cap: profile.marketCap,
        report_type: profile.reportType,
        fiscal_period: profile.fiscalPeriod,
        fiscal_year: profile.fiscalYear,
        quarter: profile.quarter,
        reporting_date: profile.reportingDate,
        currency: profile.currency,
        revenue: profile.revenue,
        net_income: profile.netIncome,
        eps: profile.eps,
        gross_margin: profile.grossMargin,
        operating_margin: profile.operatingMargin,
        net_margin: profile.netMargin,
        roe: profile.roe,
        roa: profile.roa,
        debt_to_equity: profile.debtToEquity,
        current_ratio: profile.currentRatio,
        revenue_growth: profile.revenueGrowth,
        net_income_growth: profile.netIncomeGrowth,
        eps_growth: profile.epsGrowth,
        total_assets: profile.totalAssets,
        total_liabilities: profile.totalLiabilities,
        shareholders_equity: profile.shareholdersEquity,
        operating_cash_flow: profile.operatingCashFlow,
        free_cash_flow: profile.freeCashFlow,
        profile_completeness_score: profile.profileCompletenessScore
      };

      const { data, error } = await this.supabase
        .from('financial_profiles')
        .upsert(dbProfile, { onConflict: 'document_id' })
        .select();

      if (error) {
        console.error('🚨 [Supabase] Error storing profile:', error);
        throw new Error(`Failed to store profile: ${error.message}`);
      }

      console.log(`✅ [Supabase] Successfully stored profile for ${profile.companyName}`);
    } catch (error) {
      console.error('🚨 [Supabase] Profile storage error:', error);
      throw error;
    }
  }

  /**
   * Search financial chunks using vector similarity
   */
  async searchChunks(
    queryEmbedding: number[],
    options: {
      similarityThreshold?: number;
      maxResults?: number;
      companyFilter?: string;
      reportTypeFilter?: string;
      fiscalYearFilter?: number;
    } = {}
  ): Promise<FinancialSearchResult[]> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Search skipped - service disabled');
      return [];
    }

    try {
      const {
        similarityThreshold = 0.7,
        maxResults = 10,
        companyFilter,
        reportTypeFilter,
        fiscalYearFilter
      } = options;

      console.log(`🔍 [Supabase] Searching chunks with similarity threshold ${similarityThreshold}...`);

      // Use the custom search function we created in the schema
      const { data, error } = await this.supabase
        .rpc('search_financial_chunks', {
          query_embedding: queryEmbedding,
          similarity_threshold: similarityThreshold,
          max_results: maxResults,
          company_filter: companyFilter,
          report_type_filter: reportTypeFilter,
          fiscal_year_filter: fiscalYearFilter
        });

      if (error) {
        console.error('🚨 [Supabase] Search error:', error);
        throw new Error(`Search failed: ${error.message}`);
      }

      const results: FinancialSearchResult[] = (data || []).map((row: any) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        similarity: parseFloat(row.similarity),
        chunkType: row.chunk_type,
        title: row.title,
        content: row.content,
        companyName: row.company_name,
        reportType: row.report_type,
        fiscalPeriod: row.fiscal_period,
        metrics: row.metrics,
        metadata: row.metadata || {}
      }));

      console.log(`✅ [Supabase] Found ${results.length} matching chunks`);
      return results;
    } catch (error) {
      console.error('🚨 [Supabase] Search error:', error);
      throw error;
    }
  }

  /**
   * Get financial profiles with optional filters
   */
  async getFinancialProfiles(options: {
    companyFilter?: string;
    fiscalYearFilter?: number;
    limit?: number;
  } = {}): Promise<FinancialProfile[]> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Profile retrieval skipped - service disabled');
      return [];
    }

    try {
      const { companyFilter, fiscalYearFilter, limit = 50 } = options;

      let query = this.supabase
        .from('financial_profiles')
        .select('*');

      if (companyFilter) {
        query = query.ilike('company_name', `%${companyFilter}%`);
      }

      if (fiscalYearFilter) {
        query = query.eq('fiscal_year', fiscalYearFilter);
      }

      query = query
        .order('fiscal_year', { ascending: false })
        .order('quarter', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) {
        console.error('🚨 [Supabase] Profile retrieval error:', error);
        throw new Error(`Failed to retrieve profiles: ${error.message}`);
      }

      const profiles: FinancialProfile[] = (data || []).map((row: DatabaseProfile) => ({
        id: row.id,
        documentId: row.document_id,
        companyName: row.company_name,
        ticker: row.ticker,
        sector: row.sector,
        industry: row.industry,
        marketCap: row.market_cap,
        reportType: row.report_type,
        fiscalPeriod: row.fiscal_period,
        fiscalYear: row.fiscal_year,
        quarter: row.quarter,
        reportingDate: row.reporting_date,
        currency: row.currency,
        revenue: row.revenue,
        netIncome: row.net_income,
        eps: row.eps,
        grossMargin: row.gross_margin,
        operatingMargin: row.operating_margin,
        netMargin: row.net_margin,
        roe: row.roe,
        roa: row.roa,
        debtToEquity: row.debt_to_equity,
        currentRatio: row.current_ratio,
        revenueGrowth: row.revenue_growth,
        netIncomeGrowth: row.net_income_growth,
        epsGrowth: row.eps_growth,
        totalAssets: row.total_assets,
        totalLiabilities: row.total_liabilities,
        shareholdersEquity: row.shareholders_equity,
        operatingCashFlow: row.operating_cash_flow,
        freeCashFlow: row.free_cash_flow,
        profileCompletenessScore: row.profile_completeness_score
      }));

      console.log(`✅ [Supabase] Retrieved ${profiles.length} financial profiles`);
      return profiles;
    } catch (error) {
      console.error('🚨 [Supabase] Profile retrieval error:', error);
      throw error;
    }
  }

  /**
   * Log document processing status
   */
  async logProcessing(entry: Omit<ProcessingLogEntry, 'id' | 'created_at'>): Promise<void> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Processing log skipped - service disabled');
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from('document_processing_log')
        .insert(entry)
        .select();

      if (error) {
        console.error('🚨 [Supabase] Processing log error:', error);
        throw new Error(`Failed to log processing: ${error.message}`);
      }

      console.log(`📝 [Supabase] Logged processing for document ${entry.document_id}`);
    } catch (error) {
      console.error('🚨 [Supabase] Processing log error:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    totalProfiles: number;
    totalDocuments: number;
    chunksByType: Record<string, number>;
    companiesProcessed: string[];
  }> {
    if (!this.isEnabled) {
      return {
        totalChunks: 0,
        totalProfiles: 0,
        totalDocuments: 0,
        chunksByType: {},
        companiesProcessed: []
      };
    }

    try {
      // Get total counts
      const [chunksResult, profilesResult, documentsResult] = await Promise.all([
        this.supabase.from('financial_document_chunks').select('id', { count: 'exact', head: true }),
        this.supabase.from('financial_profiles').select('id', { count: 'exact', head: true }),
        this.supabase.from('financial_document_chunks').select('document_id')
      ]);

      // Get chunks by type
      const { data: chunkTypes } = await this.supabase
        .from('financial_document_chunks')
        .select('chunk_type')
        .not('chunk_type', 'is', null);

      const chunksByType: Record<string, number> = {};
      chunkTypes?.forEach(row => {
        chunksByType[row.chunk_type] = (chunksByType[row.chunk_type] || 0) + 1;
      });

      // Get companies processed
      const { data: companies } = await this.supabase
        .from('financial_profiles')
        .select('company_name')
        .not('company_name', 'is', null);

      const companiesProcessed = [...new Set(companies?.map(row => row.company_name) || [])];

      // Get unique document count
      const uniqueDocuments = [...new Set(documentsResult.data?.map(row => row.document_id) || [])];

      return {
        totalChunks: chunksResult.count || 0,
        totalProfiles: profilesResult.count || 0,
        totalDocuments: uniqueDocuments.length,
        chunksByType,
        companiesProcessed
      };
    } catch (error) {
      console.error('🚨 [Supabase] Stats retrieval error:', error);
      return {
        totalChunks: 0,
        totalProfiles: 0,
        totalDocuments: 0,
        chunksByType: {},
        companiesProcessed: []
      };
    }
  }

  /**
   * Clear all data (for testing/development)
   */
  async clearAllData(): Promise<void> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Clear data skipped - service disabled');
      return;
    }

    try {
      console.log('🗑️ [Supabase] Clearing all data...');
      
      await Promise.all([
        this.supabase.from('financial_document_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        this.supabase.from('financial_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        this.supabase.from('document_processing_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        this.supabase.from('search_analytics').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]);

      console.log('✅ [Supabase] All data cleared successfully');
    } catch (error) {
      console.error('🚨 [Supabase] Clear data error:', error);
      throw error;
    }
  }
}

export const supabaseService = new SupabaseService(); 