import App from 'App';
import { createRoot } from 'react-dom/client';
import * as serviceWorker from './serviceWorker';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Root container not found');
}

// Register the service worker only in production
if (import.meta.env.VITE_NODE_ENV === 'production') {
  serviceWorker.register();
} else {
  serviceWorker.unregister();
}
