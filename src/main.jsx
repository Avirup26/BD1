import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import './styles.css';

// NOTE: StrictMode is intentionally NOT used — it double-invokes effects in dev,
// which would create two WebGL contexts / two game instances.
createRoot(document.getElementById('root')).render(<App />);
