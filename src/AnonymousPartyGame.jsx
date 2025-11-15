import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Loader2, Zap, Users, MessageSquare, CheckCheck } from 'lucide-react';
// --- CONFIGURAÇÃO E VARIÁVEIS DO AMBIENTE ---
const { __app_id, __firebase_config, __initial_auth_token } = window;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// Caminhos de coleções (Obrigatório para o Firestore)
const getPublicCollectionRef = (db, collectionName) =>
collection(db, '/artifacts/' + appId + '/public/data/' + collectionName);
// --- COMPONENTE PRINCIPAL ---
export const AnonymousPartyGame = () => {
// --- HOOKS DE ESTADO ---
const [db, setDb] = useState(null);
// RE-ADICIONADO: O estado 'auth' é necessário para definir 'setAuth'.
const [auth, setAuth] = useState(null);
const [userId, setUserId] = useState(null);
const [isAuthReady, setIsAuthReady] = useState(false);
const [roomId, setRoomId] = useState('');
const [isHost, setIsHost] = useState(false);
const [isJoining, setIsJoining] = useState(false);
const [error, setError] = useState('');
const [lobbyIdInput, setLobbyIdInput] = useState('');
const [players, setPlayers] = useState([]);
const [gameState, setGameState] = useState(null);
const [myPrompt, setMyPrompt] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [myAnswer, setMyAnswer] = useState('');
// Define o estado inicial do jogo (estrutura)
const initialGameState = useMemo(() => ({
status: 'LOBBY', // Estados: 'LOBBY' | 'WAITING_PROMPTS' | 'WAITING_GUESSES' | 'REVEALING' | 'FINISHED'
hostId: '',
currentPrompt: '',
round: 0,
maxRounds: 3,
prompts: [],
answers: {},
guesses: {},
scores: {},
correctAnswerId: null,
}), []);
// --- FUNÇÕES DE SETUP (Inicialização do Firebase e Autenticação) ---
useEffect(() => {
try {
const app = initializeApp(firebaseConfig);
const dbInstance = getFirestore(app);
const authInstance = getAuth(app);
  setDb(dbInstance);
  setAuth(authInstance); // Agora setAuth está definido

  const handleAuth = async (user) => {
    if (user) {
      setUserId(user.uid);
      setIsAuthReady(true);
    } else {
      try {
        // Se não houver token, faz login anônimo
        await signInAnonymously(authInstance);
      } catch (e) {
        console.error("Erro ao fazer login anônimo:", e);
        setError("Falha na autenticação. Recarregue.");
        setIsAuthReady(true);
      }
    }
  };

  // Tenta login com token inicial ou anônimo
  if (initialAuthToken) {
    signInWithCustomToken(authInstance, initialAuthToken).then((userCredential) => {
      handleAuth(userCredential.user);
    }).catch(() => {
      console.log("Token inválido, tentando login anônimo.");
      signInAnonymously(authInstance).then((userCredential) => {
        handleAuth(userCredential.user);
      });
    });
  } else {
    // Observa mudanças no estado de autenticação
    const unsubscribe = onAuthStateChanged(authInstance, handleAuth);
    return () => unsubscribe();
  }

} catch (e) {
  console.error("Erro ao inicializar Firebase:", e);
  setError("Erro ao inicializar o serviço Firebase. Verifique a configuração.");
}
// SetAuth é uma função de dispatch de estado do React, mas é estável. Incluímos setAuth e setDb por boa prática.
return () => {
    // Cleanup function for onAuthStateChanged is already handled above in the else block
    // No need for a global unsubscribe here since onAuthStateChanged is handled.
};

}, [setAuth, setDb]); // setAuth e setDb são funções estáveis e seguras de incluir
// --- LISTENERS (Sincronização em Tempo Real) ---
// 1. Listener do Jogo (gameState)
useEffect(() => {
if (!db || !userId || !roomId || !isAuthReady) return;
const gameDocRef = doc(getPublicCollectionRef(db, 'games'), roomId);

const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
  if (docSnap.exists()) {
    const data = docSnap.data();
    setGameState(data.state);
    setIsHost(data.hostId === userId);
  } else {
    setGameState(initialGameState); // Reseta se o documento sumir
    setError("Lobby não encontrado ou foi encerrado.");
    setRoomId('');
  }
}, (e) => {
  console.error("Erro no snapshot do jogo:", e);
  setError("Erro de conexão com o jogo.");
});

return () => unsubscribe();

}, [db, userId, roomId, isAuthReady, initialGameState, getPublicCollectionRef]);
// 2. Listener dos Jogadores (players)
useEffect(() => {
if (!db || !roomId || !isAuthReady) return;
const playersColRef = getPublicCollectionRef(db, `games/${roomId}/players`);
const q = query(playersColRef);

const unsubscribe = onSnapshot(q, (snapshot) => {
  const playerList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  setPlayers(playerList);
});

return () => unsubscribe();

}, [db, roomId, isAuthReady, getPublicCollectionRef]);
// --- MÉTODOS DE AÇÃO ---
// Cria um novo lobby
const handleCreateLobby = useCallback(async () => {
if (!db || !userId) return;
setIsSubmitting(true);
setError('');
try {
  const roomID = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newGameState = { ...initialGameState, hostId: userId, status: 'LOBBY' };

  // 1. Cria o documento principal do jogo
  const gameDocRef = doc(getPublicCollectionRef(db, 'games'), roomID);
  await setDoc(gameDocRef, { hostId: userId, state: newGameState, createdAt: new Date() });

  // 2. Adiciona o host como primeiro jogador
  const playerDocRef = doc(getPublicCollectionRef(db, `games/${roomID}/players`), userId);
  await setDoc(playerDocRef, { name: `Host-${userId.substring(0, 4)}`, joinedAt: new Date() });

  setRoomId(roomID);
  setIsHost(true);
  setLobbyIdInput('');
} catch (e) {
  console.error("Erro ao criar lobby:", e);
  setError("Falha ao criar o lobby. Tente novamente.");
} finally {
  setIsSubmitting(false);
}

}, [db, userId, initialGameState, getPublicCollectionRef]);
// Entra em um lobby existente
const handleJoinLobby = useCallback(async (id) => {
if (!db || !userId || !id) return;
setIsSubmitting(true);
setError('');
setIsJoining(true);
try {
  const roomID = id.toUpperCase();
  const gameDocRef = doc(getPublicCollectionRef(db, 'games'), roomID);
  const docSnap = await getDoc(gameDocRef);

  if (!docSnap.exists()) {
    setError("Lobby não encontrado. Verifique o código.");
    return;
  }

  // 1. Adiciona o jogador
  const playerDocRef = doc(getPublicCollectionRef(db, `games/${roomID}/players`), userId);
  await setDoc(playerDocRef, { name: `Player-${userId.substring(0, 4)}`, joinedAt: new Date() });

  setRoomId(roomID);
  setIsHost(docSnap.data().hostId === userId);
  setLobbyIdInput('');

} catch (e) {
  console.error("Erro ao entrar no lobby:", e);
  setError("Falha ao entrar no lobby.");
} finally {
  setIsSubmitting(false);
  setIsJoining(false);
}

}, [db, userId, getPublicCollectionRef]);
// Inicia o jogo (apenas Host)
const handleStartGame = useCallback(async () => {
if (!db || !isHost || !roomId) return;
setIsSubmitting(true);
try {
  const gameDocRef = doc(getPublicCollectionRef(db, 'games'), roomId);
  // O host decide o prompt inicial ou passa para a fase de coleta de prompts
  const updatedState = {
    ...gameState,
    status: 'WAITING_PROMPTS',
    round: 1,
    prompts: [], // Limpa prompts anteriores
    answers: {},
    guesses: {},
    scores: players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {}),
    correctAnswerId: null,
  };
  await updateDoc(gameDocRef, { state: updatedState });
} catch (e) {
  console.error("Erro ao iniciar jogo:", e);
  setError("Falha ao iniciar jogo.");
} finally {
  setIsSubmitting(false);
}

}, [db, isHost, roomId, gameState, players, getPublicCollectionRef]);
// Submete o prompt (fase WAITING_PROMPTS)
const handleSubmitPrompt = useCallback(async () => {
if (!db || !roomId || !myPrompt || myAnswer === undefined) return;
setIsSubmitting(true);
try {
  const gameDocRef = doc(getPublicCollectionRef(db, 'games'), roomId);
  
  const newPromptEntry = {
      text: myPrompt,
      userId: userId,
      answer: myAnswer
  };
  
  // Atualiza o estado do jogo com o novo prompt
  await updateDoc(gameDocRef, {
    'state.prompts': [...gameState.prompts, newPromptEntry],
  });

  setMyPrompt('');
  setMyAnswer('');

} catch (e) {
  console.error("Erro ao submeter prompt:", e);
  setError("Falha ao enviar o prompt.");
} finally {
  setIsSubmitting(false);
}

}, [db, roomId, myPrompt, myAnswer, userId, gameState, getPublicCollectionRef]);
// --- RENDERIZAÇÃO DE ESTADO ---
if (!isAuthReady) {
return (
<div className="flex flex-col items-center justify-center h-screen text-gray-700 bg-gray-50">
<Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
<p className="mt-4 font-semibold">Conectando ao servidor...</p>
</div>
);
}
// Se não estiver em um lobby
if (!roomId) {
return (
<div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-2xl space-y-4 m-8 border border-indigo-200">
<h1 className="text-2xl font-extrabold text-center text-indigo-600">Foi Você? (Party Game)</h1>
    {error && <p className="text-red-500 text-sm text-center font-medium p-2 bg-red-50 rounded-lg">{error}</p>}

    <div className="space-y-4">
      <input
        type="text"
        placeholder="Código do Lobby"
        value={lobbyIdInput}
        onChange={(e) => setLobbyIdInput(e.target.value.toUpperCase().trim())}
        className="w-full p-3 border border-indigo-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-center uppercase font-bold tracking-widest"
        maxLength={4}
      />
      <button
        onClick={() => handleJoinLobby(lobbyIdInput)}
        disabled={lobbyIdInput.length !== 4 || isSubmitting}
        className="w-full bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-indigo-600 transition duration-150 disabled:bg-indigo-300 flex items-center justify-center"
      >
        {isJoining ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
        {isJoining ? 'Entrando...' : 'Entrar no Lobby'}
      </button>
    </div>

    <div className="relative flex items-center justify-center py-2">
      <div className="w-full border-t border-gray-200"></div>
      <span className="absolute bg-white px-3 text-gray-500 text-sm font-medium">OU</span>
    </div>

    <button
      onClick={handleCreateLobby}
      disabled={isSubmitting}
      className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-green-600 transition duration-150 disabled:bg-green-300 flex items-center justify-center"
    >
      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Users className="w-5 h-5 mr-2" />}
      {isSubmitting ? 'Criando...' : 'Criar Novo Lobby'}
    </button>
    <p className="text-xs text-gray-400 text-center break-all pt-2">Seu ID de Usuário: {userId}</p>
  </div>
);

}
// --- VISÃO DO JOGO (Dentro de um Lobby) ---
const headerClasses = "text-center text-white p-3 rounded-t-xl font-extrabold flex justify-between items-center";
const contentClasses = "p-4 bg-white rounded-b-xl shadow-inner";
// Retorna o componente principal com o jogo
return (
<div className="max-w-xl w-full mx-auto my-4">
<div className="bg-indigo-700 rounded-xl shadow-2xl">
<header className={headerClasses}>
<h2 className="text-xl">SALA: {roomId}</h2>
<div className="text-sm bg-indigo-800 px-3 py-1 rounded-full">{isHost ? 'Host' : 'Jogador'}</div>
</header>
    {/* Informações dos Jogadores */}
    <div className={contentClasses}>
      <h3 className="text-lg font-bold mb-2 flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-500" /> Jogadores ({players.length})</h3>
      <ul className="grid grid-cols-2 gap-2 text-sm">
        {players.map(p => (
          <li key={p.id} className={`p-2 rounded-lg ${p.id === gameState?.hostId ? 'bg-yellow-100 font-bold border-2 border-yellow-400' : 'bg-gray-100'}`}>
            {p.name} {p.id === userId && '(Você)'}
          </li>
        ))}
      </ul>
    </div>
    
    {/* Renderiza a tela baseada no Status do Jogo */}
    {gameState && (
      <div className="mt-4 bg-white rounded-b-xl shadow-lg">
        
        {/* ESTADO: LOBBY */}
        {gameState.status === 'LOBBY' && (
          <div className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center text-gray-800">Aguardando Início do Jogo...</h3>
            <p className="text-center text-sm text-gray-600">O Host ({players.find(p => p.id === gameState.hostId)?.name || '...'}) deve iniciar o jogo.</p>
            {isHost && players.length >= 2 ? (
              <button
                onClick={handleStartGame}
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-green-700 transition disabled:bg-green-300"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
                Iniciar Rodada 1
              </button>
            ) : isHost ? (
              <p className="text-center text-red-500 font-semibold">Mínimo de 2 jogadores para iniciar.</p>
            ) : null}
          </div>
        )}

        {/* ESTADO: WAITING_PROMPTS (Coleta de Perguntas) */}
        {gameState.status === 'WAITING_PROMPTS' && (
          <div className="p-6 space-y-4">
            <h3 className="text-xl font-bold text-center text-indigo-600">Rodada {gameState.round}: Envie um Prompt</h3>
            
            {gameState.prompts.some(p => p.userId === userId) ? (
                <p className="text-center text-green-600 font-semibold flex items-center justify-center">
                    <CheckCheck className="w-5 h-5 mr-1"/> Seu prompt e resposta foram enviados. Aguarde os outros jogadores.
                </p>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Pense em uma pergunta engraçada, estranha ou pessoal. Você fornecerá a resposta verdadeira para ela.</p>
                    <input
                        type="text"
                        placeholder="Seu Prompt (Pergunta)"
                        value={myPrompt}
                        onChange={(e) => setMyPrompt(e.target.value)}
                        className="w-full p-3 border border-indigo-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <input
                        type="text"
                        placeholder="Sua Resposta Verdadeira"
                        value={myAnswer}
                        onChange={(e) => setMyAnswer(e.target.value)}
                        className="w-full p-3 border border-indigo-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                        onClick={handleSubmitPrompt}
                        disabled={!myPrompt || !myAnswer || isSubmitting}
                        className="w-full bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-md hover:bg-indigo-600 transition disabled:bg-indigo-300"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <MessageSquare className="w-5 h-5 mr-2" />}
                        Enviar Prompt
                    </button>
                </div>
            )}
            
            <p className="text-sm text-gray-500 text-center mt-4">Prompts Recebidos: {gameState.prompts.length} de {players.length}</p>
            {/* Lógica do Host para Próxima Fase (Não implementada completamente aqui, mas o Host faria a transição) */}
            {isHost && gameState.prompts.length === players.length && (
                <p className="text-center text-gray-700 font-semibold pt-2">O Host pode avançar o jogo agora (funcionalidade de Host avançar não totalmente implementada neste esboço).</p>
            )}

          </div>
        )}
        
        {/* Você pode adicionar outros status (WAITING_GUESSES, REVEALING, FINISHED) aqui. */}

      </div>
    )}
  </div>
</div>

);
};
