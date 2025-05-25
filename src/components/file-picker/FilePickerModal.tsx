import React, { useState } from 'react';
import { useFileStore } from '../../store/fileStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Folder, Clock, Users, Image as ImageIcon, FileText, Search, ListFilter, ArrowRight } from 'lucide-react';

// Mock data for files - in a real app, this would come from an API or state
const mockFiles = [
  { id: '1', type: 'pdf', name: 'Complete Return for KLO6734_pg27-29.pdf', size: '1.08 MB', modified: '20 minutes ago', modifiedBy: 'Chandler Klose' },
  { id: '2', type: 'pdf', name: 'ISO_2024_w2.pdf', size: '608 KB', modified: '3 days ago', modifiedBy: 'Chandler Klose' },
  { id: '3', type: 'pdf', name: 'ISO_Final_Pay - Dayforce.pdf', size: '206 KB', modified: '3 days ago', modifiedBy: 'Chandler Klose' },
  { id: '4', type: 'excel', name: 'master_all_transactions_2024_cleaned_edits.xlsx', size: '134 KB', modified: '24 minutes ago', modifiedBy: 'Chandler Klose' },
  { id: '5', type: 'csv', name: 'master_all_transactions_2024_cleaned_edits_expenses.csv', size: '39.6 KB', modified: '24 minutes ago', modifiedBy: 'Chandler Klose' },
  { id: '6', type: 'pdf', name: 'Unemployment_Insurance_Approval.pdf', size: '476 KB', modified: '3 days ago', modifiedBy: 'Chandler Klose' },
];

const FileTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  // Simple mapping, can be expanded
  if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (type === 'excel' || type === 'csv') return <ListFilter className="w-5 h-5 text-green-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
};

export const FilePickerModal: React.FC = () => {
  const { isFilePickerOpen, closeFilePicker } = useFileStore();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeSource, setActiveSource] = useState('My files');

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const sources = [
    { name: 'My files', icon: Folder },
    { name: 'Recent', icon: Clock },
    { name: 'Photos', icon: ImageIcon }, 
    { name: 'Shared', icon: Users },
  ];

  if (!isFilePickerOpen) return null;

  return (
    <Modal
      isOpen={isFilePickerOpen}
      onClose={closeFilePicker}
      title=""
      size="xl"
    >
      <div className="flex flex-col bg-zinc-850" style={{ height: '75vh' }}>
        <div className="px-6 py-4 border-b border-zinc-700">
          <h2 className="text-xl font-semibold text-white">Pick files</h2>
        </div>

        <div className="flex flex-1 min-h-0">
          <nav className="w-64 bg-zinc-900 p-4 border-r border-zinc-700 space-y-1 overflow-y-auto">
            {sources.map(source => (
              <button 
                key={source.name}
                onClick={() => setActiveSource(source.name)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                            ${activeSource === source.name 
                              ? 'bg-sky-600/30 text-sky-100' 
                              : 'text-zinc-300 hover:bg-zinc-700/50 hover:text-white'
                            }`}
              >
                <source.icon className={`w-5 h-5 ${activeSource === source.name ? 'text-sky-400' : 'text-zinc-400'}`} />
                <span>{source.name}</span>
              </button>
            ))}
          </nav>

          <main className="flex-1 flex flex-col bg-zinc-850 p-6 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-700">
              <div className="flex items-center text-sm text-zinc-400">
                <span>...</span>
                <ArrowRight size={14} className="mx-1.5 text-zinc-500" />
                <span>Carleton Financial Aid</span>
                <ArrowRight size={14} className="mx-1.5 text-zinc-500" />
                <span className="text-white font-medium">2025</span>
              </div>
              <div className="relative w-64">
                <input 
                  type="search"
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-2 rounded-md bg-zinc-700/50 border border-zinc-600 text-sm text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto -mx-6">
              <table className="min-w-full text-sm text-left">
                <thead className="sticky top-0 bg-zinc-850 z-10">
                  <tr className="border-b border-zinc-700">
                    <th className="w-10 px-6 py-3"></th>
                    <th className="px-6 py-3 font-medium text-zinc-300">Name</th>
                    <th className="px-6 py-3 font-medium text-zinc-300">Modified</th>
                    <th className="px-6 py-3 font-medium text-zinc-300">Modified by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/70">
                  {mockFiles.map(file => (
                    <tr 
                      key={file.id} 
                      onClick={() => toggleFileSelection(file.id)}
                      className={`cursor-pointer transition-colors 
                                 ${selectedFiles.includes(file.id) 
                                   ? 'bg-sky-600/20 hover:bg-sky-600/30' 
                                   : 'hover:bg-zinc-700/40'
                                 }`}
                    >
                      <td className="px-6 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedFiles.includes(file.id)}
                          readOnly
                          className="form-checkbox h-4 w-4 rounded bg-zinc-700 border-zinc-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 focus:ring-offset-zinc-850"
                        />
                      </td>
                      <td className="px-6 py-3 flex items-center space-x-2.5 text-white">
                        <FileTypeIcon type={file.type} />
                        <div>
                          <span>{file.name}</span>
                          <div className="text-xs text-zinc-400">{file.size}</div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-zinc-300">{file.modified}</td>
                      <td className="px-6 py-3 text-zinc-300">{file.modifiedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-zinc-700 flex justify-between items-center">
              <div className="text-sm text-zinc-400">
                {selectedFiles.length > 0 
                  ? `${selectedFiles.length} selected` 
                  : 'No files selected'
                }
              </div>
              <div className="flex space-x-3">
                <Button variant="secondary" onClick={closeFilePicker}>Cancel</Button>
                <Button 
                  variant="primary"
                  onClick={() => {
                    // Handle file selection logic - for now, just close
                    console.log('Selected files:', selectedFiles);
                    closeFilePicker();
                  }}
                  disabled={selectedFiles.length === 0}
                >
                  Select
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Modal>
  );
}; 