import { createClient } from '@supabase/supabase-js';
import { ragService } from './ragService';
import { v4 as uuidv4 } from 'uuid';

// Document processing interfaces
export interface ProcessingJob {
  id: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

export interface DocumentMetadata {
  filename: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  sourceIntegration?: string;
  sourcePath?: string;
  uploadedBy?: string;
}

export interface ProcessingResult {
  documentId: string;
  success: boolean;
  chunksCreated: number;
  profileCreated: boolean;
  processingTime: number;
  error?: string;
}

class DocumentProcessor {
  private supabase;
  private llmWhispererApiKey: string;
  private llmWhispererBaseUrl: string;
  private processingJobs: Map<string, ProcessingJob> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.llmWhispererApiKey = process.env.LLMWHISPERER_API_KEY!;
    this.llmWhispererBaseUrl = process.env.LLMWHISPERER_BASE_URL || 'https://llmwhisperer-api.us-central.unstract.com/api/v2';
  }

  /**
   * Upload and process a document
   */
  async uploadAndProcess(
    file: File | Buffer,
    metadata: DocumentMetadata,
    onProgress?: (progress: number) => void
  ): Promise<ProcessingResult> {
    const documentId = uuidv4();
    const jobId = uuidv4();
    
    try {
      // Create processing job
      const job: ProcessingJob = {
        id: jobId,
        documentId,
        status: 'pending',
        progress: 0,
        startTime: new Date(),
      };
      this.processingJobs.set(jobId, job);
      
      // Step 1: Store document metadata (10%)
      await this.storeDocumentMetadata(documentId, metadata);
      this.updateJobProgress(jobId, 10, 'processing');
      onProgress?.(10);

      // Step 2: Extract text content (40%)
      const textContent = await this.extractTextContent(file, metadata.fileType);
      this.updateJobProgress(jobId, 50, 'processing');
      onProgress?.(50);

      // Step 3: Process with RAG service (90%)
      const chunks = await ragService.processDocument(documentId, textContent, metadata);
      this.updateJobProgress(jobId, 90, 'processing');
      onProgress?.(90);

      // Step 4: Update document status (100%)
      await this.updateDocumentStatus(documentId, 'completed');
      this.updateJobProgress(jobId, 100, 'completed');
      onProgress?.(100);

      const result: ProcessingResult = {
        documentId,
        success: true,
        chunksCreated: chunks.length,
        profileCreated: true,
        processingTime: Date.now() - job.startTime.getTime(),
      };

      return result;
    } catch (error) {
      console.error('Error processing document:', error);
      
      this.updateJobProgress(jobId, 0, 'failed', error instanceof Error ? error.message : 'Unknown error');
      await this.updateDocumentStatus(documentId, 'failed');

      return {
        documentId,
        success: false,
        chunksCreated: 0,
        profileCreated: false,
        processingTime: Date.now() - this.processingJobs.get(jobId)!.startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract text content from various file types
   */
  private async extractTextContent(file: File | Buffer, fileType: string): Promise<string> {
    const fileBuffer = file instanceof File ? await file.arrayBuffer() : file;
    const buffer = Buffer.from(fileBuffer);

    switch (fileType.toLowerCase()) {
      case 'pdf':
        return await this.extractFromPDF(buffer);
      case 'docx':
        return await this.extractFromDocx(buffer);
      case 'txt':
        return buffer.toString('utf-8');
      case 'csv':
        return await this.extractFromCSV(buffer);
      case 'xlsx':
        return await this.extractFromExcel(buffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract text from PDF using LLMWhisperer
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Create form data for LLMWhisperer API
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');
      formData.append('processing_mode', 'ocr'); // Use OCR for better text extraction
      formData.append('output_mode', 'text'); // Get plain text output
      formData.append('force_text_processing', 'true'); // Force text processing
      formData.append('pages_to_extract', 'all'); // Extract all pages

      const response = await fetch(`${this.llmWhispererBaseUrl}/whisper`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.llmWhispererApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`LLMWhisperer API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        return result.extracted_text || '';
      } else {
        throw new Error(`LLMWhisperer processing failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error extracting from PDF:', error);
      // Fallback to basic PDF parsing if LLMWhisperer fails
      return await this.fallbackPDFExtraction(buffer);
    }
  }

  /**
   * Fallback PDF extraction using pdf-parse
   */
  private async fallbackPDFExtraction(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      return data.text;
    } catch (error) {
      console.error('Fallback PDF extraction failed:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from DOCX files
   */
  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting from DOCX:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  /**
   * Extract text from CSV files
   */
  private async extractFromCSV(buffer: Buffer): Promise<string> {
    try {
      const Papa = await import('papaparse');
      const csvText = buffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true });
      
      // Convert CSV data to readable text format
      const rows = parsed.data as any[];
      const textLines = rows.map(row => {
        return Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      });
      
      return textLines.join('\n');
    } catch (error) {
      console.error('Error extracting from CSV:', error);
      throw new Error('Failed to extract text from CSV');
    }
  }

  /**
   * Extract text from Excel files
   */
  private async extractFromExcel(buffer: Buffer): Promise<string> {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      let allText = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        allText += `Sheet: ${sheetName}\n${csvText}\n\n`;
      });
      
      return allText;
    } catch (error) {
      console.error('Error extracting from Excel:', error);
      throw new Error('Failed to extract text from Excel');
    }
  }

  /**
   * Store document metadata in database
   */
  private async storeDocumentMetadata(documentId: string, metadata: DocumentMetadata): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .insert({
        id: documentId,
        filename: metadata.filename,
        original_filename: metadata.originalFilename,
        file_type: metadata.fileType,
        file_size: metadata.fileSize,
        source_integration: metadata.sourceIntegration,
        source_path: metadata.sourcePath,
        processing_status: 'processing',
        metadata: {
          uploadedBy: metadata.uploadedBy,
          uploadedAt: new Date().toISOString(),
        },
      });

    if (error) throw error;
  }

  /**
   * Update document processing status
   */
  private async updateDocumentStatus(documentId: string, status: string): Promise<void> {
    const updateData: any = {
      processing_status: status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.processed_date = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) throw error;
  }

  /**
   * Update processing job progress
   */
  private updateJobProgress(
    jobId: string,
    progress: number,
    status: ProcessingJob['status'],
    error?: string
  ): void {
    const job = this.processingJobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.status = status;
      if (error) job.error = error;
      if (status === 'completed' || status === 'failed') {
        job.endTime = new Date();
      }
    }
  }

  /**
   * Get processing job status
   */
  getJobStatus(jobId: string): ProcessingJob | undefined {
    return this.processingJobs.get(jobId);
  }

  /**
   * Get all documents with their processing status
   */
  async getDocuments(limit: number = 50, offset: number = 0): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select(`
        *,
        candidate_profiles (
          full_name,
          current_title,
          current_company,
          profile_completeness_score
        )
      `)
      .order('upload_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  }

  /**
   * Delete a document and all associated data
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Delete document (cascades to chunks and profiles)
    const { error } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(): Promise<{
    total: number;
    processed: number;
    processing: number;
    failed: number;
    totalChunks: number;
    totalProfiles: number;
  }> {
    const [documentsResult, chunksResult, profilesResult] = await Promise.all([
      this.supabase
        .from('documents')
        .select('processing_status'),
      this.supabase
        .from('document_chunks')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('candidate_profiles')
        .select('id', { count: 'exact', head: true }),
    ]);

    const documents = documentsResult.data || [];
    const stats = {
      total: documents.length,
      processed: documents.filter(d => d.processing_status === 'completed').length,
      processing: documents.filter(d => d.processing_status === 'processing').length,
      failed: documents.filter(d => d.processing_status === 'failed').length,
      totalChunks: chunksResult.count || 0,
      totalProfiles: profilesResult.count || 0,
    };

    return stats;
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(documentId: string): Promise<ProcessingResult> {
    // Get document metadata
    const { data: document, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      throw new Error('Document not found');
    }

    // Clear existing chunks and profile
    await this.supabase.from('document_chunks').delete().eq('document_id', documentId);
    await this.supabase.from('candidate_profiles').delete().eq('document_id', documentId);

    // Note: This would need the original file content
    // In a real implementation, you might store the file in Supabase Storage
    throw new Error('Reprocessing requires original file content - implement file storage first');
  }

  /**
   * Validate file before processing
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt,csv,xlsx').split(',');
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
      };
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      return {
        valid: false,
        error: `File type not supported. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get processing queue status
   */
  getProcessingQueueStatus(): {
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.processingJobs.values());
    
    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(j => j.status === 'pending').length,
      processingJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
    };
  }
}

export const documentProcessor = new DocumentProcessor(); 