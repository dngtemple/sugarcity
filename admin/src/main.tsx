import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { registerServiceWorker } from './lib/install';
import { App } from './App';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      // The class keeps dialogs open when a toast (and its Undo) is clicked.
      containerClassName="app-toaster"
      containerStyle={{ top: 76 }}
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'Outfit, system-ui, sans-serif',
          fontSize: '15px',
          color: 'rgb(43 14 37)',
          background: '#fff',
          borderRadius: '999px',
          padding: '10px 16px',
          maxWidth: '440px',
          boxShadow: '0 24px 60px -18px rgb(94 14 78 / 0.35), 0 4px 12px rgb(94 14 78 / 0.08)',
        },
        success: { iconTheme: { primary: 'rgb(13 128 98)', secondary: '#fff' } },
        error: { iconTheme: { primary: 'rgb(200 30 58)', secondary: '#fff' } },
      }}
    />
  </StrictMode>
);
