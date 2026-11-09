import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import { PreparePage } from './prepare/PreparePage';
import { RuntimePage } from './runtime/RuntimePage';
import './styles.css';

// A few pages don't need a router yet. Cloudflare and Vite both serve index.html for any path.
const pages: Record<string, () => React.JSX.Element> = {
  '/prepare': PreparePage,
  '/runtime': RuntimePage,
};
const Page = pages[window.location.pathname.replace(/\/+$/, '')] ?? Landing;
const page = <Page />;

createRoot(document.getElementById('root')!).render(<StrictMode>{page}</StrictMode>);
