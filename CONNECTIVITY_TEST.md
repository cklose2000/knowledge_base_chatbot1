# 🏦 Finance Bot API Connectivity Testing

This document provides instructions for testing API connectivity for the Finance Bot RAG system.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the project root with your API keys:

```bash
# Required - Supabase Database
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Required - OpenAI API
OPENAI_API_KEY=sk-your_openai_api_key_here_starts_with_sk
VITE_OPENAI_API_KEY=sk-your_openai_api_key_here_starts_with_sk

# Optional - LLMWhisperer (for advanced PDF processing)
LLMWHISPERER_API_KEY=your_llmwhisperer_api_key_here
VITE_LLMWHISPERER_API_KEY=your_llmwhisperer_api_key_here

# Optional - Model Configuration
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4o-mini
VITE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
VITE_OPENAI_CHAT_MODEL=gpt-4o-mini
```

### 2. Testing Options

#### Option A: Web Interface (Recommended)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the test page:
   ```
   http://localhost:5173/test
   ```

3. Click "Run Connectivity Tests" to test all APIs

#### Option B: Command Line

Run the connectivity test script:
```bash
node test-connectivity.js
```

## 🔧 API Configuration Guide

### OpenAI API Setup

1. Visit [platform.openai.com](https://platform.openai.com)
2. Create an account or sign in
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)
6. Add to your `.env` file

**Required for:**
- Document text analysis and extraction
- Embedding generation for semantic search
- Financial metrics extraction

### Supabase Setup

1. Visit [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Project Settings → API
4. Copy the Project URL and anon key
5. Copy the service role key (for server operations)
6. Add to your `.env` file

**Required for:**
- Vector database storage
- Document metadata storage
- Search query logging

### LLMWhisperer Setup (Optional)

1. Visit [unstract.com](https://unstract.com)
2. Sign up for an account
3. Get your API key from the dashboard
4. Add to your `.env` file

**Used for:**
- Advanced PDF text extraction with OCR
- Better handling of complex financial documents
- Falls back to basic PDF parsing if unavailable

## 🧪 Test Results Interpretation

### ✅ Success Status
- All APIs are accessible and working correctly
- Ready to process financial documents
- Full RAG pipeline functionality available

### ⚠️ Partial Status
- Core APIs working, some optional services unavailable
- Basic functionality available
- May have reduced capabilities (e.g., no advanced PDF processing)

### ❌ Failed Status
- Critical APIs not accessible
- Check API keys and network connectivity
- Review error messages for specific issues

## 🏦 Finance Bot Features

Once connectivity is confirmed, the system supports:

### Document Types
- Earnings statements
- 10-K and 10-Q filings
- Annual and quarterly reports
- Balance sheets
- Income statements
- Cash flow statements

### Financial Analysis
- Revenue and growth metrics extraction
- Profitability ratio calculations
- Cash flow analysis
- Debt and liquidity metrics
- Year-over-year comparisons

### RAG Capabilities
- Semantic search across financial documents
- Multi-dimensional filtering (company, period, metrics)
- Hierarchical document chunking
- Financial profile reconstruction
- Intelligent query suggestions

## 🔍 Troubleshooting

### Common Issues

**OpenAI API Errors:**
- Verify API key format (must start with `sk-`)
- Check account billing and usage limits
- Ensure API key has necessary permissions

**Supabase Connection Issues:**
- Verify project URL format
- Check API key permissions
- Ensure project is not paused

**Environment Variable Issues:**
- Check `.env` file location (project root)
- Verify variable names match exactly
- Restart development server after changes

### Getting Help

1. Check the browser console for detailed error messages
2. Review the test output for specific failure points
3. Verify all environment variables are set correctly
4. Ensure network connectivity to external APIs

## 🚀 Next Steps

After successful connectivity testing:

1. **Database Setup**: Run the SQL schema in your Supabase project
2. **Document Upload**: Test with sample financial documents
3. **RAG Pipeline**: Verify document processing and search functionality
4. **Integration**: Connect with your existing financial analysis workflows

## 📊 Performance Expectations

- **Document Processing**: 10-30 seconds per financial document
- **Search Queries**: < 500ms response time
- **Embedding Generation**: 1-3 seconds per document chunk
- **Concurrent Users**: Supports 10+ simultaneous users

---

**Ready to process financial documents with AI-powered analysis!** 🎯 