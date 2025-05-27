import React, { useState } from 'react';
import { testConnectivity, type ConnectivityTestSuite, type ConnectivityTestResult } from '../utils/connectivityTest';
import { Button } from './ui/Button';

export const ConnectivityTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ConnectivityTestSuite | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      const testResults = await testConnectivity();
      setResults(testResults);
    } catch (error) {
      console.error('Test execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: ConnectivityTestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: ConnectivityTestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getOverallStatusColor = (overall: ConnectivityTestSuite['overall']) => {
    switch (overall) {
      case 'success': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'partial': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-white">
          🏦 Finance Bot API Connectivity Test
        </h1>
        <p className="text-gray-400">
          Test connectivity to all required APIs for the Finance Bot RAG system
        </p>
        
        <Button
          onClick={runTests}
          disabled={isRunning}
          className="px-8 py-3 text-lg"
        >
          {isRunning ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Running Tests...
            </>
          ) : (
            'Run Connectivity Tests'
          )}
        </Button>
      </div>

      {results && (
        <div className="space-y-6">
          {/* Overall Status */}
          <div className={`p-6 rounded-lg border ${getOverallStatusColor(results.overall)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Overall Status: {results.overall.toUpperCase()}
                </h2>
                <p className="text-sm opacity-80">
                  Test completed at {new Date(results.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="text-3xl">
                {results.overall === 'success' ? '✅' : 
                 results.overall === 'partial' ? '⚠️' : '❌'}
              </div>
            </div>
          </div>

          {/* Individual Test Results */}
          <div className="grid gap-4">
            {results.results.map((result, index) => (
              <div
                key={index}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">{getStatusIcon(result.status)}</span>
                      <h3 className="text-lg font-semibold text-white">
                        {result.service}
                      </h3>
                      {result.responseTime && (
                        <span className="text-sm text-gray-400">
                          ({result.responseTime}ms)
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm ${getStatusColor(result.status)} mb-3`}>
                      {result.message}
                    </p>

                    {result.details && (
                      <details className="text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-300 mb-2">
                          View Details
                        </summary>
                        <pre className="bg-gray-900 p-3 rounded overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">
              📋 Recommendations
            </h3>
            
            {results.overall === 'failed' && (
              <div className="text-red-400 mb-4">
                ❌ Critical issues found. Please fix the errors above before proceeding.
              </div>
            )}
            
            {results.overall === 'partial' && (
              <div className="text-yellow-400 mb-4">
                ⚠️ Some optional services unavailable. Core functionality should work.
              </div>
            )}
            
            {results.overall === 'success' && (
              <div className="text-green-400 mb-4">
                ✅ All systems operational. Ready for Finance Bot RAG processing!
              </div>
            )}

            <div className="space-y-2 text-sm text-gray-300">
              <h4 className="font-semibold text-white">🏦 Finance-specific features ready:</h4>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Earnings statement processing</li>
                <li>10-K/10-Q document analysis</li>
                <li>Financial metrics extraction</li>
                <li>Multi-dimensional financial RAG</li>
                <li>Balance sheet and income statement parsing</li>
                <li>Cash flow statement analysis</li>
              </ul>
            </div>
          </div>

          {/* Next Steps */}
          {results.overall === 'success' && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-400 mb-3">
                🚀 Next Steps
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <p>✅ All APIs are connected and working properly!</p>
                <p>You can now:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Upload financial documents (PDFs, Excel files, etc.)</li>
                  <li>Test the RAG pipeline with sample earnings statements</li>
                  <li>Set up the database schema in Supabase</li>
                  <li>Begin processing financial documents</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 