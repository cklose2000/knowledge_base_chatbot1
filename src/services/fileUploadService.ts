import { financeRagService } from './financeRagService';
import { llmWhispererService } from './llmWhispererService';
import { pdfService } from './pdfService';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  documentId?: string;
  extractedText?: string;
  financialMetrics?: any;
  uploadedAt: Date;
}

export interface FileUploadOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  onProgress?: (fileId: string, progress: number) => void;
  onComplete?: (fileId: string, result: any) => void;
  onError?: (fileId: string, error: string) => void;
}

class FileUploadService {
  private uploadedFiles: Map<string, UploadedFile> = new Map();
  private readonly defaultMaxSize = 50 * 1024 * 1024; // 50MB
  private readonly defaultAllowedTypes = [
    'text/plain',
    'text/csv',
    'application/json',
    'application/pdf', // Re-enabled with LLMWhisperer support
    // Future support (requires additional libraries):
    // 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    // 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    // 'application/vnd.ms-excel', // .xls
  ];

  /**
   * Open file picker and handle file selection
   */
  async selectAndUploadFiles(options: FileUploadOptions = {}): Promise<UploadedFile[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = (options.allowedTypes || this.defaultAllowedTypes).join(',');
      
      input.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          resolve([]);
          return;
        }

        try {
          const uploadPromises = Array.from(files).map(file => 
            this.uploadFile(file, options)
          );
          const results = await Promise.all(uploadPromises);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      };

      input.click();
    });
  }

  /**
   * Upload and process a single file
   */
  async uploadFile(file: File, options: FileUploadOptions = {}): Promise<UploadedFile> {
    const fileId = uuidv4();
    const maxSize = options.maxSize || this.defaultMaxSize;
    const allowedTypes = options.allowedTypes || this.defaultAllowedTypes;

    // Validate file
    if (file.size > maxSize) {
      throw new Error(`File size exceeds limit of ${this.formatFileSize(maxSize)}`);
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported`);
    }

    // Create upload record
    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading',
      progress: 0,
      uploadedAt: new Date()
    };

    this.uploadedFiles.set(fileId, uploadedFile);

    try {
      // Step 1: Read file content
      this.updateProgress(fileId, 10, 'uploading', options.onProgress);
      const fileContent = await this.readFileContent(file);
      
      // Step 2: Extract text from file
      this.updateProgress(fileId, 30, 'processing', options.onProgress);
      const extractedText = await this.extractTextFromFile(file, fileContent);
      console.log(`📄 [FileUpload] Extracted text length: ${extractedText.length} characters`);
      console.log(`📄 [FileUpload] First 200 chars: ${extractedText.substring(0, 200)}...`);
      
      // Step 3: Process with Finance RAG
      this.updateProgress(fileId, 60, 'processing', options.onProgress);
      const documentId = uuidv4();
      console.log(`🔄 [FileUpload] Processing document with ID: ${documentId}`);
      const chunks = await financeRagService.processFinancialDocument(
        documentId,
        extractedText,
        {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString()
        }
      );
      console.log(`✅ [FileUpload] Created ${chunks.length} chunks for document ${documentId}`);

      // Step 4: Complete upload
      this.updateProgress(fileId, 100, 'completed', options.onProgress);
      
      const completedFile: UploadedFile = {
        ...uploadedFile,
        status: 'completed',
        progress: 100,
        documentId,
        extractedText,
        financialMetrics: chunks.find(c => c.chunkType === 'key_metrics')
      };

      this.uploadedFiles.set(fileId, completedFile);
      
      if (options.onComplete) {
        options.onComplete(fileId, { documentId, chunks });
      }

      return completedFile;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      const errorFile: UploadedFile = {
        ...uploadedFile,
        status: 'error',
        error: errorMessage
      };

      this.uploadedFiles.set(fileId, errorFile);
      
      if (options.onError) {
        options.onError(fileId, errorMessage);
      }

      throw error;
    }
  }

  /**
   * Read file content as ArrayBuffer
   */
  private readFileContent(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extract text from different file types
   */
  private async extractTextFromFile(file: File, content: ArrayBuffer): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    try {
      // Handle text-based files that we can process immediately
      if (fileType === 'text/plain' || 
          fileType === 'text/csv' || 
          fileType === 'application/json' ||
          fileName.endsWith('.txt') ||
          fileName.endsWith('.csv') ||
          fileName.endsWith('.json')) {
        return new TextDecoder().decode(content);
      }
      
      // Handle PDF files using our PDF service (with LLMWhisperer fallback)
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        try {
          // Try our PDF.js service first
          return await pdfService.extractTextFromPDF(content, file.name);
        } catch (error) {
          console.log('📄 [FileUpload] PDF.js failed, trying LLMWhisperer fallback...');
          // Fallback to LLMWhisperer if available
          return await llmWhispererService.extractTextFromPDF(content, file.name);
        }
      }
      
      // For now, throw helpful errors for unsupported types
      if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        throw new Error('Excel processing requires additional setup. Please export as CSV or use text files for now.');
      } else if (fileType.includes('wordprocessing') || fileName.endsWith('.docx')) {
        throw new Error('Word document processing requires additional setup. Please export as text or use .txt files for now.');
      } else {
        throw new Error(`Unsupported file type: ${fileType}. Please use supported formats: TXT, CSV, JSON.`);
      }
    } catch (error) {
      console.error('Text extraction failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to extract text from ${file.name}`);
    }
  }

  /**
   * Extract text from PDF files - temporarily disabled due to worker issues
   */
  private async extractTextFromPDF(content: ArrayBuffer): Promise<string> {
    // Temporarily disable PDF processing due to worker loading issues
    // This will be re-enabled once we resolve the PDF.js worker configuration
    throw new Error('PDF processing is temporarily disabled. Please convert your PDF to text format or use TXT, CSV, or JSON files for now.');
    
    // TODO: Re-enable PDF processing with proper worker configuration
    // The PDF.js library is having issues loading workers in the current environment
    // We need to either:
    // 1. Bundle the worker locally
    // 2. Use a different PDF processing approach
    // 3. Set up proper CDN worker loading
  }

  // Future file processing methods (currently unused)
  // private async extractTextFromExcel(content: ArrayBuffer): Promise<string> {
  //   throw new Error('Excel processing not yet implemented - please use text files for now');
  // }

  // private async extractTextFromDocx(content: ArrayBuffer): Promise<string> {
  //   throw new Error('DOCX processing not yet implemented - please use text files for now');
  // }

  /**
   * Update file progress
   */
  private updateProgress(
    fileId: string, 
    progress: number, 
    status: UploadedFile['status'],
    onProgress?: (fileId: string, progress: number) => void
  ) {
    const file = this.uploadedFiles.get(fileId);
    if (file) {
      file.progress = progress;
      file.status = status;
      this.uploadedFiles.set(fileId, file);
      
      if (onProgress) {
        onProgress(fileId, progress);
      }
    }
  }

  /**
   * Get uploaded file by ID
   */
  getUploadedFile(fileId: string): UploadedFile | undefined {
    return this.uploadedFiles.get(fileId);
  }

  /**
   * Get all uploaded files
   */
  getAllUploadedFiles(): UploadedFile[] {
    return Array.from(this.uploadedFiles.values());
  }

  /**
   * Remove uploaded file
   */
  removeUploadedFile(fileId: string): boolean {
    return this.uploadedFiles.delete(fileId);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get supported file types for display
   */
  getSupportedFileTypes(): string[] {
    return [
      'PDF documents (.pdf)',
      'Text files (.txt)',
      'CSV files (.csv)',
      'JSON files (.json)',
      // 'Word documents (.docx) - Coming soon',
      // 'Excel spreadsheets (.xlsx, .xls) - Coming soon'
    ];
  }
}

export const fileUploadService = new FileUploadService(); 