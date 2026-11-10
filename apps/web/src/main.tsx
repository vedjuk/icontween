import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPage } from './editor/EditorPage';
import { Landing } from './Landing';
import { PreparePage } from './prepare/PreparePage';
import { startPersistence } from './project/persistence';
import { RuntimePage } from './runtime/RuntimePage';
import './styles.css';

// A few pages don't need a router yet. Cloudflare and Vite both serve index.html for any path.
const pages: Record<string, () => React.JSX.Element> = {
  '/editor': EditorPage,
  '/prepare': PreparePage,
  '/runtime': RuntimePage,
};
const Page = pages[window.location.pathname.replace(/\/+$/, '')] ?? Landing;
const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  );

// Pages that work on the project wait for the saved copy, so nothing opens twice.
if (Page === EditorPage || Page === PreparePage) void startPersistence().finally(render);
else render();
