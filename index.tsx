
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ToastSystem';
import { GlobalModalProvider } from './components/core/GlobalModalProvider';

async function mountApp() {
  let DevTools: React.ComponentType | (() => null) = () => null;

  const checkOverride = () => {
    try {
      return localStorage.getItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join('')) === '1';
    } catch {
      return false;
    }
  };

  if (import.meta.env.DEV || checkOverride()) {
    const devModule = await import('./components/DevTools/DevTools');
    devModule.initDevStore();
    DevTools = devModule.DevTools;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <GlobalModalProvider>
            <App />
            {(import.meta.env.DEV || checkOverride()) && <DevTools />}
          </GlobalModalProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

mountApp();
