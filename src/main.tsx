import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppStateProvider } from './state/store';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Chybí kořenový element #root.');

createRoot(container).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
);
