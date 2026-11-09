import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import { PreparePage } from './prepare/PreparePage';
import './styles.css';

// Two pages don't need a router yet. Cloudflare and Vite both serve index.html for /prepare.
const page =
  window.location.pathname.replace(/\/+$/, '') === '/prepare' ? <PreparePage /> : <Landing />;

createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>);
