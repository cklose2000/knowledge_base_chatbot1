import { create } from 'zustand';
import type { FileConnector, UploadProgress } from '../types';

interface FileState {
  selectedFiles: File[];
  uploadProgress: UploadProgress[];
  isUploading: boolean;
  isFilePickerOpen: boolean;
  connectors: FileConnector[];
  
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  setUploadProgress: (fileId: string, progress: number) => void;
  startUpload: (files: File[]) => Promise<void>;
  openFilePicker: () => void;
  closeFilePicker: () => void;
}

const defaultConnectors: FileConnector[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: 'Cloud',
    description: 'Connect to Google Drive',
    isAvailable: true,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    icon: 'Cloud',
    description: 'Connect to Microsoft OneDrive (work/school)',
    isAvailable: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'Cloud',
    description: 'Connect to Dropbox',
    isAvailable: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: 'Zap',
    description: 'Connect to Salesforce',
    isAvailable: true,
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    icon: 'Share',
    description: 'Connect to SharePoint',
    isAvailable: true,
  },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useFileStore = create<FileState>((set, get) => ({
  selectedFiles: [],
  uploadProgress: [],
  isUploading: false,
  isFilePickerOpen: false,
  connectors: defaultConnectors,
  
  addFiles: (files) => {
    set((state) => ({
      selectedFiles: [...state.selectedFiles, ...files],
    }));
  },
  
  removeFile: (fileName) => {
    set((state) => ({
      selectedFiles: state.selectedFiles.filter(file => file.name !== fileName),
      uploadProgress: state.uploadProgress.filter(p => p.fileName !== fileName),
    }));
  },
  
  clearFiles: () => {
    set({
      selectedFiles: [],
      uploadProgress: [],
    });
  },
  
  setUploadProgress: (fileId, progress) => {
    set((state) => ({
      uploadProgress: state.uploadProgress.map(p =>
        p.fileId === fileId ? { ...p, progress, isComplete: progress === 100 } : p
      ),
    }));
  },
  
  startUpload: async (files) => {
    const { setUploadProgress } = get();
    
    set({ isUploading: true });
    
    // Initialize progress for all files
    const progressEntries: UploadProgress[] = files.map(file => ({
      fileId: generateId(),
      fileName: file.name,
      progress: 0,
      isComplete: false,
    }));
    
    set({ uploadProgress: progressEntries });
    
    // Simulate upload progress for each file
    for (const entry of progressEntries) {
      const uploadInterval = setInterval(() => {
        const currentProgress = get().uploadProgress.find(p => p.fileId === entry.fileId)?.progress || 0;
        
        if (currentProgress >= 100) {
          clearInterval(uploadInterval);
          return;
        }
        
        const increment = Math.random() * 20 + 5; // Random increment between 5-25%
        const newProgress = Math.min(currentProgress + increment, 100);
        
        setUploadProgress(entry.fileId, newProgress);
      }, 200);
      
      // Clean up interval after 2 seconds (simulated upload time)
      setTimeout(() => {
        clearInterval(uploadInterval);
        setUploadProgress(entry.fileId, 100);
      }, 2000);
    }
    
    // Complete upload after 2.5 seconds
    setTimeout(() => {
      set({ isUploading: false });
    }, 2500);
  },
  
  openFilePicker: () => {
    set({ isFilePickerOpen: true });
  },
  
  closeFilePicker: () => {
    set({ isFilePickerOpen: false });
  },
})); 