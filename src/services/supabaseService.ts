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

// New interface for the processed_documents table
export interface DatabaseProcessedDocument {
  id: string; // UUID, maps to documentId
  document_title?: string;
  company_name?: string;
  report_type?: string;
  fiscal_period?: string;
  fiscal_year?: number;
  full_text_content: string;
  token_count?: number;
  // embedding?: number[]; // For later if document-level embeddings are added
  created_at?: string;
  updated_at?: string;
}

export interface MinimalDocumentProfile {
  companyName?: string;
  fiscalPeriod?: string;
  reportType?: string;
  fiscalYear?: number;
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
      
      const parentDbChunks: DatabaseChunk[] = [];
      const childDbChunks: DatabaseChunk[] = [];

      chunks.forEach(chunk => {
        const dbChunk: DatabaseChunk = {
          id: chunk.id, // Include the pre-generated UUID
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
          metadata: {} // Ensure metadata is at least an empty object if not provided
        };
        if (chunk.parentChunkId) {
          childDbChunks.push(dbChunk);
        } else {
          parentDbChunks.push(dbChunk);
        }
      });

      let totalStoredCount = 0;

      // Insert parent chunks first
      if (parentDbChunks.length > 0) {
        console.log(`[Supabase] Inserting ${parentDbChunks.length} parent chunks...`);
        const { data: parentData, error: parentError } = await this.supabase
          .from('financial_document_chunks')
          .insert(parentDbChunks)
          .select('id'); // Only select id to confirm insertion

        if (parentError) {
          console.error('🚨 [Supabase] Error storing parent chunks:', parentError);
          throw new Error(`Failed to store parent chunks: ${parentError.message}`);
        }
        totalStoredCount += parentData?.length || 0;
        console.log(`✅ [Supabase] Successfully stored ${parentData?.length || 0} parent chunks.`);
      }

      // Insert child chunks next
      if (childDbChunks.length > 0) {
        console.log(`[Supabase] Inserting ${childDbChunks.length} child chunks...`);
        const { data: childData, error: childError } = await this.supabase
          .from('financial_document_chunks')
          .insert(childDbChunks)
          .select('id'); // Only select id to confirm insertion

        if (childError) {
          console.error('🚨 [Supabase] Error storing child chunks:', childError);
          // Note: If parent chunks succeeded but child chunks fail, you might have orphaned parents.
          // Consider transactional handling or cleanup logic for production.
          throw new Error(`Failed to store child chunks: ${childError.message}`);
        }
        totalStoredCount += childData?.length || 0;
        console.log(`✅ [Supabase] Successfully stored ${childData?.length || 0} child chunks.`);
      }

      console.log(`✅ [Supabase] Successfully stored a total of ${totalStoredCount} chunks.`);
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
   * Store full processed document text and metadata.
   */
  async storeProcessedDocument(document: Omit<DatabaseProcessedDocument, 'created_at' | 'updated_at'>): Promise<void> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Full document storage skipped - service disabled');
      return;
    }

    try {
      console.log(`💾 [Supabase] Storing full document ${document.id}...`);
      
      const { data, error } = await this.supabase
        .from('processed_documents')
        .upsert(document, { onConflict: 'id' }) // Upsert to handle reprocessing
        .select();

      if (error) {
        console.error('🚨 [Supabase] Error storing full document:', error);
        throw new Error(`Failed to store full document ${document.id}: ${error.message}`);
      }

      console.log(`✅ [Supabase] Successfully stored full document ${data?.[0]?.id || document.id}`);
    } catch (error) {
      console.error('🚨 [Supabase] Full document storage error:', error);
      throw error;
    }
  }

  /**
   * Fetch minimal profile information for a document to aid in query rewriting.
   */
  async getMinimalProfileForDocument(documentId: string): Promise<MinimalDocumentProfile | null> {
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Minimal profile fetch skipped - service disabled');
      return null;
    }
    try {
      // Attempt to get from financial_document_profiles first
      let { data: profileData, error: profileError } = await this.supabase
        .from('financial_document_profiles') // Assuming this is your profiles table
        .select('company_name, fiscal_period, report_type, fiscal_year')
        .eq('document_id', documentId)
        .maybeSingle();

      if (profileError) {
        console.warn(`[Supabase] Error fetching profile for doc ${documentId}:`, profileError.message);
        // Fallback: try to get some info from the chunks table if profile is missing
      }

      if (profileData && (profileData.company_name || profileData.fiscal_period)) {
        return {
          companyName: profileData.company_name,
          fiscalPeriod: profileData.fiscal_period,
          reportType: profileData.report_type,
          fiscalYear: profileData.fiscal_year
        };
      }

      // Fallback: if no profile or incomplete, try to get from a chunk
      console.log(`[Supabase] No direct profile for ${documentId} or incomplete, trying fallback from chunks.`);
      const { data: chunkData, error: chunkError } = await this.supabase
        .from('financial_document_chunks') // Your main chunks table
        .select('company_name, fiscal_period, report_type, fiscal_year')
        .eq('document_id', documentId)
        .limit(1)
        .maybeSingle();
      
      if (chunkError) {
        console.warn(`[Supabase] Error fetching chunk data for profile fallback (doc ${documentId}):`, chunkError.message);
        return null;
      }

      if (chunkData) {
        return {
          companyName: chunkData.company_name,
          fiscalPeriod: chunkData.fiscal_period,
          reportType: chunkData.report_type,
          fiscalYear: chunkData.fiscal_year
        };
      }
      console.log(`[Supabase] No profile information found for document ${documentId} even in chunks.`);
      return null;

    } catch (error: any) {
      console.error(`🚨 [Supabase] Unexpected error in getMinimalProfileForDocument for ${documentId}:`, error.message);
      return null;
    }
  }

  /**
   * Search for relevant chunks using vector similarity and query the new view.
   */
  async searchChunks(
    queryEmbedding: number[],
    options: {
      similarityThreshold?: number; // This is the RPC function's match_threshold (0 to 1 for cosine similarity)
      maxResults?: number;
      companyFilter?: string;
      reportTypeFilter?: string;
      fiscalYearFilter?: number;
      // documentIdFilter?: string; // Optional: if you want to scope search to a single doc
    } = {}
  ): Promise<FinancialSearchResult[]> { // Ensure FinancialSearchResult includes parent_content and parent_id
    if (!this.isEnabled) {
      console.log('⚠️ [Supabase] Chunk search skipped - service disabled');
      return [];
    }

    const {
      similarityThreshold = 0.1, // Default match_threshold for the RPC call
      maxResults = 10,
      companyFilter,
      reportTypeFilter,
      fiscalYearFilter,
      // documentIdFilter
    } = options;

    try {
      console.log(`🔍 [Supabase] Calling RPC match_document_chunks_with_parents with threshold: ${similarityThreshold}, limit: ${maxResults}`);
      
      // Prepare filters for the RPC call
      // The RPC function will need to be designed to handle these filters.
      // For now, we'll assume it can take them as parameters.
      // If not, you'd filter client-side *after* getting more results,
      // or modify the RPC/view to include WHERE clauses based on these.
      
      const rpcParams: any = {
        p_query_embedding: queryEmbedding,
        p_match_threshold: similarityThreshold, // Cosine similarity threshold
        p_match_count: maxResults,
      };

      // Add filters if provided. The RPC function needs to be set up to use these.
      if (companyFilter) rpcParams.p_company_name = companyFilter;
      if (reportTypeFilter) rpcParams.p_report_type = reportTypeFilter;
      if (fiscalYearFilter) rpcParams.p_fiscal_year = fiscalYearFilter;
      // if (documentIdFilter) rpcParams.p_document_id = documentIdFilter;


      // IMPORTANT: You need to create an RPC function in Supabase called 'match_document_chunks_with_parents'
      // This function will query the 'financial_document_chunks_with_parents' view.
      // Example RPC function (simplified, needs to handle filters and use the view):
      /*
        CREATE OR REPLACE FUNCTION match_document_chunks_with_parents (
          p_query_embedding vector(1536), -- Or your embedding size
          p_match_threshold float,
          p_match_count int,
          p_company_name text default null,
          p_report_type text default null,
          p_fiscal_year int default null
          -- p_document_id text default null -- if you add documentId filter
        )
        RETURNS TABLE (
          -- Match all columns from your 'financial_document_chunks_with_parents' view
          -- plus the similarity score
          id text,
          document_id text,
          content text,
          embedding vector, -- if you need it back
          chunk_type text,
          title text,
          company_name text,
          report_type text,
          fiscal_period text,
          fiscal_year int,
          quarter int,
          metrics text[],
          parent_chunk_id text,
          metadata jsonb,
          parent_content text,
          similarity float -- Calculated as 1 - (embedding <=> p_query_embedding)
        )
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RETURN QUERY
          SELECT
            v.id,
            v.document_id,
            v.content,
            v.embedding,
            v.chunk_type,
            v.title,
            v.company_name,
            v.report_type,
            v.fiscal_period,
            v.fiscal_year,
            v.quarter,
            v.metrics,
            v.parent_chunk_id,
            v.metadata,
            v.parent_content,
            (1 - (v.embedding <=> p_query_embedding)) AS similarity
          FROM financial_document_chunks_with_parents v
          WHERE (1 - (v.embedding <=> p_query_embedding)) >= p_match_threshold
            AND (p_company_name IS NULL OR v.company_name = p_company_name)
            AND (p_report_type IS NULL OR v.report_type = p_report_type)
            AND (p_fiscal_year IS NULL OR v.fiscal_year = p_fiscal_year)
            -- AND (p_document_id IS NULL OR v.document_id = p_document_id)
          ORDER BY similarity DESC
          LIMIT p_match_count;
        END;
        $$;
      */
      
      const { data, error } = await this.supabase.rpc('match_document_chunks_with_parents', rpcParams);

      if (error) {
        console.error('🚨 [Supabase] Error searching chunks via RPC:', error);
        throw new Error(`Failed to search chunks: ${error.message}`);
      }

      if (!data) {
        console.log('✅ [Supabase] No chunks found for the query.');
        return [];
      }

      console.log(`✅ [Supabase] Retrieved ${data.length} chunks after RPC call.`);

      // The RPC function should already return 'similarity'.
      // And it should return parent_content and parent_chunk_id (or parent_id)
      // from the view.
      return data.map((item: any) => ({
        chunkId: item.id, // or item.chunk_id if that's what your RPC returns
        documentId: item.document_id,
        content: item.content,
        title: item.title,
        companyName: item.company_name,
        reportType: item.report_type,
        fiscalPeriod: item.fiscal_period,
        fiscalYear: item.fiscal_year,
        quarter: item.quarter,
        metrics: item.metrics,
        chunkType: item.chunk_type,
        sectionType: item.section_type, // If available from view/RPC
        similarity: item.similarity,   // Directly from RPC
        parent_id: item.parent_chunk_id, // Or item.parent_id
        parent_content: item.parent_content, // Directly from RPC
        metadata: item.metadata // Assuming metadata is returned by RPC
      })) as FinancialSearchResult[]; // Ensure this type matches the returned structure

    } catch (error: any) {
      console.error('🚨 [Supabase] Chunk search error:', error.message);
      // Optionally re-throw or handle gracefully
      return []; // Return empty on error to prevent app crash
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
   * Debug method to check database contents
   */
  async debugDatabaseContents(): Promise<any> {
    if (!this.isEnabled) {
      return { error: 'Supabase not configured' };
    }

    try {
      // Check if RPC function exists
      const { data: functions, error: functionsError } = await this.supabase
        .rpc('search_financial_chunks', {
          query_embedding: new Array(1536).fill(0),
          similarity_threshold: 0.9,
          max_results: 1
        });

      let rpcStatus = 'working';
      if (functionsError) {
        rpcStatus = `error: ${functionsError.message}`;
      }

      // Check chunks table
      const { data: chunks, error: chunksError } = await this.supabase
        .from('financial_document_chunks')
        .select('id, document_id, chunk_type, title, company_name, content')
        .limit(10);

      if (chunksError) {
        console.error('Error fetching chunks:', chunksError);
      }

      // Check profiles table
      const { data: profiles, error: profilesError } = await this.supabase
        .from('financial_profiles')
        .select('id, document_id, company_name, report_type')
        .limit(10);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Get counts
      const { count: chunkCount } = await this.supabase
        .from('financial_document_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: profileCount } = await this.supabase
        .from('financial_profiles')
        .select('*', { count: 'exact', head: true });

      return {
        rpcFunctionStatus: rpcStatus,
        totalChunks: chunkCount,
        totalProfiles: profileCount,
        sampleChunks: chunks?.map(c => ({
          id: c.id,
          documentId: c.document_id,
          chunkType: c.chunk_type,
          title: c.title,
          companyName: c.company_name,
          contentPreview: c.content?.substring(0, 100) + '...'
        })),
        sampleProfiles: profiles?.map(p => ({
          id: p.id,
          documentId: p.document_id,
          companyName: p.company_name,
          reportType: p.report_type
        }))
      };
    } catch (error) {
      console.error('Debug error:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
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

// Debug function for browser console
(window as any).debugSupabase = async () => {
  const debugInfo = await supabaseService.debugDatabaseContents();
  console.log('🗄️ [Debug] Supabase Database Contents:', debugInfo);
  return debugInfo;
}; 