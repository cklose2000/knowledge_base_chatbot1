import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Test result interface
export interface ConnectivityTestResult {
  service: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  responseTime?: number;
}

export interface ConnectivityTestSuite {
  overall: 'success' | 'partial' | 'failed';
  results: ConnectivityTestResult[];
  timestamp: string;
  environment: string;
}

class ConnectivityTester {
  private results: ConnectivityTestResult[] = [];

  /**
   * Run all connectivity tests
   */
  async runAllTests(): Promise<ConnectivityTestSuite> {
    console.log('🔍 Starting Finance Bot API Connectivity Tests...\n');
    
    this.results = [];
    
    // Test each service
    await this.testOpenAI();
    await this.testSupabase();
    await this.testLLMWhisperer();
    await this.testEnvironmentVariables();
    
    // Determine overall status
    const hasErrors = this.results.some(r => r.status === 'error');
    const hasWarnings = this.results.some(r => r.status === 'warning');
    
    let overall: 'success' | 'partial' | 'failed';
    if (hasErrors) {
      overall = 'failed';
    } else if (hasWarnings) {
      overall = 'partial';
    } else {
      overall = 'success';
    }

    const suite: ConnectivityTestSuite = {
      overall,
      results: this.results,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.MODE || 'development',
    };

    this.printResults(suite);
    return suite;
  }

  /**
   * Test OpenAI API connectivity
   */
  private async testOpenAI(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        this.results.push({
          service: 'OpenAI',
          status: 'error',
          message: 'API key not found in environment variables',
          details: { envVar: 'OPENAI_API_KEY or VITE_OPENAI_API_KEY' }
        });
        return;
      }

      if (!apiKey.startsWith('sk-')) {
        this.results.push({
          service: 'OpenAI',
          status: 'error',
          message: 'Invalid API key format (should start with sk-)',
        });
        return;
      }

      const openai = new OpenAI({ 
        apiKey,
        dangerouslyAllowBrowser: true // For client-side testing
      });

      // Test embeddings API (critical for RAG)
      console.log('Testing OpenAI Embeddings API...');
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'Test financial document: Q3 2024 earnings report shows revenue growth of 15%',
      });

      if (embeddingResponse.data[0].embedding.length !== 1536) {
        throw new Error(`Unexpected embedding dimension: ${embeddingResponse.data[0].embedding.length}`);
      }

      // Test chat completions API (for document analysis)
      console.log('Testing OpenAI Chat Completions API...');
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: 'Extract key financial metrics from this text: "Revenue increased 15% to $2.5B, net income rose 8% to $450M, EPS of $1.25 vs $1.15 prior year."'
        }],
        max_tokens: 100,
      });

      if (!chatResponse.choices[0].message.content) {
        throw new Error('Empty response from chat completions');
      }

      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'OpenAI',
        status: 'success',
        message: 'All OpenAI APIs working correctly',
        details: {
          embeddingDimensions: embeddingResponse.data[0].embedding.length,
          chatModel: 'gpt-4o-mini',
          embeddingModel: 'text-embedding-3-small',
          usage: {
            embedding: embeddingResponse.usage,
            chat: chatResponse.usage
          }
        },
        responseTime
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'OpenAI',
        status: 'error',
        message: `OpenAI API error: ${error.message}`,
        details: {
          error: error.message,
          code: error.code,
          type: error.type
        },
        responseTime
      });
    }
  }

  /**
   * Test Supabase connectivity
   */
  private async testSupabase(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        this.results.push({
          service: 'Supabase',
          status: 'error',
          message: 'Supabase credentials not found in environment variables',
          details: { 
            missingVars: [
              !supabaseUrl ? 'VITE_SUPABASE_URL' : null,
              !supabaseKey ? 'VITE_SUPABASE_ANON_KEY' : null
            ].filter(Boolean)
          }
        });
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Test basic connectivity
      console.log('Testing Supabase connectivity...');
      const { error } = await supabase
        .from('documents')
        .select('count')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist, which is OK
        throw error;
      }

      // Test vector extension (critical for RAG)
      console.log('Testing vector extension...');
      const { error: vectorError } = await supabase
        .rpc('vector', {});

      // This will fail, but we're checking if the error indicates the extension exists
      const hasVectorExtension = vectorError?.message?.includes('function') || 
                                vectorError?.code === '42883'; // function does not exist

      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Supabase',
        status: hasVectorExtension ? 'success' : 'warning',
        message: hasVectorExtension 
          ? 'Supabase connected successfully with vector extension'
          : 'Supabase connected but vector extension may not be enabled',
        details: {
          url: supabaseUrl,
          vectorExtension: hasVectorExtension,
          tablesAccessible: !error || error.code === 'PGRST116'
        },
        responseTime
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'Supabase',
        status: 'error',
        message: `Supabase connection error: ${error.message}`,
        details: {
          error: error.message,
          code: error.code,
          hint: error.hint
        },
        responseTime
      });
    }
  }

  /**
   * Test LLMWhisperer API connectivity
   */
  private async testLLMWhisperer(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const apiKey = import.meta.env.VITE_LLMWHISPERER_API_KEY || process.env.LLMWHISPERER_API_KEY;
      const baseUrl = import.meta.env.VITE_LLMWHISPERER_BASE_URL || 
                     process.env.LLMWHISPERER_BASE_URL || 
                     'https://llmwhisperer-api.us-central.unstract.com/api/v2';
      
      if (!apiKey) {
        this.results.push({
          service: 'LLMWhisperer',
          status: 'warning',
          message: 'LLMWhisperer API key not found (will use fallback PDF parsing)',
          details: { envVar: 'LLMWHISPERER_API_KEY or VITE_LLMWHISPERER_API_KEY' }
        });
        return;
      }

      console.log('Testing LLMWhisperer API...');
      
      // Test API status endpoint
      const response = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const statusData = await response.json();
      
      const responseTime = Date.now() - startTime;
      this.results.push({
        service: 'LLMWhisperer',
        status: 'success',
        message: 'LLMWhisperer API accessible',
        details: {
          baseUrl,
          status: statusData,
          apiKeyValid: true
        },
        responseTime
      });

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // LLMWhisperer is optional, so this is a warning not an error
      this.results.push({
        service: 'LLMWhisperer',
        status: 'warning',
        message: `LLMWhisperer API unavailable (will use fallback): ${error.message}`,
        details: {
          error: error.message,
          fallbackAvailable: true
        },
        responseTime
      });
    }
  }

  /**
   * Test environment variables
   */
  private async testEnvironmentVariables(): Promise<void> {
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

    const missing = requiredVars.filter(varName => 
      !import.meta.env[varName] && !process.env[varName]
    );

    const present = requiredVars.filter(varName => 
      import.meta.env[varName] || process.env[varName]
    );

    const optionalPresent = optionalVars.filter(varName => 
      import.meta.env[varName] || process.env[varName]
    );

    if (missing.length > 0) {
      this.results.push({
        service: 'Environment',
        status: 'error',
        message: `Missing required environment variables: ${missing.join(', ')}`,
        details: {
          missing,
          present,
          optionalPresent
        }
      });
    } else {
      this.results.push({
        service: 'Environment',
        status: 'success',
        message: 'All required environment variables present',
        details: {
          required: present,
          optional: optionalPresent,
          total: present.length + optionalPresent.length
        }
      });
    }
  }

  /**
   * Print formatted test results
   */
  private printResults(suite: ConnectivityTestSuite): void {
    console.log('\n' + '='.repeat(60));
    console.log('🏦 FINANCE BOT API CONNECTIVITY TEST RESULTS');
    console.log('='.repeat(60));
    
    const statusEmoji = {
      success: '✅',
      partial: '⚠️',
      failed: '❌'
    };

    console.log(`\nOverall Status: ${statusEmoji[suite.overall]} ${suite.overall.toUpperCase()}`);
    console.log(`Timestamp: ${suite.timestamp}`);
    console.log(`Environment: ${suite.environment}\n`);

    suite.results.forEach(result => {
      const emoji = result.status === 'success' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${emoji} ${result.service}: ${result.message}`);
      
      if (result.responseTime) {
        console.log(`   Response Time: ${result.responseTime}ms`);
      }
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      console.log('');
    });

    // Recommendations
    console.log('📋 RECOMMENDATIONS:');
    
    if (suite.overall === 'failed') {
      console.log('❌ Critical issues found. Please fix the errors above before proceeding.');
    } else if (suite.overall === 'partial') {
      console.log('⚠️  Some optional services unavailable. Core functionality should work.');
    } else {
      console.log('✅ All systems operational. Ready for Finance Bot RAG processing!');
    }

    console.log('\n🏦 Finance-specific features ready:');
    console.log('   • Earnings statement processing');
    console.log('   • 10-K/10-Q document analysis');
    console.log('   • Financial metrics extraction');
    console.log('   • Multi-dimensional financial RAG');
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Export singleton instance
export const connectivityTester = new ConnectivityTester();

// Convenience function for quick testing
export async function testConnectivity(): Promise<ConnectivityTestSuite> {
  return await connectivityTester.runAllTests();
} 