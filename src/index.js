import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; 

// IMPORTAÇÃO CORRIGIDA: Cada módulo em sua própria linha
import App from './App.jsx';
import { AnonymousPartyGame } from './AnonymousPartyGame.jsx'; 

// Use o componente principal App (que provavelmente usa AnonymousPartyGame dentro dele)
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Alternativamente, se você quiser renderizar AnonymousPartyGame diretamente:
/*
root.render(
  <React.StrictMode>
    <AnonymousPartyGame />
  </React.StrictMode>
);
*/

