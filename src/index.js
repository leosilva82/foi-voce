import React from 'react';
import ReactDOM from 'react-dom/client';
// Se este arquivo existir, mantenha
// import './index.css';
import App from './App.jsx';
// Use a API de Root moderna do React 18: createRoot
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
<React.StrictMode>
<App />
</React.StrictMode>
);
