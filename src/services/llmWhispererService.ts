export interface LLMWhispererResponse {
  status: string;
  status_code?: number;
  whisper_hash?: string;
  message?: string;
  extracted_text?: string;
  result_text?: string;
  error?: string;
}

export interface ProcessingOptions {
  mode?: 'form' | 'native_text' | 'low_cost' | 'high_quality';
  output_mode?: 'layout_preserving' | 'text';
  pages_to_extract?: string;
  timeout?: number;
}

class LLMWhispererService {
  private apiKey: string;
  private baseUrl: string;
  private proxyUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_LLMWHISPERER_API_KEY || '';
    this.baseUrl = import.meta.env.VITE_LLMWHISPERER_BASE_URL || 'https://llmwhisperer-api.us-central.unstract.com/api/v2';
    this.proxyUrl = 'http://localhost:3001/api/llmwhisperer';
  }

  /**
   * Extract text from PDF using LLMWhisperer API v2 (async workflow)
   */
  async extractTextFromPDF(
    pdfBuffer: ArrayBuffer, 
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    console.log(`🔍 [LLMWhisperer] Starting PDF extraction for: ${filename} (${pdfBuffer.byteLength} bytes)`);
    
    try {
      // Step 1: Submit the document for processing
      console.log(`🔄 [LLMWhisperer] Submitting document via proxy server at ${this.proxyUrl}`);
      
      const formData = new FormData();
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      formData.append('file', blob, filename);

      const submitResponse = await fetch(`${this.proxyUrl}/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json().catch(() => ({}));
        throw new Error(`Proxy error: ${submitResponse.status} ${submitResponse.statusText} - ${errorData.error || errorData.details || 'Unknown error'}`);
      }

      const submitResult = await submitResponse.json();

      if (!submitResult.whisper_hash) {
        throw new Error(submitResult.error || submitResult.message || 'No whisper hash received');
      }

      console.log(`✅ [LLMWhisperer] Document submitted successfully. Whisper hash: ${submitResult.whisper_hash}`);
      console.log(`📊 [LLMWhisperer] Status: ${submitResult.status}`);

      // Step 2: Poll for completion
      const extractedText = await this.pollForCompletion(submitResult.whisper_hash, options.timeout || 60000);
      
      console.log(`✅ [LLMWhisperer] Successfully extracted ${extractedText.length} characters`);
      return extractedText;
      
    } catch (error) {
      console.warn('🚨 [LLMWhisperer] Proxy extraction failed:', error);
      console.log('🔄 [LLMWhisperer] Falling back to direct API call...');
      
      // Fallback to direct API call (will likely fail due to CORS, but worth trying)
      try {
        return await this.directAPICall(pdfBuffer, filename, options);
      } catch (directError) {
        console.warn('🚨 [LLMWhisperer] Direct API call also failed:', directError);
        console.log('🔄 [LLMWhisperer] Using basic fallback extraction...');
        return this.fallbackPDFExtraction(pdfBuffer);
      }
    }
  }

  /**
   * Poll for completion of LLMWhisperer processing
   */
  private async pollForCompletion(whisperHash: string, timeout: number = 60000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    
    console.log(`🔄 [LLMWhisperer] Starting to poll for completion. Hash: ${whisperHash}`);
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check status
        const statusResponse = await fetch(`${this.proxyUrl}/status/${whisperHash}`);
        
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
        }
        
        const statusResult = await statusResponse.json();
        console.log(`📊 [LLMWhisperer] Status check: ${statusResult.status}`);
        
        if (statusResult.status === 'processed') {
          // Document is ready, retrieve the results
          console.log(`✅ [LLMWhisperer] Processing complete, retrieving results...`);
          return await this.retrieveResults(whisperHash);
        } else if (statusResult.status === 'failed') {
          throw new Error(`Processing failed: ${statusResult.message || 'Unknown error'}`);
        }
        
        // Still processing, wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
      } catch (error) {
        console.error(`❌ [LLMWhisperer] Polling error:`, error);
        throw error;
      }
    }
    
    throw new Error(`Processing timeout after ${timeout}ms`);
  }

  /**
   * Retrieve the processed results
   */
  private async retrieveResults(whisperHash: string): Promise<string> {
    const retrieveResponse = await fetch(`${this.proxyUrl}/retrieve/${whisperHash}`);
    
    if (!retrieveResponse.ok) {
      throw new Error(`Retrieve failed: ${retrieveResponse.status} ${retrieveResponse.statusText}`);
    }
    
    const retrieveResult = await retrieveResponse.json();
    
    if (!retrieveResult.result_text) {
      throw new Error(retrieveResult.error || retrieveResult.message || 'No text extracted');
    }
    
    return retrieveResult.result_text;
  }

  /**
   * Direct API call (for fallback) - updated for v2 API
   */
  private async directAPICall(
    pdfBuffer: ArrayBuffer, 
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('API key not found');
    }

    // Build query parameters for v2 API
    const queryParams = new URLSearchParams({
      mode: options.mode || 'form',
      output_mode: options.output_mode || 'layout_preserving',
      tag: 'financial-analysis',
      file_name: filename
    });

    // Only add pages_to_extract if specified (empty means all pages)
    if (options.pages_to_extract) {
      queryParams.append('pages_to_extract', options.pages_to_extract);
    }

    const response = await fetch(`${this.baseUrl}/whisper?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'unstract-key': this.apiKey,
      },
      body: pdfBuffer,
    });

    if (!response.ok) {
      throw new Error(`LLMWhisperer API error: ${response.status} ${response.statusText}`);
    }

    const result: LLMWhispererResponse = await response.json();

    if (!result.whisper_hash) {
      throw new Error(result.error || result.message || 'No whisper hash received');
    }

    // For direct API calls, we'd need to implement polling here too
    // For now, just throw an error to fall back to basic extraction
    throw new Error('Direct API calls require async polling - not implemented in fallback');
  }

  /**
   * Fallback PDF text extraction using basic methods
   */
  private async fallbackPDFExtraction(pdfBuffer: ArrayBuffer): Promise<string> {
    try {
      // Try to extract text using a simple approach
      // This is a basic fallback - in a real implementation you might use pdf-parse or similar
      const uint8Array = new Uint8Array(pdfBuffer);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
      
      // Extract readable text from PDF content (very basic approach)
      const textMatches = text.match(/\(([^)]+)\)/g);
      if (textMatches) {
        return textMatches
          .map(match => match.slice(1, -1))
          .filter(text => text.length > 2 && /[a-zA-Z]/.test(text))
          .join(' ');
      }
      
      // If no text found, return a message
      return 'PDF content detected but text extraction failed. Please try converting the PDF to text format or use a different file.';
    } catch (error) {
      console.error('Fallback PDF extraction failed:', error);
      return 'Unable to extract text from PDF. Please try converting the PDF to text format.';
    }
  }

  /**
   * Check if LLMWhisperer service is available (via proxy)
   */
  async checkServiceHealth(): Promise<boolean> {
    try {
      // First check if our proxy is running
      const proxyResponse = await fetch(`http://localhost:3001/health`);
      if (!proxyResponse.ok) {
        console.warn('🚨 [LLMWhisperer] Proxy server not running');
        return false;
      }

      // Then check LLMWhisperer status via proxy
      const statusResponse = await fetch(`${this.proxyUrl}/status`);
      return statusResponse.ok;
    } catch (error) {
      console.warn('🚨 [LLMWhisperer] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get supported file types
   */
  getSupportedTypes(): string[] {
    return ['application/pdf'];
  }
}

export const llmWhispererService = new LLMWhispererService(); 