-- Fix RLS Policies for Demo/Development Use
-- This script updates the Row Level Security policies to allow public access
-- for demo purposes when authentication is not set up

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON financial_document_chunks;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON financial_profiles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON document_processing_log;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON search_analytics;

-- Create permissive policies for demo/development
-- These allow all operations without authentication requirements

-- Financial Document Chunks - Allow all operations
CREATE POLICY "Allow public access to chunks" ON financial_document_chunks
    FOR ALL USING (true);

-- Financial Profiles - Allow all operations  
CREATE POLICY "Allow public access to profiles" ON financial_profiles
    FOR ALL USING (true);

-- Document Processing Log - Allow all operations
CREATE POLICY "Allow public access to processing log" ON document_processing_log
    FOR ALL USING (true);

-- Search Analytics - Allow all operations
CREATE POLICY "Allow public access to search analytics" ON search_analytics
    FOR ALL USING (true);

-- Verify policies are created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN (
    'financial_document_chunks',
    'financial_profiles', 
    'document_processing_log',
    'search_analytics'
)
ORDER BY tablename, policyname; 