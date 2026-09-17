import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { DebugErrorBoundary } from './components/DebugErrorBoundary';
import { debugLogger } from './utils/debugLogger';
import './index.css';

// Initialize developer error interception immediately
debugLogger.init();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DebugErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </DebugErrorBoundary>
  </React.StrictMode>
);
