-- AI Analyst Chat Interface - Supabase Database Schema
-- This file contains the complete database schema for financial document processing

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Financial Document Chunks Table
-- Stores processed document chunks with embeddings for semantic search
CREATE TABLE financial_document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL,
    parent_chunk_id UUID REFERENCES financial_document_chunks(id),
    chunk_level INTEGER NOT NULL DEFAULT 1,
    chunk_order INTEGER NOT NULL DEFAULT 1,
    chunk_type TEXT NOT NULL, -- executive_summary, income_statement, balance_sheet, etc.
    title TEXT,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    section_type TEXT, -- financial_statements, metrics, highlights, etc.
    
    -- Company and Report Information
    company_name TEXT,
    ticker TEXT,
    report_type TEXT, -- earnings, 10k, 10q, annual_report, etc.
    fiscal_period TEXT, -- Q1 2024, FY 2023, etc.
    fiscal_year INTEGER,
    quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4),
    reporting_date DATE,
    currency TEXT DEFAULT 'USD',
    
    -- Financial Context
    metrics TEXT[], -- revenue, net_income, eps, etc.
    financial_statements TEXT[], -- income_statement, balance_sheet, cash_flow
    
    -- Vector Embedding for Semantic Search
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimensions
    
    -- Metadata and Timestamps
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial Profiles Table
-- Stores extracted financial metrics and company profiles
CREATE TABLE financial_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL UNIQUE,
    
    -- Company Information
    company_name TEXT,
    ticker TEXT,
    sector TEXT,
    industry TEXT,
    market_cap BIGINT,
    
    -- Report Information
    report_type TEXT,
    fiscal_period TEXT,
    fiscal_year INTEGER,
    quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4),
    reporting_date DATE,
    currency TEXT DEFAULT 'USD',
    
    -- Key Financial Metrics (in base currency units)
    revenue BIGINT,
    net_income BIGINT,
    gross_profit BIGINT,
    operating_income BIGINT,
    ebitda BIGINT,
    
    -- Per Share Metrics
    eps DECIMAL(10,2),
    book_value_per_share DECIMAL(10,2),
    
    -- Margin Ratios (as percentages)
    gross_margin DECIMAL(5,2),
    operating_margin DECIMAL(5,2),
    net_margin DECIMAL(5,2),
    ebitda_margin DECIMAL(5,2),
    
    -- Return Ratios (as percentages)
    roe DECIMAL(5,2), -- Return on Equity
    roa DECIMAL(5,2), -- Return on Assets
    roic DECIMAL(5,2), -- Return on Invested Capital
    
    -- Liquidity Ratios
    current_ratio DECIMAL(5,2),
    quick_ratio DECIMAL(5,2),
    cash_ratio DECIMAL(5,2),
    
    -- Leverage Ratios
    debt_to_equity DECIMAL(5,2),
    debt_to_assets DECIMAL(5,2),
    interest_coverage DECIMAL(5,2),
    
    -- Growth Metrics (as percentages)
    revenue_growth DECIMAL(5,2),
    net_income_growth DECIMAL(5,2),
    eps_growth DECIMAL(5,2),
    
    -- Balance Sheet Items (in base currency units)
    total_assets BIGINT,
    total_liabilities BIGINT,
    shareholders_equity BIGINT,
    cash_and_equivalents BIGINT,
    total_debt BIGINT,
    
    -- Cash Flow Items (in base currency units)
    operating_cash_flow BIGINT,
    investing_cash_flow BIGINT,
    financing_cash_flow BIGINT,
    free_cash_flow BIGINT,
    capex BIGINT,
    
    -- Valuation Metrics
    pe_ratio DECIMAL(5,2),
    pb_ratio DECIMAL(5,2),
    price_to_sales DECIMAL(5,2),
    ev_to_ebitda DECIMAL(5,2),
    
    -- Quality Metrics
    profile_completeness_score DECIMAL(3,2) DEFAULT 0.0,
    data_quality_score DECIMAL(3,2) DEFAULT 0.0,
    
    -- Metadata
    extraction_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document Processing Log Table
-- Tracks document processing status and history
CREATE TABLE document_processing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size BIGINT,
    processing_status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    processing_method TEXT, -- llmwhisperer, pdf_js, manual
    
    -- Processing Results
    total_chunks_created INTEGER DEFAULT 0,
    total_characters_extracted BIGINT DEFAULT 0,
    processing_time_ms INTEGER,
    
    -- Error Information
    error_message TEXT,
    error_details JSONB,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search Analytics Table
-- Tracks search queries and performance for optimization
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    query_embedding VECTOR(1536),
    
    -- Search Parameters
    similarity_threshold DECIMAL(3,2),
    max_results INTEGER,
    filters JSONB DEFAULT '{}',
    
    -- Results
    results_count INTEGER DEFAULT 0,
    top_similarity_score DECIMAL(5,4),
    processing_time_ms INTEGER,
    
    -- User Context
    user_id TEXT,
    session_id TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance Optimization

-- Primary search indexes
CREATE INDEX idx_chunks_document_id ON financial_document_chunks(document_id);
CREATE INDEX idx_chunks_company_name ON financial_document_chunks(company_name);
CREATE INDEX idx_chunks_report_type ON financial_document_chunks(report_type);
CREATE INDEX idx_chunks_fiscal_year ON financial_document_chunks(fiscal_year);
CREATE INDEX idx_chunks_chunk_type ON financial_document_chunks(chunk_type);
CREATE INDEX idx_chunks_created_at ON financial_document_chunks(created_at);

-- Vector similarity search index (HNSW for fast approximate search)
CREATE INDEX idx_chunks_embedding ON financial_document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Financial profiles indexes
CREATE INDEX idx_profiles_company_name ON financial_profiles(company_name);
CREATE INDEX idx_profiles_ticker ON financial_profiles(ticker);
CREATE INDEX idx_profiles_fiscal_year ON financial_profiles(fiscal_year);
CREATE INDEX idx_profiles_report_type ON financial_profiles(report_type);
CREATE INDEX idx_profiles_created_at ON financial_profiles(created_at);

-- Processing log indexes
CREATE INDEX idx_processing_log_document_id ON document_processing_log(document_id);
CREATE INDEX idx_processing_log_status ON document_processing_log(processing_status);
CREATE INDEX idx_processing_log_created_at ON document_processing_log(created_at);

-- Search analytics indexes
CREATE INDEX idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX idx_search_analytics_query_embedding ON search_analytics 
USING hnsw (query_embedding vector_cosine_ops);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE financial_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust based on your authentication needs)
-- For now, allow all operations for authenticated users

CREATE POLICY "Allow all operations for authenticated users" ON financial_document_chunks
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON financial_profiles
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON document_processing_log
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON search_analytics
    FOR ALL USING (auth.role() = 'authenticated');

-- Functions for common operations

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_chunks_updated_at 
    BEFORE UPDATE ON financial_document_chunks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON financial_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for semantic search with filters
CREATE OR REPLACE FUNCTION search_financial_chunks(
    query_embedding VECTOR(1536),
    similarity_threshold DECIMAL DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    company_filter TEXT DEFAULT NULL,
    report_type_filter TEXT DEFAULT NULL,
    fiscal_year_filter INTEGER DEFAULT NULL
)
RETURNS TABLE (
    chunk_id UUID,
    document_id TEXT,
    similarity DECIMAL,
    chunk_type TEXT,
    title TEXT,
    content TEXT,
    company_name TEXT,
    report_type TEXT,
    fiscal_period TEXT,
    metrics TEXT[],
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fdc.id as chunk_id,
        fdc.document_id,
        (1 - (fdc.embedding <=> query_embedding))::DECIMAL as similarity,
        fdc.chunk_type,
        fdc.title,
        fdc.content,
        fdc.company_name,
        fdc.report_type,
        fdc.fiscal_period,
        fdc.metrics,
        fdc.metadata
    FROM financial_document_chunks fdc
    WHERE 
        (1 - (fdc.embedding <=> query_embedding)) >= similarity_threshold
        AND (company_filter IS NULL OR fdc.company_name ILIKE '%' || company_filter || '%')
        AND (report_type_filter IS NULL OR fdc.report_type = report_type_filter)
        AND (fiscal_year_filter IS NULL OR fdc.fiscal_year = fiscal_year_filter)
    ORDER BY fdc.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to get financial profile summary
CREATE OR REPLACE FUNCTION get_financial_summary(
    company_filter TEXT DEFAULT NULL,
    fiscal_year_filter INTEGER DEFAULT NULL
)
RETURNS TABLE (
    company_name TEXT,
    ticker TEXT,
    fiscal_period TEXT,
    revenue BIGINT,
    net_income BIGINT,
    eps DECIMAL,
    revenue_growth DECIMAL,
    net_margin DECIMAL,
    roe DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fp.company_name,
        fp.ticker,
        fp.fiscal_period,
        fp.revenue,
        fp.net_income,
        fp.eps,
        fp.revenue_growth,
        fp.net_margin,
        fp.roe
    FROM financial_profiles fp
    WHERE 
        (company_filter IS NULL OR fp.company_name ILIKE '%' || company_filter || '%')
        AND (fiscal_year_filter IS NULL OR fp.fiscal_year = fiscal_year_filter)
    ORDER BY fp.fiscal_year DESC, fp.quarter DESC;
END;
$$ LANGUAGE plpgsql;

-- Sample queries for testing (commented out)
/*
-- Test semantic search
SELECT * FROM search_financial_chunks(
    '[0.1, 0.2, ...]'::vector, -- your query embedding
    0.7, -- similarity threshold
    5,   -- max results
    'Snowflake', -- company filter
    'earnings',  -- report type filter
    2024 -- fiscal year filter
);

-- Test financial summary
SELECT * FROM get_financial_summary('Snowflake', 2024);

-- View all chunks for a company
SELECT 
    chunk_type,
    title,
    LEFT(content, 100) || '...' as preview,
    fiscal_period,
    created_at
FROM financial_document_chunks 
WHERE company_name ILIKE '%snowflake%'
ORDER BY chunk_order;

-- Performance analytics
SELECT 
    chunk_type,
    COUNT(*) as count,
    AVG(token_count) as avg_tokens,
    AVG(ARRAY_LENGTH(metrics, 1)) as avg_metrics
FROM financial_document_chunks
GROUP BY chunk_type
ORDER BY count DESC;
*/ 