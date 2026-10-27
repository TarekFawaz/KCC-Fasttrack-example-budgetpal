import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './kernel/Shell';
import { queryClient } from './kernel/queryClient';
import { features } from './kernel/registry';
import './kernel/shell.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Shell features={features} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
