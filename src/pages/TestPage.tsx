import React from 'react';
import { ConnectivityTest } from '../components/ConnectivityTest';

export const TestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900">
      <ConnectivityTest />
    </div>
  );
}; 