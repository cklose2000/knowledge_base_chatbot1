#!/usr/bin/env node

// Simple connectivity test script for Finance Bot APIs
// Run with: node test-connectivity.js

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testOpenAI() {
  log(colors.cyan, '\n🔍 Testing OpenAI API...');
  
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    log(colors.red, '❌ OpenAI API key not found');
    return false;
  }

  if (!apiKey.startsWith('sk-')) {
    log(colors.red, '❌ Invalid OpenAI API key format');
    return false;
  }

  try {
    // Test embeddings endpoint
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Test financial document: Q3 2024 earnings report shows revenue growth of 15%',
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`HTTP ${embeddingResponse.status}: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    
    if (!embeddingData.data || !embeddingData.data[0] || !embeddingData.data[0].embedding) {
      throw new Error('Invalid embedding response structure');
    }

    // Test chat completions endpoint
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: 'Extract key financial metrics from: "Revenue increased 15% to $2.5B, net income rose 8% to $450M"'
        }],
        max_tokens: 100,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`HTTP ${chatResponse.status}: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    
    if (!chatData.choices || !chatData.choices[0] || !chatData.choices[0].message) {
      throw new Error('Invalid chat response structure');
    }

    log(colors.green, '✅ OpenAI API working correctly');
    log(colors.blue, `   Embedding dimensions: ${embeddingData.data[0].embedding.length}`);
    log(colors.blue, `   Chat model: gpt-4o-mini`);
    return true;

  } catch (error) {
    log(colors.red, `❌ OpenAI API error: ${error.message}`);
    return false;
  }
}

async function testSupabase() {
  log(colors.cyan, '\n🔍 Testing Supabase API...');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    log(colors.red, '❌ Supabase credentials not found');
    return false;
  }

  try {
    // Test basic connectivity
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    log(colors.green, '✅ Supabase API accessible');
    log(colors.blue, `   URL: ${supabaseUrl}`);
    return true;

  } catch (error) {
    log(colors.red, `❌ Supabase API error: ${error.message}`);
    return false;
  }
}

async function testLLMWhisperer() {
  log(colors.cyan, '\n🔍 Testing LLMWhisperer API...');
  
  const apiKey = process.env.LLMWHISPERER_API_KEY || process.env.VITE_LLMWHISPERER_API_KEY;
  const baseUrl = process.env.LLMWHISPERER_BASE_URL || 'https://llmwhisperer-api.unstract.com/v1';
  
  if (!apiKey) {
    log(colors.yellow, '⚠️  LLMWhisperer API key not found (will use fallback PDF parsing)');
    return true; // Not critical
  }

  try {
    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    log(colors.green, '✅ LLMWhisperer API accessible');
    log(colors.blue, `   Base URL: ${baseUrl}`);
    return true;

  } catch (error) {
    log(colors.yellow, `⚠️  LLMWhisperer API unavailable (will use fallback): ${error.message}`);
    return true; // Not critical
  }
}

async function checkEnvironmentVariables() {
  log(colors.cyan, '\n🔍 Checking Environment Variables...');
  
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY'
  ];

  const optionalVars = [
    'LLMWHISPERER_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_EMBEDDING_MODEL',
    'OPENAI_CHAT_MODEL'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  const present = requiredVars.filter(varName => process.env[varName]);
  const optionalPresent = optionalVars.filter(varName => process.env[varName]);

  if (missing.length > 0) {
    log(colors.red, `❌ Missing required variables: ${missing.join(', ')}`);
    return false;
  }

  log(colors.green, '✅ All required environment variables present');
  log(colors.blue, `   Required: ${present.length}/${requiredVars.length}`);
  log(colors.blue, `   Optional: ${optionalPresent.length}/${optionalVars.length}`);
  return true;
}

async function main() {
  log(colors.bright + colors.magenta, '🏦 FINANCE BOT API CONNECTIVITY TEST');
  log(colors.bright + colors.magenta, '=====================================');
  
  const results = [];
  
  results.push(await checkEnvironmentVariables());
  results.push(await testOpenAI());
  results.push(await testSupabase());
  results.push(await testLLMWhisperer());
  
  const successCount = results.filter(Boolean).length;
  const totalTests = results.length;
  
  log(colors.bright + colors.cyan, '\n📋 SUMMARY');
  log(colors.bright + colors.cyan, '===========');
  
  if (successCount === totalTests) {
    log(colors.green, '✅ All systems operational!');
    log(colors.green, '🚀 Ready for Finance Bot RAG processing');
    log(colors.blue, '\n🏦 Finance-specific features ready:');
    log(colors.blue, '   • Earnings statement processing');
    log(colors.blue, '   • 10-K/10-Q document analysis');
    log(colors.blue, '   • Financial metrics extraction');
    log(colors.blue, '   • Multi-dimensional financial RAG');
  } else {
    log(colors.yellow, `⚠️  ${successCount}/${totalTests} tests passed`);
    log(colors.yellow, 'Some issues found - check the details above');
  }
  
  log(colors.cyan, '\n🌐 Access the web interface at: http://localhost:5173/test');
  log(colors.cyan, '💻 Or continue with command line testing\n');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log(colors.red, `Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

main().catch(error => {
  log(colors.red, `Fatal error: ${error.message}`);
  process.exit(1);
}); 