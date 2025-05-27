import { documentProcessor } from '../services/documentProcessor';
import type { ProcessingResult, DocumentMetadata } from '../services/documentProcessor';
import { ragService } from '../services/ragService';
import type { RAGQuery, RAGResponse } from '../services/ragService';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  documentId: string;
  jobId: string;
  message: string;
}

export interface SearchResponse extends RAGResponse {
  // Additional API-specific fields can be added here
}

export interface DocumentListResponse {
  documents: any[];
  total: number;
  page: number;
  limit: number;
}

export interface StatsResponse {
  documents: {
    total: number;
    processed: number;
    processing: number;
    failed: number;
  };
  chunks: number;
  profiles: number;
  processingQueue: {
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
}

class RAGApi {
  /**
   * Upload and process a document
   */
  async uploadDocument(
    file: File,
    options: {
      sourceIntegration?: string;
      sourcePath?: string;
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<ApiResponse<UploadResponse>> {
    try {
      // Validate file
      const validation = documentProcessor.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Prepare metadata
      const metadata: DocumentMetadata = {
        filename: `${Date.now()}_${file.name}`,
        originalFilename: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || '',
        fileSize: file.size,
        sourceIntegration: options.sourceIntegration,
        sourcePath: options.sourcePath,
        uploadedBy: 'demo-user', // In real app, get from auth context
      };

      // Process document
      const result = await documentProcessor.uploadAndProcess(
        file,
        metadata,
        options.onProgress
      );

      if (result.success) {
        return {
          success: true,
          data: {
            documentId: result.documentId,
            jobId: result.documentId, // Using documentId as jobId for simplicity
            message: `Document processed successfully. Created ${result.chunksCreated} chunks.`,
          },
          message: 'Document uploaded and processed successfully',
        };
      } else {
        return {
          success: false,
          error: result.error || 'Document processing failed',
        };
      }
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Search documents using RAG
   */
  async search(query: RAGQuery): Promise<ApiResponse<SearchResponse>> {
    try {
      if (!query.query.trim()) {
        return {
          success: false,
          error: 'Search query cannot be empty',
        };
      }

      const result = await ragService.search(query);

      return {
        success: true,
        data: result,
        message: `Found ${result.totalResults} results in ${result.processingTime}ms`,
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      };
    }
  }

  /**
   * Get list of documents
   */
  async getDocuments(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<DocumentListResponse>> {
    try {
      const offset = (page - 1) * limit;
      const documents = await documentProcessor.getDocuments(limit, offset);

      // Get total count (simplified - in real app, you'd want a separate count query)
      const allDocuments = await documentProcessor.getDocuments(1000, 0);
      const total = allDocuments.length;

      return {
        success: true,
        data: {
          documents,
          total,
          page,
          limit,
        },
        message: `Retrieved ${documents.length} documents`,
      };
    } catch (error) {
      console.error('Get documents error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve documents',
      };
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
    try {
      await documentProcessor.deleteDocument(documentId);

      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      console.error('Delete document error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete document',
      };
    }
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<ApiResponse<StatsResponse>> {
    try {
      const [documentStats, queueStats] = await Promise.all([
        documentProcessor.getDocumentStats(),
        Promise.resolve(documentProcessor.getProcessingQueueStatus()),
      ]);

      return {
        success: true,
        data: {
          documents: {
            total: documentStats.total,
            processed: documentStats.processed,
            processing: documentStats.processing,
            failed: documentStats.failed,
          },
          chunks: documentStats.totalChunks,
          profiles: documentStats.totalProfiles,
          processingQueue: queueStats,
        },
        message: 'Statistics retrieved successfully',
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve statistics',
      };
    }
  }

  /**
   * Get processing job status
   */
  async getJobStatus(jobId: string): Promise<ApiResponse<any>> {
    try {
      const job = documentProcessor.getJobStatus(jobId);

      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      return {
        success: true,
        data: {
          id: job.id,
          documentId: job.documentId,
          status: job.status,
          progress: job.progress,
          error: job.error,
          startTime: job.startTime,
          endTime: job.endTime,
          processingTime: job.endTime 
            ? job.endTime.getTime() - job.startTime.getTime()
            : Date.now() - job.startTime.getTime(),
        },
        message: `Job status: ${job.status}`,
      };
    } catch (error) {
      console.error('Get job status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job status',
      };
    }
  }

  /**
   * Advanced search with filters
   */
  async advancedSearch(params: {
    query: string;
    filters?: {
      companies?: string[];
      technologies?: string[];
      chunkTypes?: string[];
      experienceLevel?: string;
      dateRange?: string;
    };
    pagination?: {
      page?: number;
      limit?: number;
    };
    sorting?: {
      field?: 'similarity' | 'date' | 'relevance';
      order?: 'asc' | 'desc';
    };
  }): Promise<ApiResponse<SearchResponse & { pagination: any }>> {
    try {
      const ragQuery: RAGQuery = {
        query: params.query,
        filters: params.filters,
        maxResults: params.pagination?.limit || 10,
        similarityThreshold: 0.7,
      };

      const result = await ragService.search(ragQuery);

      // Apply pagination (simplified - in real app, you'd handle this in the database)
      const page = params.pagination?.page || 1;
      const limit = params.pagination?.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedResults = {
        ...result,
        results: result.results.slice(startIndex, endIndex),
      };

      return {
        success: true,
        data: {
          ...paginatedResults,
          pagination: {
            page,
            limit,
            total: result.totalResults,
            totalPages: Math.ceil(result.totalResults / limit),
            hasNext: endIndex < result.totalResults,
            hasPrev: page > 1,
          },
        },
        message: `Advanced search completed in ${result.processingTime}ms`,
      };
    } catch (error) {
      console.error('Advanced search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Advanced search failed',
      };
    }
  }

  /**
   * Get candidate profile by document ID
   */
  async getCandidateProfile(documentId: string): Promise<ApiResponse<any>> {
    try {
      // This would typically be a direct database query
      // For now, we'll use the search functionality to get the profile
      const searchResult = await ragService.search({
        query: `document:${documentId}`,
        maxResults: 1,
      });

      const profile = searchResult.candidateProfiles.find(
        p => p.documentId === documentId
      );

      if (!profile) {
        return {
          success: false,
          error: 'Candidate profile not found',
        };
      }

      return {
        success: true,
        data: profile,
        message: 'Candidate profile retrieved successfully',
      };
    } catch (error) {
      console.error('Get candidate profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve candidate profile',
      };
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(partialQuery: string): Promise<ApiResponse<string[]>> {
    try {
      // Simple implementation - in a real app, you might use a dedicated search suggestions service
      const commonQueries = [
        'software engineer',
        'data scientist',
        'product manager',
        'frontend developer',
        'backend developer',
        'full stack developer',
        'machine learning engineer',
        'devops engineer',
        'python developer',
        'javascript developer',
        'react developer',
        'node.js developer',
        'aws experience',
        'kubernetes experience',
        'senior level',
        'junior level',
        'remote work',
        'startup experience',
        'enterprise experience',
      ];

      const suggestions = commonQueries
        .filter(query => 
          query.toLowerCase().includes(partialQuery.toLowerCase())
        )
        .slice(0, 5);

      return {
        success: true,
        data: suggestions,
        message: `Found ${suggestions.length} suggestions`,
      };
    } catch (error) {
      console.error('Get search suggestions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get search suggestions',
      };
    }
  }

  /**
   * Bulk upload documents
   */
  async bulkUpload(
    files: File[],
    options: {
      sourceIntegration?: string;
      onProgress?: (fileIndex: number, progress: number) => void;
      onFileComplete?: (fileIndex: number, result: ProcessingResult) => void;
    } = {}
  ): Promise<ApiResponse<{ results: ProcessingResult[]; summary: any }>> {
    try {
      const results: ProcessingResult[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
          const metadata: DocumentMetadata = {
            filename: `${Date.now()}_${file.name}`,
            originalFilename: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() || '',
            fileSize: file.size,
            sourceIntegration: options.sourceIntegration,
            uploadedBy: 'demo-user',
          };

          const result = await documentProcessor.uploadAndProcess(
            file,
            metadata,
            (progress) => options.onProgress?.(i, progress)
          );

          results.push(result);
          options.onFileComplete?.(i, result);
        } catch (error) {
          const failedResult: ProcessingResult = {
            documentId: '',
            success: false,
            chunksCreated: 0,
            profileCreated: false,
            processingTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          results.push(failedResult);
          options.onFileComplete?.(i, failedResult);
        }
      }

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        totalChunks: results.reduce((sum, r) => sum + r.chunksCreated, 0),
        totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
      };

      return {
        success: true,
        data: { results, summary },
        message: `Bulk upload completed: ${summary.successful}/${summary.total} files processed successfully`,
      };
    } catch (error) {
      console.error('Bulk upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk upload failed',
      };
    }
  }
}

export const ragApi = new RAGApi(); 