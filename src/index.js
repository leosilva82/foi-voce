import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Se este arquivo existir, mantenha
import App from './App'; // Importando o App.jsx

// Use a API de root moderna do React 18
const root = ReactDOM.createRoot(document.getElementById('root'));

// A linha 7 é o início do 'root.render' ou 'ReactDOM.createRoot'
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Se você não usa createRoot, o erro pode estar aqui:
// Se estiver usando uma versão antiga:
/*
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
*/

