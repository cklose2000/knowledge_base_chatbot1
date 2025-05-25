import React from 'react';
import { HardDrive, Cloud, Package, Share, Server } from 'lucide-react';
import { useFileStore } from '../../store/fileStore';

const iconMap = {
  HardDrive,
  Cloud,
  Package,
  Share,
  Server,
};

export const ConnectorGrid: React.FC = () => {
  const { connectors } = useFileStore();

  const handleConnectorClick = (connectorId: string) => {
    // For POC, all connectors open the local file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        // Simulate file selection from the chosen connector
        console.log(`Selected ${files.length} files from ${connectorId}`);
        // In a real app, this would handle the specific connector logic
      }
    };
    
    input.click();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {connectors.map((connector) => {
        const IconComponent = iconMap[connector.icon as keyof typeof iconMap] || HardDrive;
        
        return (
          <button
            key={connector.id}
            onClick={() => handleConnectorClick(connector.id)}
            disabled={!connector.isAvailable}
            className={`
              p-6 rounded-lg border-2 border-dashed transition-all
              ${connector.isAvailable
                ? 'border-zinc-600 hover:border-blue-500 hover:bg-zinc-800 cursor-pointer'
                : 'border-zinc-700 opacity-50 cursor-not-allowed'
              }
            `}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <IconComponent 
                size={32} 
                className={connector.isAvailable ? 'text-blue-400' : 'text-gray-500'} 
              />
              <div>
                <h3 className="font-medium text-white text-sm">{connector.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{connector.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}; 