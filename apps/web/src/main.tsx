import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PublicDesk } from './PublicDesk';
import './style.css';

createRoot(document.getElementById('root')!).render(<StrictMode>{location.pathname === '/mesa' || location.pathname.startsWith('/mesa/') ? <PublicDesk /> : <App />}</StrictMode>);
