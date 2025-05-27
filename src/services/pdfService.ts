import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use local worker to avoid CDN issues
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

export class PDFService {
  /**
   * Extract text from PDF file
   */
  async extractTextFromPDF(arrayBuffer: ArrayBuffer, filename: string = 'document.pdf'): Promise<string> {
    console.log(`📄 [PDFService] Starting PDF extraction for: ${filename} (${arrayBuffer.byteLength} bytes)`);
    
    try {
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0 // Reduce console noise
      });
      
      const pdf = await loadingTask.promise;
      console.log(`📄 [PDFService] PDF loaded successfully. Pages: ${pdf.numPages}`);
      
      const textContent: string[] = [];
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`📄 [PDFService] Processing page ${pageNum}/${pdf.numPages}`);
        
        const page = await pdf.getPage(pageNum);
        const textContentObj = await page.getTextContent();
        
        // Combine text items from the page
        const pageText = textContentObj.items
          .map((item: any) => {
            // Handle different text item types
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .join(' ')
          .trim();
        
        if (pageText) {
          textContent.push(`--- Page ${pageNum} ---`);
          textContent.push(pageText);
          textContent.push(''); // Add spacing between pages
        }
      }
      
      const extractedText = textContent.join('\n').trim();
      
      if (!extractedText) {
        throw new Error('No text content found in PDF. The PDF might be image-based or encrypted.');
      }
      
      console.log(`✅ [PDFService] Successfully extracted ${extractedText.length} characters from ${pdf.numPages} pages`);
      console.log(`📄 [PDFService] Preview: ${extractedText.substring(0, 200)}...`);
      
      return extractedText;
      
    } catch (error) {
      console.error('❌ [PDFService] PDF extraction failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('Invalid PDF file. Please ensure the file is not corrupted.');
        } else if (error.message.includes('password')) {
          throw new Error('Password-protected PDFs are not supported. Please provide an unprotected PDF.');
        } else {
          throw new Error(`PDF processing failed: ${error.message}`);
        }
      }
      
      throw new Error('Failed to extract text from PDF. Please try converting to text format.');
    }
  }

  /**
   * Check if a file is a PDF
   */
  isPDFFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Get PDF metadata (optional, for future use)
   */
  async getPDFMetadata(arrayBuffer: ArrayBuffer): Promise<any> {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const metadata = await pdf.getMetadata();
      
      return {
        numPages: pdf.numPages,
        title: (metadata.info as any)?.Title || 'Unknown',
        author: (metadata.info as any)?.Author || 'Unknown',
        subject: (metadata.info as any)?.Subject || 'Unknown',
        creator: (metadata.info as any)?.Creator || 'Unknown',
        producer: (metadata.info as any)?.Producer || 'Unknown',
        creationDate: (metadata.info as any)?.CreationDate || null,
        modificationDate: (metadata.info as any)?.ModDate || null
      };
    } catch (error) {
      console.error('Failed to extract PDF metadata:', error);
      return null;
    }
  }
}

export const pdfService = new PDFService(); 