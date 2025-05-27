const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = 3001;

// Configure CORS to allow requests from our React app
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// LLMWhisperer configuration
const LLMWHISPERER_API_KEY = process.env.LLMWHISPERER_API_KEY || process.env.VITE_LLMWHISPERER_API_KEY;
const LLMWHISPERER_BASE_URL = process.env.LLMWHISPERER_BASE_URL || 'https://llmwhisperer-api.us-central.unstract.com/api/v2';

console.log('🚀 [LLMWhisperer Proxy] Starting server...');
console.log('🔑 [LLMWhisperer Proxy] API Key:', LLMWHISPERER_API_KEY ? 'Present' : 'Missing');
console.log('🌐 [LLMWhisperer Proxy] Base URL:', LLMWHISPERER_BASE_URL);
console.log('🧪 [LLMWhisperer Proxy] Testing fetch function...');
console.log('🧪 [LLMWhisperer Proxy] fetch type:', typeof fetch);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'LLMWhisperer Proxy',
    hasApiKey: !!LLMWHISPERER_API_KEY,
    baseUrl: LLMWHISPERER_BASE_URL
  });
});

// LLMWhisperer status check
app.get('/api/llmwhisperer/status', async (req, res) => {
  if (!LLMWHISPERER_API_KEY) {
    return res.status(400).json({ 
      error: 'LLMWhisperer API key not configured' 
    });
  }

  try {
    console.log('🔍 [LLMWhisperer Proxy] Checking LLMWhisperer status...');
    
    const response = await fetch(`${LLMWHISPERER_BASE_URL}/get-usage-info`, {
      method: 'GET',
      headers: {
        'unstract-key': LLMWHISPERER_API_KEY,
      },
    });

    const data = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ [LLMWhisperer Proxy] Status check successful');
    res.json({ 
      status: 'ok', 
      statusCode: response.status,
      data: data 
    });

  } catch (error) {
    console.error('❌ [LLMWhisperer Proxy] Status check failed:', error.message);
    res.status(500).json({ 
      error: 'LLMWhisperer service unavailable',
      details: error.message 
    });
  }
});

// LLMWhisperer status check endpoint
app.get('/api/llmwhisperer/status/:whisperHash', async (req, res) => {
  if (!LLMWHISPERER_API_KEY) {
    return res.status(400).json({ 
      error: 'LLMWhisperer API key not configured' 
    });
  }

  const { whisperHash } = req.params;

  try {
    console.log(`🔍 [LLMWhisperer Proxy] Checking status for whisper hash: ${whisperHash}`);
    
    const response = await fetch(`${LLMWHISPERER_BASE_URL}/whisper-status?whisper_hash=${whisperHash}`, {
      method: 'GET',
      headers: {
        'unstract-key': LLMWHISPERER_API_KEY,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`LLMWhisperer API error: ${response.status} ${response.statusText}`);
    }

    console.log(`📊 [LLMWhisperer Proxy] Status check result:`, result);
    res.json(result);

  } catch (error) {
    console.error('❌ [LLMWhisperer Proxy] Status check failed:', error.message);
    res.status(500).json({ 
      error: 'Status check failed',
      details: error.message 
    });
  }
});

// LLMWhisperer retrieve results endpoint
app.get('/api/llmwhisperer/retrieve/:whisperHash', async (req, res) => {
  if (!LLMWHISPERER_API_KEY) {
    return res.status(400).json({ 
      error: 'LLMWhisperer API key not configured' 
    });
  }

  const { whisperHash } = req.params;

  try {
    console.log(`📥 [LLMWhisperer Proxy] Retrieving results for whisper hash: ${whisperHash}`);
    
    const response = await fetch(`${LLMWHISPERER_BASE_URL}/whisper-retrieve?whisper_hash=${whisperHash}&text_only=false`, {
      method: 'GET',
      headers: {
        'unstract-key': LLMWHISPERER_API_KEY,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`LLMWhisperer API error: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ [LLMWhisperer Proxy] Successfully retrieved ${result.result_text?.length || 0} characters`);
    console.log(`📄 [LLMWhisperer Proxy] Preview: ${result.result_text?.substring(0, 200)}...`);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [LLMWhisperer Proxy] Retrieve failed:', error.message);
    res.status(500).json({ 
      error: 'Retrieve failed',
      details: error.message 
    });
  }
});

// PDF text extraction endpoint
app.post('/api/llmwhisperer/extract', upload.single('file'), async (req, res) => {
  if (!LLMWHISPERER_API_KEY) {
    return res.status(400).json({ 
      error: 'LLMWhisperer API key not configured' 
    });
  }

  if (!req.file) {
    return res.status(400).json({ 
      error: 'No file uploaded' 
    });
  }

  try {
    console.log(`📄 [LLMWhisperer Proxy] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // LLMWhisperer v2 API expects application/octet-stream with query parameters
    const queryParams = new URLSearchParams({
      mode: 'form', // Use form mode for financial documents
      output_mode: 'layout_preserving', // Preserve layout for better LLM consumption
      // pages_to_extract: leave empty to extract all pages (don't send 'all')
      tag: 'financial-analysis', // For auditing
      file_name: req.file.originalname // For auditing
    });

    console.log('🔄 [LLMWhisperer Proxy] Sending request to LLMWhisperer API...');
    console.log('📋 [LLMWhisperer Proxy] Query params:', queryParams.toString());
    
    const response = await fetch(`${LLMWHISPERER_BASE_URL}/whisper?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'unstract-key': LLMWHISPERER_API_KEY,
      },
      body: req.file.buffer,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [LLMWhisperer Proxy] API Error Response:', result);
      throw new Error(`LLMWhisperer API error: ${response.status} ${response.statusText} - ${result.message || 'Unknown error'}`);
    }

    console.log('✅ [LLMWhisperer Proxy] Extraction request accepted');
    console.log(`📊 [LLMWhisperer Proxy] Whisper hash: ${result.whisper_hash}`);
    console.log(`📊 [LLMWhisperer Proxy] Status: ${result.status}`);
    
    res.json(result);

  } catch (error) {
    console.error('❌ [LLMWhisperer Proxy] Extraction failed:', error.message);
    res.status(500).json({ 
      error: 'PDF extraction failed',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 [LLMWhisperer Proxy] Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// Start server
app.listen(port, () => {
  console.log(`🎉 [LLMWhisperer Proxy] Server running on http://localhost:${port}`);
  console.log(`🔗 [LLMWhisperer Proxy] Health check: http://localhost:${port}/health`);
  console.log(`📄 [LLMWhisperer Proxy] Extract endpoint: http://localhost:${port}/api/llmwhisperer/extract`);
});

module.exports = app; 