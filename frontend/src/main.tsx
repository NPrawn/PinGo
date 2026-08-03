import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { exposeDevtools } from '@/app/devtools';
import { AppProvider } from '@/app/providers';
import '@/app/styles/globals.css';

// 개발 빌드에서만 콘솔에 `window.pingo`를 둔다. 배포 번들에는 들어가지 않는다.
exposeDevtools();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
