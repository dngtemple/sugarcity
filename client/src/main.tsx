import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { registerServiceWorker } from './lib/install';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      containerStyle={{ top: 80, zIndex: 90 }}
      containerClassName="sc-toaster"
      toastOptions={{
        duration: 2600,
        ariaProps: { role: 'status', 'aria-live': 'polite' },
        style: {
          fontFamily: 'Outfit, system-ui, sans-serif',
          fontSize: '15px',
          fontWeight: 500,
          color: 'rgb(255 255 255)',
          background: 'rgb(46 5 38)',
          borderRadius: '999px',
          padding: '10px 18px',
          boxShadow: '0 24px 60px -18px rgb(94 14 78 / 0.45)',
        },
        success: { iconTheme: { primary: 'rgb(247 203 168)', secondary: 'rgb(46 5 38)' } },
      }}
    />
  </StrictMode>
);
