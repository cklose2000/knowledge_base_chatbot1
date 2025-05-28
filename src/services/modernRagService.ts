import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { supabaseService } from './supabaseService';
import { v4 as uuidv4 } from 'uuid';

// Updated query rewriting function
function rewriteQueryForEmbedding(query: string, docMeta?: { company?: string; period?: string; documentId?: string }) {
  const base = docMeta?.company && docMeta?.period
    ? `About ${docMeta.company} ${docMeta.period} filing (doc id: ${docMeta.documentId || 'unknown'}), `
    : (docMeta?.company
      ? `About ${docMeta.company} (doc id: ${docMeta.documentId || 'unknown'}), `
      : 'Regarding the uploaded financial documents, ');

  if (query.length < 20 && query.length > 0) { // Keep length check, adjust if needed
    return `${base}answer this: ${query}`;
  }
  // For longer queries, still prepend the context for consistency
  return `${base}${query}`;
}

export interface ModernFinancialChunk {
  id: string;
  parentId?: string;
  level: 'parent' | 'child';
  content: string;
  embedding?: number[];
  metadata: {
    chunkType: 'transcript' | 'financial_metrics' | 'narrative' | 'table';
    speaker?: string;
    section?: string;
    confidence: number;
    position: number;
    documentId: string;
    companyName?: string;
    reportType?: string;
  };
}

export interface ModernSearchResult {
  chunk: ModernFinancialChunk;
  similarity: number;
  context?: ModernFinancialChunk; // Parent chunk for context
}

export class ModernRagService {
  private embeddings: OpenAIEmbeddings;
  private parentSplitter: RecursiveCharacterTextSplitter;
  private childSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
      modelName: 'text-embedding-3-large', // Better for financial domain
      dimensions: 1536
    });

    // Parent chunks for context (larger)
    this.parentSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
      separators: [
        '\n\n## ', // Major sections
        '\n\n### ', // Subsections  
        '\n\nOperator:', // Earnings call operator
        '\n\nQ&A Session', // Q&A sections
        '\n\nQuestion:', // Individual questions
        '\n\nAnswer:', // Individual answers
        '\n\n', // Paragraph breaks
        '\n', // Line breaks
        '. ', // Sentence breaks
        ' ', // Word breaks
        '' // Character breaks
      ]
    });

    // Child chunks for precise retrieval (smaller)
    this.childSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 400,
      chunkOverlap: 50,
      separators: [
        '\n\n', // Paragraph breaks
        '\n', // Line breaks
        '. ', // Sentence breaks
        ' ', // Word breaks
        '' // Character breaks
      ]
    });
  }

  /**
   * Process document with modern hierarchical chunking
   */
  async processDocument(
    content: string, 
    documentId: string,
    metadata: {
      companyName?: string;
      reportType?: string;
      filename?: string;
    }
  ): Promise<ModernFinancialChunk[]> {
    console.log('🔄 [ModernRAG] Processing document with hierarchical chunking...');
    
    // Step 1: Detect document structure and content types
    const sections = this.detectDocumentStructure(content);
    console.log(`📋 [ModernRAG] Detected ${sections.length} sections`);

    // Step 2: Create hierarchical chunks
    const allChunks: ModernFinancialChunk[] = [];
    
    for (const section of sections) {
      const sectionChunks = await this.createHierarchicalChunks(
        section, 
        documentId, 
        metadata
      );
      allChunks.push(...sectionChunks);
    }

    // Step 3: Generate embeddings for all chunks
    await this.generateEmbeddings(allChunks);

    console.log(`✅ [ModernRAG] Created ${allChunks.length} hierarchical chunks`);
    return allChunks;
  }

  /**
   * Detect document structure and classify content types
   */
  private detectDocumentStructure(content: string) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection: {
      type: 'transcript' | 'financial_metrics' | 'narrative' | 'table';
      content: string;
      speaker?: string;
      startLine: number;
    } = {
      type: 'narrative',
      content: '',
      startLine: 0
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Detect earnings call speakers (high priority)
      const speakerMatch = line.match(/^([A-Z][a-z]+ [A-Z][a-z]+|Operator|Analyst):\s*/);
      if (speakerMatch) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          type: 'transcript',
          content: line,
          speaker: speakerMatch[1],
          startLine: i
        };
        continue;
      }

      // Detect financial metrics (numbers with $ or %)
      if (this.isFinancialMetricsLine(line)) {
        if (currentSection.type !== 'financial_metrics') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = {
            type: 'financial_metrics',
            content: line,
            startLine: i
          };
        } else {
          currentSection.content += '\n' + line;
        }
        continue;
      }

      // Detect tables (markdown or pipe-separated)
      if (this.isTableLine(line)) {
        if (currentSection.type !== 'table') {
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = {
            type: 'table',
            content: line,
            startLine: i
          };
        } else {
          currentSection.content += '\n' + line;
        }
        continue;
      }

      // Add to current section
      currentSection.content += '\n' + line;
    }

    // Add final section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if line contains financial metrics
   */
  private isFinancialMetricsLine(line: string): boolean {
    const hasFinancialTerms = /revenue|earnings|profit|loss|margin|ratio|eps|ebitda|cash flow/i.test(line);
    const hasNumbers = /\$[\d,]+|\d+\.\d+%|\d+\s*(million|billion|thousand)/i.test(line);
    return hasFinancialTerms && hasNumbers;
  }

  /**
   * Check if line is part of a table
   */
  private isTableLine(line: string): boolean {
    return line.includes('|') && line.split('|').length > 2;
  }

  /**
   * Create hierarchical chunks (parent + children)
   */
  private async createHierarchicalChunks(
    section: any,
    documentId: string,
    metadata: any
  ): Promise<ModernFinancialChunk[]> {
    const chunks: ModernFinancialChunk[] = [];
    
    // Create parent chunks first
    const parentDocs = await this.parentSplitter.createDocuments([section.content]);
    
    for (let i = 0; i < parentDocs.length; i++) {
      const parentDoc = parentDocs[i];
      const parentId = uuidv4();
      
      // Create parent chunk
      const parentChunk: ModernFinancialChunk = {
        id: parentId,
        level: 'parent',
        content: parentDoc.pageContent,
        metadata: {
          chunkType: section.type,
          speaker: section.speaker,
          section: this.extractSectionTitle(parentDoc.pageContent),
          confidence: this.calculateContentConfidence(parentDoc.pageContent, section.type),
          position: i,
          documentId,
          companyName: metadata.companyName,
          reportType: metadata.reportType
        }
      };
      chunks.push(parentChunk);

      // Create child chunks from parent content
      const childDocs = await this.childSplitter.createDocuments([parentDoc.pageContent]);
      
      for (let j = 0; j < childDocs.length; j++) {
        const childDoc = childDocs[j];
        const childChunk: ModernFinancialChunk = {
          id: uuidv4(),
          parentId: parentId,
          level: 'child',
          content: childDoc.pageContent,
          metadata: {
            chunkType: section.type,
            speaker: section.speaker,
            section: this.extractSectionTitle(childDoc.pageContent),
            confidence: this.calculateContentConfidence(childDoc.pageContent, section.type),
            position: j,
            documentId,
            companyName: metadata.companyName,
            reportType: metadata.reportType
          }
        };
        chunks.push(childChunk);
      }
    }

    return chunks;
  }

  /**
   * Extract meaningful section titles
   */
  private extractSectionTitle(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return 'Unknown Section';
    
    // Look for markdown headers
    const headerMatch = lines[0].match(/^#{1,6}\s+(.+)$/);
    if (headerMatch) return headerMatch[1];
    
    // Look for speaker names in earnings calls
    const speakerMatch = lines[0].match(/^([A-Z][a-z]+ [A-Z][a-z]+|Operator):/);
    if (speakerMatch) return `${speakerMatch[1]} Statement`;
    
    // Use first meaningful sentence
    const firstSentence = lines[0].split('.')[0];
    return firstSentence.length > 50 ? firstSentence.substring(0, 50) + '...' : firstSentence;
  }

  /**
   * Calculate content confidence based on type and quality indicators
   */
  private calculateContentConfidence(content: string, type: string): number {
    let confidence = 0.5; // Base confidence
    
    switch (type) {
      case 'transcript':
        if (content.includes(':') && content.match(/[A-Z][a-z]+ [A-Z][a-z]+:/)) {
          confidence += 0.3; // Has speaker
        }
        if (content.match(/question|answer|thank you|next question/i)) {
          confidence += 0.1; // Q&A indicators
        }
        break;
        
      case 'financial_metrics':
        if (content.match(/\$[\d,]+|\d+\.\d+%/)) {
          confidence += 0.3; // Has financial numbers
        }
        if (content.match(/revenue|earnings|profit|margin/i)) {
          confidence += 0.1; // Has financial terms
        }
        break;
        
      case 'table':
        if (content.includes('|') && content.split('|').length > 3) {
          confidence += 0.3; // Well-formed table
        }
        break;
    }
    
    // Boost for longer, more complete content
    if (content.length > 200) confidence += 0.1;
    if (content.length > 500) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunks: ModernFinancialChunk[]): Promise<void> {
    console.log(`🔄 [ModernRAG] Generating embeddings for ${chunks.length} chunks...`);
    
    const contents = chunks.map(chunk => chunk.content);
    const embeddings = await this.embeddings.embedDocuments(contents);
    
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }
    
    console.log(`✅ [ModernRAG] Generated embeddings for all chunks`);
  }

  /**
   * Modern semantic search with hierarchical retrieval
   */
  async search(
    query: string,
    options: {
      maxResults?: number;
      similarityThreshold?: number; // Final hard cut
      chunkTypes?: string[];
      includeContext?: boolean;
      documentId?: string; // Added to fetch specific document metadata for query rewriting
    } = {}
  ): Promise<ModernSearchResult[]> {
    const {
      maxResults: finalMaxResults = 5, 
      similarityThreshold: finalSimilarityThreshold, 
      chunkTypes,
      includeContext = true,
      documentId // Document ID for fetching metadata
    } = options;

    const originalQuery = query;
    let rewrittenQuery = originalQuery;
    let docProfileMeta: { company?: string; period?: string; documentId?: string } | undefined = undefined;

    if (documentId) {
      try {
        // TODO: Implement supabaseService.getMinimalProfileForDocument(documentId: string)
        // It should return Promise<{ companyName?: string; fiscalPeriod?: string; } | null>
        if (typeof (supabaseService as any).getMinimalProfileForDocument === 'function') {
          const profile = await (supabaseService as any).getMinimalProfileForDocument(documentId);
          if (profile) {
            docProfileMeta = { company: profile.companyName, period: profile.fiscalPeriod, documentId };
          }
        } else {
          console.warn(`[ModernRAG] supabaseService.getMinimalProfileForDocument not found. Query rewriting will be generic.`);
        }
      } catch (e) {
        console.warn(`[ModernRAG] Could not fetch profile for doc ${documentId} for query rewriting:`, e);
      }
    }
    
    rewrittenQuery = rewriteQueryForEmbedding(originalQuery, docProfileMeta);

    if (originalQuery !== rewrittenQuery) {
      console.log(`🔄 [ModernRAG] Query rewritten for embedding: \"${rewrittenQuery}\"`);
    }
    console.log(`🔍 [ModernRAG] Searching with effective query: \"${rewrittenQuery}\"`);
    
    try {
      const queryEmbedding = await this.embeddings.embedQuery(rewrittenQuery);
      
      const initialMaxResultsToFetch = finalMaxResults * 4; // Fetch even more initially, e.g., 4x
      const initialRpcThreshold = 0.01; 

      // TODO: Update FinancialSearchResult in financeRagService.ts to include optional parent_content and parent_id fields.
      // TODO: Update supabaseService.searchChunks to query the new SQL view and return these fields.
      // For now, casting to 'any' to access potentially available fields.
      let supabaseResults = await supabaseService.searchChunks(queryEmbedding, {
        similarityThreshold: initialRpcThreshold, 
        maxResults: initialMaxResultsToFetch,
      }) as any[]; // Cast to any[] to handle potential new fields for now

      supabaseResults.sort((a, b) => b.similarity - a.similarity);

      if (!supabaseResults || supabaseResults.length === 0) {
        console.log('✅ [ModernRAG] No initial results from Supabase.');
        return [];
      }

      // User's suggested "Quick patch" logic starts here
      const bestSimilarity = supabaseResults[0].similarity;
      // Initial adaptive cutoff (alpha = 0.5 from user suggestion)
      const relativeCutoff = bestSimilarity * 0.5; 
      console.log(`📊 [ModernRAG] Initial filtering: Best similarity=${bestSimilarity.toFixed(4)}, Relative cutoff (best * 0.5)=${relativeCutoff.toFixed(4)}`);
      
      let adaptivelyFilteredResults = supabaseResults.filter(r => r.similarity >= relativeCutoff);
      console.log(`🔎 [ModernRAG] Results after relative cutoff filter: ${adaptivelyFilteredResults.length}`);

      // Optional user strictness slider (0–1), finalSimilarityThreshold is beta
      // finalSimilarityThreshold currently comes from financeRagService, capped e.g. at 0.05
      if (finalSimilarityThreshold !== undefined && adaptivelyFilteredResults.length > 0) {
        const sims = adaptivelyFilteredResults.map(r => r.similarity);
        // Ensure sims is not empty to avoid division by zero or NaN results
        if (sims.length > 0) {
          const mean = sims.reduce((a, b) => a + b, 0) / sims.length;
          const stdev = sims.length > 1 ? Math.sqrt(sims.map(s => (s - mean) ** 2).reduce((a, b) => a + b, 0) / (sims.length -1) ) : 0; // Use (n-1) for sample stdev, or n for population; using n-1 to be safe. Or 0 if only one item.
          const beta = finalSimilarityThreshold; // User-provided strictness (0=lenient, 1=strict)
          
          // dyn is the dynamic threshold: higher beta means higher dyn, meaning stricter filter
          const dynamicThreshold = mean + beta * stdev; 
          
          console.log(`📈 [ModernRAG] Statistical filtering: Mean sim=${mean.toFixed(4)}, Stdev=${stdev.toFixed(4)}, Beta (user strictness)=${beta.toFixed(4)}, Dynamic Threshold=${dynamicThreshold.toFixed(4)}`);
          
          const preStatFilterCount = adaptivelyFilteredResults.length;
          adaptivelyFilteredResults = adaptivelyFilteredResults.filter(r => r.similarity >= dynamicThreshold);
          
          if (adaptivelyFilteredResults.length < preStatFilterCount) {
            console.log(`🔪 [ModernRAG] Applied statistical filter, reduced results from ${preStatFilterCount} to ${adaptivelyFilteredResults.length}`);
          }
        } else {
          console.log('[ModernRAG] No results to apply statistical filter to after relative cutoff.');
        }
      } else if (finalSimilarityThreshold !== undefined) {
        console.log('[ModernRAG] Statistical filter skipped: No results after relative cutoff or no finalSimilarityThreshold provided.');
      }
      // End of User's suggested "Quick patch" logic
      
      const finalResultsToProcess = adaptivelyFilteredResults.slice(0, finalMaxResults);

      const modernResults: ModernSearchResult[] = [];
      
      for (const result of finalResultsToProcess) { 
        let contextChunk: ModernFinancialChunk | undefined;
        // Accessing result.parent_content and result.metadata.parent_id assuming they will be provided by updated supabaseService
        const parentContent = (result as any).parent_content;
        const parentId = (result as any).metadata?.parent_id || (result as any).parent_id; // Check metadata first, then direct field

        if (includeContext && parentContent && parentId) {
          contextChunk = {
            id: parentId, 
            level: 'parent',
            content: parentContent,
            metadata: {
              chunkType: 'narrative', 
              section: 'Parent Context',
              confidence: 0.9, 
              position: 0, 
              documentId: result.documentId,
              companyName: result.companyName, 
              reportType: result.reportType,
            }
          };
        }
        
        modernResults.push({
          chunk: { 
            id: result.chunkId,
            level: parentId ? 'child' : 'parent', 
            content: result.content, 
            parentId: parentId, 
            metadata: {
              chunkType: result.chunkType as any, 
              section: result.title, 
              confidence: result.metadata?.confidence || 0.8,
              position: result.metadata?.position || 0, 
              documentId: result.documentId,
              companyName: result.companyName,
              reportType: result.reportType,
              speaker: result.metadata?.speaker
            }
          },
          similarity: result.similarity,
          context: contextChunk
        });
      }

      console.log(`✅ [ModernRAG] Found ${modernResults.length} relevant chunks after all filters.`);
      return modernResults;
    } catch (error) {
      console.error('🚨 [ModernRAG] Search failed:', error);
      
      // Return empty results instead of throwing to allow graceful fallback
      console.log('🔄 [ModernRAG] Returning empty results due to search failure');
      return [];
    }
  }

  /**
   * Enhanced query processing with financial domain awareness
   */
  async enhancedSearch(query: string): Promise<ModernSearchResult[]> {
    // Detect query intent
    const queryIntent = this.detectQueryIntent(query);
    
    // Adjust search parameters based on intent
    const searchOptions = this.getSearchOptionsForIntent(queryIntent);
    
    // Perform search
    return this.search(query, searchOptions);
  }

  /**
   * Detect the intent of the user's query
   */
  private detectQueryIntent(query: string): 'factual' | 'analytical' | 'speaker' | 'financial' {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('who said') || lowerQuery.includes('who spoke') || lowerQuery.includes('speaker')) {
      return 'speaker';
    }
    
    if (lowerQuery.match(/revenue|earnings|profit|margin|ratio|financial|numbers/)) {
      return 'financial';
    }
    
    if (lowerQuery.match(/why|how|analyze|compare|trend|impact/)) {
      return 'analytical';
    }
    
    return 'factual';
  }

  /**
   * Get optimized search options based on query intent
   */
  private getSearchOptionsForIntent(intent: string) {
    switch (intent) {
      case 'speaker':
        return {
          maxResults: 3,
          chunkTypes: ['transcript'],
          includeContext: true,
          similarityThreshold: 0.2
        };
        
      case 'financial':
        return {
          maxResults: 5,
          chunkTypes: ['financial_metrics', 'table'],
          includeContext: true,
          similarityThreshold: 0.15
        };
        
      case 'analytical':
        return {
          maxResults: 7,
          includeContext: true,
          similarityThreshold: 0.1
        };
        
      default:
        return {
          maxResults: 5,
          includeContext: true,
          similarityThreshold: 0.15
        };
    }
  }
}

export const modernRagService = new ModernRagService(); 