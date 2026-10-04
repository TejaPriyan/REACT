import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason && e.reason.stack || e.reason)));

createRoot(document.getElementById('root')).render(<App />);
