import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Importe um arquivo CSS aqui se ele existir (ex: import './index.css';)
// Use a API de root moderna do React 18
const container = document.getElementById('root');
// Verifica se o container existe antes de criar o root
if (container) {
const root = ReactDOM.createRoot(container);
root.render(
// StrictMode é útil para detectar problemas potenciais no desenvolvimento
<React.StrictMode>
<App />
</React.StrictMode>
);
} else {
console.error("Erro: Elemento com id 'root' não encontrado no index.html.");
}
