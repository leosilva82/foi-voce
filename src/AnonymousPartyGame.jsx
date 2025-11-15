import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import {
getFirestore, collection, doc, onSnapshot,
setDoc, addDoc, updateDoc, deleteDoc, query
} from 'firebase/firestore';
import { Loader2, Zap, Users, Send, Smile, Info } from 'lucide-react';
// === 1. CONFIGURAÇÃO DE AMBIENTE DO CANVAS (CRÍTICO) ===
// O app ID é obrigatório para construir os caminhos do Firestore.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// --- Estrutura de dados ---
const COL_PLAYERS = /artifacts/${appId}/public/data/players;
const COL_MESSAGES = /artifacts/${appId}/public/data/messages;
// Status do jogo
const GAME_STATUS = {
LOADING: 'LOADING',
JOINING: 'JOINING',
WAITING_FOR_QUESTION: 'WAITING_FOR_QUESTION',
VOTING: 'VOTING',
RESULTS: 'RESULTS',
ERROR: 'ERROR'
};
// Componente principal do jogo
export const AnonymousPartyGame = () => {
// === ESTADO DE INICIALIZAÇÃO E AUTENTICAÇÃO ===
const [db, setDb] = useState(null);
const [auth, setAuth] = useState(null);
const [userId, setUserId] = useState(null);
const [status, setStatus] = useState(GAME_STATUS.LOADING);
const [username, setUsername] = useState('');
// === ESTADO DO JOGO ===
const [players, setPlayers] = useState([]);
const [messages, setMessages] = useState([]);
const [currentQuestion, setCurrentQuestion] = useState('Quem é o mais engraçado da festa?'); // Mock de pergunta
const [voteTargetId, setVoteTargetId] = useState(null);

// === LÓGICA DE FIREBASE E AUTENTICAÇÃO (CORREÇÃO DE "CARREGANDO") ===
useEffect(() => {
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
        console.error("Configuração do Firebase não encontrada.");
        setStatus(GAME_STATUS.ERROR);
        return;
    }

    const app = initializeApp(firebaseConfig);
    const firestoreDb = getFirestore(app);
    const firebaseAuth = getAuth(app);
    
    setDb(firestoreDb);
    setAuth(firebaseAuth);

    const authenticate = async () => {
        try {
            if (initialAuthToken) {
                await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
                await signInAnonymously(firebaseAuth);
            }
            
            const user = firebaseAuth.currentUser;
            // Gera um ID de usuário anônimo ou usa o UID fornecido
            const uid = user?.uid || crypto.randomUUID(); 
            setUserId(uid);
            
            // Mude o status APÓS a autenticação bem-sucedida
            setStatus(GAME_STATUS.JOINING); 

        } catch (error) {
            console.error("Erro na inicialização/autenticação do Firebase:", error);
            setStatus(GAME_STATUS.ERROR);
        }
    };

    authenticate();
}, []);

// === LÓGICA DE ENTRADA DO JOGO E DATASCRIPTIONS ===

// 1. Inscrição em jogadores (Real-time update)
useEffect(() => {
    if (!db || status === GAME_STATUS.LOADING || status === GAME_STATUS.ERROR) return;

    const playersQuery = query(collection(db, COL_PLAYERS));
    const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
        const playerList = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        setPlayers(playerList);
    }, (error) => {
        console.error("Erro ao carregar jogadores:", error);
    });

    return () => unsubscribe();
}, [db, status]);

// 2. Inscrição em mensagens (Real-time update)
useEffect(() => {
    if (!db || status === GAME_STATUS.LOADING || status === GAME_STATUS.ERROR) return;

    const messagesQuery = query(collection(db, COL_MESSAGES));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messageList = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        setMessages(messageList);
    }, (error) => {
        console.error("Erro ao carregar mensagens:", error);
    });

    return () => unsubscribe();
}, [db, status]);


// Adiciona o jogador ao Firestore
const handleJoinGame = useCallback(async () => {
    if (!db || !userId || username.trim() === '') return;

    try {
        const playerRef = doc(db, COL_PLAYERS, userId);
        await setDoc(playerRef, {
            username: username,
            joinedAt: new Date(),
            isHost: players.length === 0, // O primeiro a entrar é o host
            vote: null,
            isAnonymous: true // Característica do jogo
        });
        setStatus(GAME_STATUS.WAITING_FOR_QUESTION);
        console.log("Jogador entrou:", username);
    } catch (e) {
        console.error("Erro ao entrar no jogo:", e);
    }
}, [db, userId, username, players.length]);

// Função de votação (mock)
const handleVote = useCallback(async () => {
    if (!db || !userId || !voteTargetId) return;

    try {
        const playerRef = doc(db, COL_PLAYERS, userId);
        await updateDoc(playerRef, { vote: voteTargetId, votedAt: new Date() });
        setStatus(GAME_STATUS.VOTING); // Permanece em voting para mostrar que votou
        console.log(`Usuário ${userId} votou em ${voteTargetId}`);
    } catch (e) {
        console.error("Erro ao votar:", e);
    }
}, [db, userId, voteTargetId]);

// Contagem dos votos para a tela de resultados (mock)
const voteCounts = useMemo(() => {
    if (status !== GAME_STATUS.RESULTS) return {};
    const counts = {};
    players.forEach(p => {
        if (p.vote) {
            counts[p.vote] = (counts[p.vote] || 0) + 1;
        }
    });
    return counts;
}, [players, status]);

// Função para enviar mensagem (Chat Anônimo)
const handleSendMessage = async (e) => {
    e.preventDefault();
    const input = e.target.elements.messageInput;
    const text = input.value.trim();
    
    if (!db || !userId || text === '') return;

    try {
        // O nome do usuário é o nome que ele escolheu, mas o chat é anônimo.
        const userPlayer = players.find(p => p.id === userId);

        await addDoc(collection(db, COL_MESSAGES), {
            senderId: userId, // ID real para rastreamento interno
            senderName: userPlayer ? userPlayer.username : 'Anônimo', // Nome para exibição (se quiser)
            text: text,
            timestamp: new Date()
        });
        input.value = ''; // Limpa o input
    } catch (e) {
        console.error("Erro ao enviar mensagem:", e);
    }
};

// --- RENDERIZAÇÃO DA TELA DE CARREGAMENTO/ERRO ---

// 1. Tela de Carregamento (Sai após autenticação bem-sucedida)
if (status === GAME_STATUS.LOADING) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
            <p className="mt-4 text-lg">Iniciando a Conexão com o Servidor...</p>
            <p className="mt-2 text-sm text-gray-400">Isso deve levar apenas alguns segundos.</p>
        </div>
    );
}

// 2. Tela de Erro
if (status === GAME_STATUS.ERROR) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-800 text-white p-6 rounded-xl shadow-2xl">
            <Info className="w-10 h-10 mb-4" />
            <h1 className="text-2xl font-bold">ERRO FATAL DE CONEXÃO</h1>
            <p className="mt-2 text-center">Não foi possível conectar ao Firebase. Verifique a configuração ou tente novamente.</p>
            <p className="mt-4 text-xs">ID do Aplicativo: {appId}</p>
        </div>
    );
}

// --- RENDERIZAÇÃO DA TELA DE ENTRADA ---
if (status === GAME_STATUS.JOINING) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <h1 className="text-3xl font-extrabold text-purple-400 mb-6 flex items-center">
                    <Zap className="mr-2" /> Foi Você?
                </h1>
                <p className="mb-6 text-gray-300">Digite seu nome para entrar na festa anônima.</p>
                <input
                    type="text"
                    placeholder="Seu Nome/Nickname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 mb-4 rounded-lg bg-gray-700 text-white border border-purple-500 focus:border-purple-300 focus:ring focus:ring-purple-300 transition"
                    required
                />
                <button
                    onClick={handleJoinGame}
                    disabled={username.trim() === ''}
                    className="w-full p-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-lg transition duration-300 disabled:opacity-50"
                >
                    Entrar no Jogo
                </button>
                <p className="mt-4 text-sm text-gray-400 text-center">Seu ID (para testes): {userId}</p>
            </div>
        </div>
    );
}

// --- RENDERIZAÇÃO DA INTERFACE DO JOGO (Visão Geral) ---
// Este é um mock simples da interface após o login
const userPlayer = players.find(p => p.id === userId);
const hasVoted = userPlayer?.vote !== null;

return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
        <header className="flex justify-between items-center pb-6 border-b border-gray-700 mb-6">
            <h1 className="text-4xl font-extrabold text-purple-400 flex items-center"><Zap className="mr-2 h-8 w-8" /> Foi Você?</h1>
            <div className="text-right">
                <p className="font-semibold">Olá, {userPlayer?.username || 'Anônimo'}</p>
                <p className="text-sm text-gray-500">ID: {userId}</p>
            </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Coluna 1: Jogadores e Status */}
            <div className="lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold mb-4 text-gray-300 flex items-center"><Users className="mr-2" /> Jogadores na Festa ({players.length})</h2>
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                    {players.map((p) => (
                        <li key={p.id} className={`p-3 rounded-lg flex justify-between items-center transition ${p.id === userId ? 'bg-purple-700 font-bold' : 'bg-gray-700'}`}>
                            <span>{p.username} {p.id === userId && '(Você)'}</span>
                            {status === GAME_STATUS.VOTING && (
                                <button 
                                    onClick={() => setVoteTargetId(p.id)}
                                    disabled={p.id === userId || hasVoted}
                                    className={`px-3 py-1 text-sm rounded-full transition duration-150 
                                        ${p.id === voteTargetId ? 'bg-green-500' : 'bg-purple-500 hover:bg-purple-600'}
                                        ${hasVoted ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {p.id === voteTargetId ? 'Selecionado' : 'Votar'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
                <button
                    onClick={handleVote}
                    disabled={!voteTargetId || hasVoted}
                    className="mt-6 w-full p-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition duration-300 disabled:opacity-50"
                >
                    {hasVoted ? 'Voto Enviado!' : 'Confirmar Voto'}
                </button>

            </div>

            {/* Coluna 2: Chat Anônimo */}
            <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-xl flex flex-col h-[70vh]">
                <h2 className="text-2xl font-bold mb-4 text-gray-300 flex items-center"><Smile className="mr-2" /> Chat Anônimo</h2>
                
                {/* Área de Mensagens */}
                <div className="flex-grow overflow-y-auto space-y-4 p-4 mb-4 bg-gray-700 rounded-lg">
                    {messages.length === 0 ? (
                        <p className="text-center text-gray-400 mt-4">Nenhuma mensagem ainda. Diga olá!</p>
                    ) : (
                        messages.map((msg) => {
                            const isMine = msg.senderId === userId;
                            return (
                                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-xs md:max-w-md p-3 rounded-xl shadow-md ${isMine ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-600 text-white rounded-tl-none'}`}>
                                        <p className="font-semibold text-xs mb-1 opacity-70">
                                            {isMine ? 'Você (Anônimo)' : msg.senderName || 'Anônimo'}
                                        </p>
                                        <p>{msg.text}</p>
                                        <span className="block text-right text-xs mt-1 opacity-50">
                                            {msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                
                {/* Input de Mensagem */}
                <form onSubmit={handleSendMessage} className="flex">
                    <input
                        type="text"
                        name="messageInput"
                        placeholder="Mande uma mensagem anônima..."
                        className="flex-grow p-3 rounded-l-lg bg-gray-700 text-white border-none focus:ring-purple-500 focus:border-purple-500"
                    />
                    <button
                        type="submit"
                        className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-r-lg flex items-center transition duration-200"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </main>

        {/* Mock de Resultados (pode ser ativado pelo Host) */}
        {status === GAME_STATUS.RESULTS && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4">
                <div className="bg-gray-800 p-8 rounded-xl w-full max-w-lg shadow-2xl">
                    <h2 className="text-3xl font-bold mb-6 text-yellow-400">Resultados da Votação!</h2>
                    <p className="mb-4">A pergunta era: "{currentQuestion}"</p>
                    <ul className="space-y-3">
                        {players.map(p => (
                            <li key={p.id} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                                <span className="font-semibold">{p.username}</span>
                                <span className="text-xl font-extrabold text-purple-400">
                                    {voteCounts[p.id] || 0} Votos
                                </span>
                            </li>
                        ))}
                    </ul>
                    <button 
                        onClick={() => setStatus(GAME_STATUS.WAITING_FOR_QUESTION)}
                        className="mt-8 w-full p-3 bg-purple-600 hover:bg-purple-700 font-bold rounded-lg transition"
                    >
                        Nova Rodada
                    </button>
                </div>
            </div>
        )}
    </div>
);

};
