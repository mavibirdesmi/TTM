import React, { useState } from 'react';
import './ApiConfig.css';

function ApiConfig({ currentUrl, onUrlChange, onClose }) {
  const [url, setUrl] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const testUrl = url.endsWith('/api') ? url : `${url}/api`;
      const response = await fetch(`${testUrl.replace('/api', '')}/`);
      const data = await response.json();
      
      if (data.message) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: 'Unexpected response from server' });
      }
    } catch (error) {
      setTestResult({ success: false, message: `Failed to connect: ${error.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onUrlChange(url);
    onClose();
  };

  const presets = [
    { name: 'Local (Default)', url: 'http://localhost:8000' },
    { name: 'Local IP', url: 'http://127.0.0.1:8000' },
  ];

  return (
    <div className="api-config-overlay" onClick={onClose}>
      <div className="api-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="api-config-header">
          <h2>API Configuration</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="api-config-content">
          <div className="form-group">
            <label>Backend API URL:</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="url-input"
            />
            <small className="hint">
              Enter the base URL of your FastAPI backend (without /api)
            </small>
          </div>

          <div className="presets">
            <label>Quick Presets:</label>
            <div className="preset-buttons">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="preset-btn"
                  onClick={() => setUrl(preset.url)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="test-section">
            <button 
              className="test-btn" 
              onClick={handleTest}
              disabled={testing || !url}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            
            {testResult && (
              <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                {testResult.success ? '✓' : '✗'} {testResult.message}
              </div>
            )}
          </div>

          <div className="current-url">
            <strong>Current:</strong> {currentUrl}
          </div>
        </div>

        <div className="api-config-footer">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave}>
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApiConfig;
