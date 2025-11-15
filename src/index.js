import React from 'react';
import ReactDOM from 'react-dom/client';
// A linha de importação do CSS é necessária para o build!
import './index.css'; 
import App from './App.jsx';
import { AnonymousPartyGame } from './AnonymousPartyGame.jsx'; 

// Use o componente principal App
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Nota: Se o seu App.jsx estiver vazio, o build pode falhar em uma etapa futura, mas o erro de CSS será resolvido.

