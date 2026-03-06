import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './i18n/config';
import { ThemeProvider } from './contexts/ThemeContext';
import { ModelConfigProvider } from './contexts/ModelConfigContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { ChatProvider } from './contexts/ChatContext';
import { DocumentsProvider } from './contexts/DocumentsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ModelConfigProvider>
          <DocumentsProvider>
            <ChatProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </ChatProvider>
          </DocumentsProvider>
        </ModelConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
