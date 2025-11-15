import React from 'react';
// IMPORTAÇÃO CORRIGIDA: Importando o componente por padrão (default import)
import AnonymousPartyGame from './AnonymousPartyGame.jsx'; 

// Este é o componente principal que o index.js renderiza.
// Ele é responsável por mostrar o jogo.
const App = () => {
  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <AnonymousPartyGame />
    </div>
  );
};
export default App;
