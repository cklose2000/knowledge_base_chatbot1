# Supabase Setup Guide

This guide will help you set up Supabase for persistent storage of financial document chunks and profiles.

## Prerequisites

- Supabase account (free tier available)
- Basic understanding of SQL and database concepts

## Step 1: Create Supabase Project

1. **Sign up/Login** to [Supabase](https://supabase.com/)
2. **Create a new project**:
   - Click "New Project"
   - Choose your organization
   - Enter project name: `ai-analyst-chat`
   - Enter database password (save this!)
   - Select region closest to your users
   - Click "Create new project"

3. **Wait for setup** (usually 2-3 minutes)

## Step 2: Set Up Database Schema

1. **Open SQL Editor**:
   - Go to your project dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Run the schema script**:
   - Copy the entire contents of `database/supabase-schema.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

3. **Verify tables created**:
   - Go to "Table Editor" in the left sidebar
   - You should see these tables:
     - `financial_document_chunks`
     - `financial_profiles`
     - `document_processing_log`
     - `search_analytics`

## Step 3: Enable Vector Extension

The schema should automatically enable the vector extension, but if you encounter issues:

1. **Check extensions**:
   - Go to "Database" → "Extensions"
   - Ensure `vector` extension is enabled
   - If not, click "Enable" next to it

2. **Verify vector support**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

## Step 4: Configure Environment Variables

1. **Get your project credentials**:
   - Go to "Settings" → "API"
   - Copy your project URL and anon public key

2. **Update your `.env` file**:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Test the connection**:
   - Start your application
   - Check the browser console for Supabase connection logs
   - You should see: "🗄️ [Supabase] Service initialized successfully"

## Step 5: Fix Row Level Security for Demo Use

The schema includes RLS policies that require authentication. For demo/development use, you need to update these policies:

1. **Run the RLS fix script**:
   - Go to "SQL Editor" in Supabase
   - Copy the contents of `database/fix-rls-policies.sql`
   - Paste and run the script
   - This will create permissive policies for demo use

2. **Verify policies are updated**:
   ```sql
   SELECT 
     tablename,
     policyname,
     cmd,
     qual
   FROM pg_policies 
   WHERE tablename IN (
     'financial_document_chunks',
     'financial_profiles',
     'document_processing_log',
     'search_analytics'
   );
   ```

3. **For production deployment**:
   - Set up proper Supabase authentication
   - Create user-specific or organization-based policies
   - Replace the permissive demo policies with secure ones

## Step 6: Test the Integration

1. **Upload a document** in your application
2. **Check the database**:
   ```sql
   -- View stored chunks
   SELECT 
     chunk_type,
     title,
     company_name,
     created_at
   FROM financial_document_chunks
   ORDER BY created_at DESC;
   
   -- View financial profiles
   SELECT 
     company_name,
     fiscal_period,
     revenue,
     net_income
   FROM financial_profiles
   ORDER BY created_at DESC;
   ```

3. **Test search functionality**:
   - Ask questions about your uploaded documents
   - Verify search results are coming from Supabase

## Useful SQL Queries

### View All Data
```sql
-- Count records in each table
SELECT 
  'chunks' as table_name, 
  COUNT(*) as count 
FROM financial_document_chunks
UNION ALL
SELECT 
  'profiles' as table_name, 
  COUNT(*) as count 
FROM financial_profiles;

-- View recent activity
SELECT 
  document_id,
  filename,
  processing_status,
  total_chunks_created,
  processing_time_ms,
  created_at
FROM document_processing_log
ORDER BY created_at DESC
LIMIT 10;
```

### Search Performance
```sql
-- Test vector similarity search
SELECT 
  title,
  company_name,
  1 - (embedding <=> '[0.1,0.2,...]'::vector) as similarity
FROM financial_document_chunks
WHERE 1 - (embedding <=> '[0.1,0.2,...]'::vector) > 0.7
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 5;
```

### Data Analysis
```sql
-- Chunk statistics by company
SELECT 
  company_name,
  COUNT(*) as total_chunks,
  COUNT(DISTINCT chunk_type) as unique_chunk_types,
  AVG(token_count) as avg_tokens
FROM financial_document_chunks
WHERE company_name IS NOT NULL
GROUP BY company_name
ORDER BY total_chunks DESC;

-- Financial metrics overview
SELECT 
  company_name,
  fiscal_period,
  revenue / 1000000 as revenue_millions,
  net_income / 1000000 as net_income_millions,
  eps,
  revenue_growth
FROM financial_profiles
ORDER BY revenue DESC;
```

## Troubleshooting

### Common Issues

1. **"new row violates row-level security policy"** (Most Common):
   - This happens when RLS policies require authentication but you're using demo mode
   - **Solution**: Run the `database/fix-rls-policies.sql` script in Supabase SQL Editor
   - **Verification**: Check that policies show `qual: true` instead of `auth.role() = 'authenticated'`
   - **Alternative**: Disable RLS temporarily with `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`

2. **"vector extension not found"**:
   - Ensure the vector extension is enabled in Supabase
   - Check that your Supabase project supports vector operations

3. **"401 Unauthorized" errors**:
   - Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
   - Check that the anon key has the right permissions
   - Ensure RLS policies allow the operations you're trying to perform

4. **"Function search_financial_chunks does not exist"**:
   - Re-run the schema script
   - Check that all functions were created successfully

5. **"violates foreign key constraint parent_chunk_id_fkey"**:
   - This happens when child chunks reference parent chunks that haven't been inserted yet
   - **Solution**: The application now handles this by inserting chunks level by level
   - **Verification**: Check that chunks are being stored in batches by level (Level 1, then Level 2, etc.)

6. **Slow search performance**:
   - Verify vector indexes are created
   - Check query execution plans
   - Consider adjusting HNSW index parameters

### Performance Optimization

1. **Index tuning**:
   ```sql
   -- Check index usage
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan,
     idx_tup_read,
     idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE tablename LIKE 'financial_%';
   ```

2. **Vector search optimization**:
   ```sql
   -- Adjust HNSW parameters for better performance
   DROP INDEX IF EXISTS idx_chunks_embedding;
   CREATE INDEX idx_chunks_embedding ON financial_document_chunks 
   USING hnsw (embedding vector_cosine_ops)
   WITH (m = 32, ef_construction = 128);
   ```

## Migration from In-Memory Storage

If you have existing data in in-memory storage and want to migrate:

1. **Export existing data** (if needed)
2. **Clear Supabase tables** (if testing):
   ```sql
   TRUNCATE financial_document_chunks, financial_profiles, document_processing_log CASCADE;
   ```
3. **Re-upload documents** to populate Supabase
4. **Verify data integrity** using the test queries above

## Production Considerations

1. **Backup Strategy**:
   - Enable automated backups in Supabase
   - Consider point-in-time recovery

2. **Monitoring**:
   - Set up alerts for database performance
   - Monitor vector search query times

3. **Scaling**:
   - Consider connection pooling for high traffic
   - Monitor database resource usage

4. **Security**:
   - Review and customize RLS policies
   - Use environment-specific API keys
   - Enable audit logging if needed

## Support

- **Supabase Documentation**: https://supabase.com/docs
- **Vector Extension**: https://github.com/pgvector/pgvector
- **Application Issues**: Check browser console and application logs 