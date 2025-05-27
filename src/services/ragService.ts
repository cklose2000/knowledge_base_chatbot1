import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Types for our RAG system
export interface DocumentChunk {
  id: string;
  documentId: string;
  parentChunkId?: string;
  chunkLevel: number;
  chunkOrder: number;
  chunkType: string;
  title?: string;
  content: string;
  tokenCount: number;
  sectionType?: string;
  companyName?: string;
  jobTitle?: string;
  institutionName?: string;
  degree?: string;
  technologies?: string[];
  skills?: string[];
  dateRange?: string;
  location?: string;
  embedding?: number[];
}

export interface CandidateProfile {
  id: string;
  documentId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  professionalSummary?: string;
  yearsExperience?: number;
  currentTitle?: string;
  currentCompany?: string;
  technicalSkills?: string[];
  softSkills?: string[];
  certifications?: string[];
  languages?: string[];
  highestDegree?: string;
  educationInstitutions?: string[];
  profileCompletenessScore?: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  similarity: number;
  chunkType: string;
  title?: string;
  content: string;
  companyName?: string;
  jobTitle?: string;
  technologies?: string[];
  metadata: Record<string, any>;
}

export interface RAGQuery {
  query: string;
  filters?: {
    chunkTypes?: string[];
    companies?: string[];
    technologies?: string[];
    dateRange?: string;
    experienceLevel?: string;
  };
  maxResults?: number;
  similarityThreshold?: number;
}

export interface RAGResponse {
  results: SearchResult[];
  candidateProfiles: CandidateProfile[];
  totalResults: number;
  processingTime: number;
  query: string;
  suggestions?: string[];
}

class RAGService {
  private supabase;
  private openai;
  private embeddingModel: string;
  private chatModel: string;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
    
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Process and chunk a document using hierarchical strategy
   */
  async processDocument(
    documentId: string,
    content: string,
    _metadata: Record<string, any> = {}
  ): Promise<DocumentChunk[]> {
    try {
      // Step 1: Extract structured information using LLM
      const structuredData = await this.extractStructuredData(content);
      
      // Step 2: Create hierarchical chunks
      const chunks = await this.createHierarchicalChunks(
        documentId,
        content,
        structuredData
      );
      
      // Step 3: Generate embeddings for each chunk
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunk) => {
          const embeddingText = this.createEmbeddingText(chunk);
          const embedding = await this.generateEmbedding(embeddingText);
          return { ...chunk, embedding };
        })
      );
      
      // Step 4: Store chunks in database
      await this.storeChunks(chunksWithEmbeddings);
      
      // Step 5: Create candidate profile
      await this.createCandidateProfile(documentId, structuredData);
      
      return chunksWithEmbeddings;
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error('Failed to process document');
    }
  }

  /**
   * Extract structured data from document using LLM
   */
  private async extractStructuredData(content: string): Promise<any> {
    const prompt = `
    Analyze this resume/CV and extract structured information. Return a JSON object with the following structure:

    {
      "personalInfo": {
        "fullName": "string",
        "email": "string",
        "phone": "string",
        "location": "string",
        "linkedinUrl": "string",
        "githubUrl": "string",
        "portfolioUrl": "string"
      },
      "professionalSummary": "string",
      "workExperience": [
        {
          "companyName": "string",
          "jobTitle": "string",
          "startDate": "string",
          "endDate": "string",
          "location": "string",
          "description": "string",
          "achievements": ["string"],
          "technologies": ["string"]
        }
      ],
      "education": [
        {
          "institutionName": "string",
          "degree": "string",
          "fieldOfStudy": "string",
          "startDate": "string",
          "endDate": "string",
          "gpa": "string",
          "honors": ["string"]
        }
      ],
      "skills": {
        "technical": ["string"],
        "soft": ["string"]
      },
      "certifications": ["string"],
      "languages": ["string"],
      "projects": [
        {
          "name": "string",
          "description": "string",
          "technologies": ["string"],
          "url": "string"
        }
      ]
    }

    Document content:
    ${content}
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.chatModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const result = response.choices[0].message.content;
      return JSON.parse(result || '{}');
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return {};
    }
  }

  /**
   * Create hierarchical chunks from document content
   */
  private async createHierarchicalChunks(
    documentId: string,
    _content: string,
    structuredData: any
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    let chunkOrder = 0;

    // Level 1: Summary chunk (300 tokens)
    const summaryChunk: DocumentChunk = {
      id: uuidv4(),
      documentId,
      chunkLevel: 1,
      chunkOrder: chunkOrder++,
      chunkType: 'summary',
      title: 'Professional Summary',
      content: this.createSummaryContent(structuredData),
      tokenCount: this.estimateTokens(this.createSummaryContent(structuredData)),
      sectionType: 'summary',
    };
    chunks.push(summaryChunk);

    // Level 2: Experience sections (600 tokens each)
    if (structuredData.workExperience) {
      for (const exp of structuredData.workExperience) {
        const expChunk: DocumentChunk = {
          id: uuidv4(),
          documentId,
          parentChunkId: summaryChunk.id,
          chunkLevel: 2,
          chunkOrder: chunkOrder++,
          chunkType: 'experience',
          title: `${exp.jobTitle} at ${exp.companyName}`,
          content: this.createExperienceContent(exp),
          tokenCount: this.estimateTokens(this.createExperienceContent(exp)),
          sectionType: 'experience',
          companyName: exp.companyName,
          jobTitle: exp.jobTitle,
          technologies: exp.technologies || [],
          dateRange: `${exp.startDate} - ${exp.endDate}`,
          location: exp.location,
        };
        chunks.push(expChunk);

        // Level 3: Detailed achievements (400 tokens each)
        if (exp.achievements && exp.achievements.length > 0) {
          for (let i = 0; i < exp.achievements.length; i++) {
            const achievement = exp.achievements[i];
            const detailChunk: DocumentChunk = {
              id: uuidv4(),
              documentId,
              parentChunkId: expChunk.id,
              chunkLevel: 3,
              chunkOrder: chunkOrder++,
              chunkType: 'detail',
              title: `Achievement ${i + 1} - ${exp.companyName}`,
              content: achievement,
              tokenCount: this.estimateTokens(achievement),
              sectionType: 'experience',
              companyName: exp.companyName,
              jobTitle: exp.jobTitle,
              technologies: exp.technologies || [],
            };
            chunks.push(detailChunk);
          }
        }
      }
    }

    // Level 2: Education sections
    if (structuredData.education) {
      for (const edu of structuredData.education) {
        const eduChunk: DocumentChunk = {
          id: uuidv4(),
          documentId,
          parentChunkId: summaryChunk.id,
          chunkLevel: 2,
          chunkOrder: chunkOrder++,
          chunkType: 'education',
          title: `${edu.degree} from ${edu.institutionName}`,
          content: this.createEducationContent(edu),
          tokenCount: this.estimateTokens(this.createEducationContent(edu)),
          sectionType: 'education',
          institutionName: edu.institutionName,
          degree: edu.degree,
          dateRange: `${edu.startDate} - ${edu.endDate}`,
        };
        chunks.push(eduChunk);
      }
    }

    // Level 2: Skills section
    if (structuredData.skills) {
      const skillsChunk: DocumentChunk = {
        id: uuidv4(),
        documentId,
        parentChunkId: summaryChunk.id,
        chunkLevel: 2,
        chunkOrder: chunkOrder++,
        chunkType: 'skills',
        title: 'Technical Skills',
        content: this.createSkillsContent(structuredData.skills),
        tokenCount: this.estimateTokens(this.createSkillsContent(structuredData.skills)),
        sectionType: 'skills',
        technologies: structuredData.skills.technical || [],
        skills: [...(structuredData.skills.technical || []), ...(structuredData.skills.soft || [])],
      };
      chunks.push(skillsChunk);
    }

    return chunks;
  }

  /**
   * Create embedding text with context
   */
  private createEmbeddingText(chunk: DocumentChunk): string {
    const parts = [chunk.content];
    
    if (chunk.companyName) parts.push(`Company: ${chunk.companyName}`);
    if (chunk.jobTitle) parts.push(`Role: ${chunk.jobTitle}`);
    if (chunk.technologies?.length) parts.push(`Technologies: ${chunk.technologies.join(', ')}`);
    if (chunk.skills?.length) parts.push(`Skills: ${chunk.skills.join(', ')}`);
    if (chunk.sectionType) parts.push(`Section: ${chunk.sectionType}`);
    
    return parts.join(' | ');
  }

  /**
   * Perform multi-dimensional semantic search
   */
  async search(query: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query.query);
      
      // Perform semantic search with filters
      const { data: searchResults, error } = await this.supabase
        .rpc('semantic_search', {
          query_embedding: queryEmbedding,
          similarity_threshold: query.similarityThreshold || 0.7,
          max_results: query.maxResults || 10,
          filter_chunk_types: query.filters?.chunkTypes || null,
          filter_companies: query.filters?.companies || null,
          filter_technologies: query.filters?.technologies || null,
        });

      if (error) throw error;

      // Get unique document IDs from results
      const documentIds = [...new Set(searchResults.map((r: any) => r.document_id))];
      
      // Fetch candidate profiles for these documents
      const { data: profiles } = await this.supabase
        .from('candidate_profiles')
        .select('*')
        .in('document_id', documentIds);

      // Log search query for analytics
      await this.logSearchQuery(query.query, queryEmbedding, searchResults.length);

      const processingTime = Date.now() - startTime;

      return {
        results: searchResults.map(this.mapSearchResult),
        candidateProfiles: profiles || [],
        totalResults: searchResults.length,
        processingTime,
        query: query.query,
        suggestions: await this.generateSearchSuggestions(query.query, searchResults),
      };
    } catch (error) {
      console.error('Error performing search:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Store chunks in database
   */
  private async storeChunks(chunks: DocumentChunk[]): Promise<void> {
    const { error } = await this.supabase
      .from('document_chunks')
      .insert(chunks.map(chunk => ({
        id: chunk.id,
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
        job_title: chunk.jobTitle,
        institution_name: chunk.institutionName,
        degree: chunk.degree,
        technologies: chunk.technologies,
        skills: chunk.skills,
        date_range: chunk.dateRange,
        location: chunk.location,
        embedding: chunk.embedding,
      })));

    if (error) throw error;
  }

  /**
   * Create candidate profile from structured data
   */
  private async createCandidateProfile(documentId: string, structuredData: any): Promise<void> {
    const profile = {
      document_id: documentId,
      full_name: structuredData.personalInfo?.fullName,
      email: structuredData.personalInfo?.email,
      phone: structuredData.personalInfo?.phone,
      location: structuredData.personalInfo?.location,
      linkedin_url: structuredData.personalInfo?.linkedinUrl,
      github_url: structuredData.personalInfo?.githubUrl,
      portfolio_url: structuredData.personalInfo?.portfolioUrl,
      professional_summary: structuredData.professionalSummary,
      years_experience: this.calculateYearsExperience(structuredData.workExperience),
      current_title: structuredData.workExperience?.[0]?.jobTitle,
      current_company: structuredData.workExperience?.[0]?.companyName,
      technical_skills: structuredData.skills?.technical || [],
      soft_skills: structuredData.skills?.soft || [],
      certifications: structuredData.certifications || [],
      languages: structuredData.languages || [],
      highest_degree: this.getHighestDegree(structuredData.education),
      education_institutions: structuredData.education?.map((e: any) => e.institutionName) || [],
      profile_completeness_score: this.calculateCompletenessScore(structuredData),
    };

    const { error } = await this.supabase
      .from('candidate_profiles')
      .insert(profile);

    if (error) throw error;
  }

  // Helper methods for content creation
  private createSummaryContent(data: any): string {
    const parts = [];
    if (data.personalInfo?.fullName) parts.push(`Name: ${data.personalInfo.fullName}`);
    if (data.professionalSummary) parts.push(data.professionalSummary);
    if (data.workExperience?.length) {
      parts.push(`Current Role: ${data.workExperience[0].jobTitle} at ${data.workExperience[0].companyName}`);
    }
    if (data.skills?.technical?.length) {
      parts.push(`Key Technologies: ${data.skills.technical.slice(0, 10).join(', ')}`);
    }
    return parts.join(' | ');
  }

  private createExperienceContent(exp: any): string {
    const parts = [
      `${exp.jobTitle} at ${exp.companyName}`,
      `${exp.startDate} - ${exp.endDate}`,
      exp.description,
    ];
    if (exp.achievements?.length) {
      parts.push(`Achievements: ${exp.achievements.join('; ')}`);
    }
    if (exp.technologies?.length) {
      parts.push(`Technologies: ${exp.technologies.join(', ')}`);
    }
    return parts.join(' | ');
  }

  private createEducationContent(edu: any): string {
    return [
      `${edu.degree} in ${edu.fieldOfStudy}`,
      `${edu.institutionName}`,
      `${edu.startDate} - ${edu.endDate}`,
      edu.gpa ? `GPA: ${edu.gpa}` : '',
      edu.honors?.length ? `Honors: ${edu.honors.join(', ')}` : '',
    ].filter(Boolean).join(' | ');
  }

  private createSkillsContent(skills: any): string {
    const parts = [];
    if (skills.technical?.length) parts.push(`Technical: ${skills.technical.join(', ')}`);
    if (skills.soft?.length) parts.push(`Soft Skills: ${skills.soft.join(', ')}`);
    return parts.join(' | ');
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimation
  }

  private calculateYearsExperience(workExp: any[]): number {
    if (!workExp?.length) return 0;
    // Simple calculation - could be more sophisticated
    return workExp.length * 2; // Assume 2 years average per role
  }

  private getHighestDegree(education: any[]): string {
    if (!education?.length) return '';
    const degrees = education.map(e => e.degree).filter(Boolean);
    // Simple logic - could be more sophisticated
    if (degrees.some(d => d.toLowerCase().includes('phd'))) return 'PhD';
    if (degrees.some(d => d.toLowerCase().includes('master'))) return 'Masters';
    if (degrees.some(d => d.toLowerCase().includes('bachelor'))) return 'Bachelors';
    return degrees[0] || '';
  }

  private calculateCompletenessScore(data: any): number {
    let score = 0;
    const maxScore = 10;
    
    if (data.personalInfo?.fullName) score++;
    if (data.personalInfo?.email) score++;
    if (data.professionalSummary) score++;
    if (data.workExperience?.length) score += 2;
    if (data.education?.length) score++;
    if (data.skills?.technical?.length) score += 2;
    if (data.personalInfo?.linkedinUrl) score++;
    if (data.certifications?.length) score++;
    
    return score / maxScore;
  }

  private mapSearchResult(result: any): SearchResult {
    return {
      chunkId: result.chunk_id,
      documentId: result.document_id,
      similarity: result.similarity,
      chunkType: result.chunk_type,
      title: result.title,
      content: result.content,
      companyName: result.company_name,
      jobTitle: result.job_title,
      technologies: result.technologies,
      metadata: result.metadata,
    };
  }

  private async logSearchQuery(query: string, embedding: number[], resultCount: number): Promise<void> {
    await this.supabase
      .from('search_queries')
      .insert({
        query_text: query,
        query_embedding: embedding,
        results_count: resultCount,
        session_id: 'demo-session', // Could be dynamic
      });
  }

  private async generateSearchSuggestions(_query: string, _results: any[]): Promise<string[]> {
    // Simple suggestions based on results
    const suggestions = [];
    const companies = [...new Set(_results.map((r: any) => r.company_name).filter(Boolean))];
    const technologies = [...new Set(_results.flatMap((r: any) => r.technologies || []))];
    
    if (companies.length > 0) {
      suggestions.push(`candidates from ${companies[0]}`);
    }
    if (technologies.length > 0) {
      suggestions.push(`${technologies[0]} developers`);
    }
    
    return suggestions.slice(0, 3);
  }
}

export const ragService = new RAGService(); 