import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initTheme } from './state/theme';
import './index.css';

initTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
