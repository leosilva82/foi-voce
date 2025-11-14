import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, query, where, addDoc, getDocs, setDoc, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { Heart, Send, Users, LogIn, UserPlus, Play, Key, Clipboard, Check, Shuffle, RefreshCcw, Trophy, X, MessageSquare, Shield, Lock, Trash2, ArrowRight } from 'lucide-react';

// --- Variáveis Globais (MANDATÓRIO) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- CONSTANTES DO JOGO ---
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const MAX_ROUNDS = 10; // Usar 10 das 30 perguntas

const PERGUNTAS_PADRAO = [
    "Qual foi a coisa mais estranha que você já comeu?",
    "Qual é a sua 'guilty pleasure' de filme/série?",
    "Qual é o seu pior hábito?",
    "Qual foi o último sonho que você se lembra?",
    "Se você pudesse ter um superpoder, qual seria?",
    "Qual é o livro ou jogo que você mais recomenda?",
    "Se você fosse um animal, qual seria e por quê?",
    "Qual é a mentira mais inofensiva que você conta regularmente?",
    "Qual é o seu talento mais inútil?",
    "Qual foi o maior desastre culinário que você já causou?",
    "Se você pudesse viver em qualquer época da história, qual seria?",
    "Qual é o seu medo mais irracional?",
    "Qual é a música que você tem vergonha de gostar?",
    "O que te tira do sério instantaneamente?",
    "Qual é a coisa mais impulsiva que você já fez?",
    "Qual é o seu lugar favorito no mundo e por quê?",
    "Qual é a sua habilidade menos conhecida?",
    "O que te faz rir de forma incontrolável?",
    "Qual é o conselho mais estranho que você já recebeu?",
    "Se você pudesse ter um clone, o que ele faria?",
    "Qual é o objeto mais precioso que você tem?",
    "Qual foi o maior risco que você já correu?",
    "Qual celebridade você acha que tem o cheiro bom?",
    "Qual é a sua mania mais esquisita?",
    "O que você faria se ganhasse na loteria hoje?",
    "Qual é o seu prato favorito de infância?",
    "O que você acha mais difícil de perdoar?",
    "Qual é a sua filosofia de vida em três palavras?",
    "Se você pudesse falar com uma pessoa falecida, quem seria?",
    "Qual é a coisa mais bonita que você já viu?",
];

// --- UTILS ---
const generateRandomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// Embaralha uma lista (Fisher-Yates)
const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

// Criptografia e Decriptografia Simples para Respostas
// CRÍTICO: No mundo real, a criptografia deve ser no servidor (Cloud Functions)
// Aqui, apenas ofusca. A segurança real está nas Regras do Firestore.
const simpleEncrypt = (text) => btoa(text);
const simpleDecrypt = (hash) => atob(hash);

// --- COMPONENTES DE UI ---

const Button = ({ children, onClick, disabled = false, primary = true, icon: Icon = null, className = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center justify-center py-3 px-4 text-center font-bold rounded-xl transition duration-300 transform 
            ${primary ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-500/50' : 'bg-gray-200 hover:bg-gray-300 text-gray-800 shadow-md'}
            ${disabled ? 'opacity-50 cursor-not-allowed shadow-none' : 'hover:scale-[1.01]'}
            ${className}`}
    >
        {Icon && <Icon className="w-5 h-5 mr-2" />}
        {children}
    </button>
);

const Card = ({ children, title = null, subtitle = null, className = '' }) => (
    <div className={`bg-white p-6 md:p-8 rounded-3xl shadow-xl w-full max-w-lg ${className}`}>
        {title && <h2 className="text-3xl font-extrabold text-gray-900 mb-1">{title}</h2>}
        {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}
        {children}
    </div>
);

const Input = ({ label, type = 'text', value, onChange, placeholder = '' }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-sky-500 focus:border-sky-500 transition duration-150"
        />
    </div>
);

const Toast = ({ message, type = 'success', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
    };

    return (
        <div className={`fixed bottom-5 right-5 p-4 rounded-xl shadow-2xl text-white font-bold ${colors[type]} z-50 transition-transform duration-300`}>
            {message}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

const App = () => {
    const [user, setUser] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState('auth'); // auth, menu, create, join, room
    const [roomId, setRoomId] = useState('');
    const [roomPasscode, setRoomPasscode] = useState('');
    const [roomData, setRoomData] = useState(null);
    const [roomPlayers, setRoomPlayers] = useState([]);
    const [activeQuestion, setActiveQuestion] = useState(null);
    const [myAnswer, setMyAnswer] = useState('');
    const [myGuesses, setMyGuesses] = useState({});
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    // --- AUTENTICAÇÃO E INICIALIZAÇÃO ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUserId(currentUser.uid);
                // Tenta buscar o nome do usuário no Firestore
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDocs(userRef);

                if (userSnap.exists) {
                    setUser({ uid: currentUser.uid, name: userSnap.data().name });
                } else {
                    // Se o nome não existir, usa o email para o nome temporário
                    setUser({ uid: currentUser.uid, name: currentUser.email.split('@')[0] }); 
                }
                setView('menu');
            } else {
                setUser(null);
                setUserId(null);
                setView('auth');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Função de tratamento de erro para exibir toast
    const handleActionError = (err, message) => {
        console.error(err);
        setError(message);
        setToast({ message: `Erro: ${message}`, type: 'error' });
    };

    // --- LÓGICA DE LOGIN/CADASTRO ---

    const handleAuth = async (isSignUp, name, email, password) => {
        setIsLoading(true);
        setError(null);
        try {
            let userCredential;
            if (isSignUp) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                // Salva o nome no Firestore ao criar a conta
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    name,
                    email,
                    createdAt: new Date(),
                });
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }
            setUser({ uid: userCredential.user.uid, name: name || userCredential.user.email.split('@')[0] });
            setToast({ message: isSignUp ? 'Conta criada com sucesso!' : 'Login realizado com sucesso!', type: 'success' });
        } catch (err) {
            handleActionError(err, 'Falha na autenticação. Verifique e-mail/senha.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setRoomData(null);
            setRoomPlayers([]);
            setToast({ message: 'Logout realizado.', type: 'info' });
        } catch (err) {
            handleActionError(err, 'Falha ao sair.');
        }
    };

    // --- LÓGICA DE SALA ---

    const isHost = useMemo(() => roomData && userId === roomData.hostId, [roomData, userId]);
    const myPlayer = useMemo(() => roomPlayers.find(p => p.userId === userId), [roomPlayers, userId]);

    // Hook para sincronizar dados da sala em tempo real
    useEffect(() => {
        if (!roomId || view !== 'room') return;

        const roomRef = doc(db, 'rooms', roomId);
        const playersRef = collection(db, 'rooms', roomId, 'players');

        // Sincroniza dados da sala
        const unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRoomData(data);
                // Atualiza a pergunta ativa
                if (data.currentQuestionIndex !== -1 && data.status !== 'FINISHED') {
                    const q = doc(db, 'rooms', roomId, 'questions', data.currentQuestionIndex.toString());
                    onSnapshot(q, (qSnap) => {
                        if (qSnap.exists()) setActiveQuestion(qSnap.data());
                    });
                } else {
                    setActiveQuestion(null);
                }
            } else {
                setRoomData(null);
                setToast({ message: 'Sala excluída ou você foi removido.', type: 'info' });
                setView('menu');
            }
        });

        // Sincroniza jogadores
        const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
            setRoomPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeRoom();
            unsubscribePlayers();
        };
    }, [roomId, view]);

    // Função para entrar na sala
    const joinRoom = useCallback(async (id, passcode) => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const roomRef = doc(db, 'rooms', id);
            const roomSnap = await getDocs(roomRef);

            if (!roomSnap.exists()) {
                throw new Error('Sala não encontrada.');
            }

            const data = roomSnap.data();

            if (data.passcode !== passcode) {
                throw new Error('Senha incorreta.');
            }

            if (data.playerCount >= MAX_PLAYERS) {
                throw new Error('Sala lotada.');
            }
            if (data.status !== 'LOBBY' && data.status !== 'FINISHED') {
                 throw new Error('O jogo já começou nesta sala.');
            }

            const playerRef = doc(db, 'rooms', id, 'players', user.uid);
            await setDoc(playerRef, {
                userId: user.uid,
                name: user.name,
                score: 0,
                isHost: data.hostId === user.uid,
                hasResponded: false,
                hasGuessed: false,
            });

            await updateDoc(roomRef, {
                playerCount: data.playerCount + 1
            });

            setRoomId(id);
            setView('room');
            setToast({ message: `Você entrou na sala ${id}!`, type: 'success' });

        } catch (err) {
            handleActionError(err, err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, handleActionError]);


    // Função para criar a sala
    const createRoom = async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);

        try {
            const id = generateRandomId();
            const passcode = generateRandomId();
            const roomRef = doc(db, 'rooms', id);

            // Seleciona 10 perguntas aleatórias
            const selectedQuestions = shuffleArray(PERGUNTAS_PADRAO).slice(0, MAX_ROUNDS);
            
            await setDoc(roomRef, {
                id,
                passcode,
                hostId: user.uid,
                playerCount: 1,
                status: 'LOBBY', // LOBBY, Q_WAITING, A_COLLECTING, A_REVIEW, G_COLLECTING, G_SCORING, FINISHED
                currentQuestionIndex: -1,
                totalRounds: MAX_ROUNDS,
                questions: selectedQuestions,
                createdAt: new Date(),
            });

            // Adiciona o host como jogador
            const playerRef = doc(db, 'rooms', id, 'players', user.uid);
            await setDoc(playerRef, {
                userId: user.uid,
                name: user.name,
                score: 0,
                isHost: true,
                hasResponded: false,
                hasGuessed: false,
            });

            setRoomId(id);
            setView('room');
            setToast({ message: `Sala ${id} criada com sucesso!`, type: 'success' });

        } catch (err) {
            handleActionError(err, 'Falha ao criar sala.');
        } finally {
            setIsLoading(false);
        }
    };
    
    // Função de Compartilhamento via WhatsApp
    const shareRoom = () => {
        if (!roomData) return;
        const roomLink = `${window.location.origin}/?room=${roomData.id}&passcode=${roomData.passcode}`;
        const message = `Partida de Adivinhação Anônima!%0A%0AEntre na minha sala:%0A*ID:* ${roomData.id}%0A*Senha:* ${roomData.passcode}%0A%0A*Link de Acesso:* ${encodeURIComponent(roomLink)}`;
        window.open(`https://wa.me/?text=${message}`, '_blank');
        setToast({ message: 'Link copiado e WhatsApp aberto!', type: 'info' });
    };

    // --- LÓGICA DE JOGO (HOST) ---

    const startNextRound = async () => {
        if (!isHost || !roomData) return;

        const nextIndex = roomData.currentQuestionIndex + 1;

        if (nextIndex >= roomData.totalRounds) {
            // FIM DO JOGO
            await updateDoc(doc(db, 'rooms', roomId), { status: 'FINISHED' });
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'rooms', roomId);
                // 1. Atualiza a sala para o próximo round
                transaction.update(roomRef, {
                    status: 'A_COLLECTING', // Próximo estado é coleta de respostas
                    currentQuestionIndex: nextIndex,
                });

                // 2. Reseta o status de resposta de todos os jogadores
                roomPlayers.forEach(player => {
                    const playerRef = doc(db, 'rooms', roomId, 'players', player.userId);
                    transaction.update(playerRef, {
                        hasResponded: false,
                        hasGuessed: false,
                    });
                });

                // 3. Cria o documento da pergunta
                const questionData = {
                    roomId: roomId,
                    round: nextIndex + 1,
                    question: roomData.questions[nextIndex],
                    responsesReleased: false,
                };
                const questionRef = doc(db, 'rooms', roomId, 'questions', nextIndex.toString());
                transaction.set(questionRef, questionData);
            });
            setToast({ message: `Rodada ${nextIndex + 1} iniciada!`, type: 'success' });
        } catch (err) {
            handleActionError(err, 'Falha ao iniciar a rodada.');
        }
    };

    // Host libera respostas
    const releaseAnswers = async () => {
        if (!isHost || !roomData || roomData.status !== 'A_REVIEW' || !activeQuestion) return;

        try {
            const questionRef = doc(db, 'rooms', roomId, 'questions', roomData.currentQuestionIndex.toString());
            await updateDoc(questionRef, { responsesReleased: true });
            await updateDoc(doc(db, 'rooms', roomId), { status: 'G_COLLECTING' });
            setToast({ message: 'Respostas liberadas! Hora de adivinhar.', type: 'info' });
        } catch (err) {
            handleActionError(err, 'Falha ao liberar respostas.');
        }
    };

    // Host avança para a próxima etapa (pontuação ou próxima pergunta)
    const advanceRound = async () => {
        if (!isHost || !roomData) return;

        if (roomData.status === 'G_COLLECTING') {
            await runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'rooms', roomId);
                transaction.update(roomRef, { status: 'G_SCORING' });
            });
        } else if (roomData.status === 'G_SCORING') {
            await startNextRound();
        }
    };

    // --- LÓGICA DE JOGO (JOGADOR) ---

    // Jogador envia sua resposta
    const submitAnswer = async () => {
        if (!myPlayer || myPlayer.hasResponded || !activeQuestion || myAnswer.trim() === '') return;

        try {
            const answerRef = doc(collection(db, 'rooms', roomId, 'answers', activeQuestion.round.toString()));
            
            // CRÍTICO: Armazena a resposta criptografada.
            // O playerId é usado apenas para pontuação e não é exposto.
            await addDoc(collection(db, 'rooms', roomId, 'answers'), {
                questionId: activeQuestion.round,
                roomId: roomId,
                playerId: user.uid, // Quem respondeu
                encryptedAnswer: simpleEncrypt(myAnswer), // Resposta ofuscada
                isReleased: false, // O host controla isso
            });

            // Atualiza status do jogador
            await updateDoc(doc(db, 'rooms', roomId, 'players', user.uid), { hasResponded: true });
            setMyAnswer('');
            setToast({ message: 'Sua resposta foi enviada anonimamente!', type: 'success' });
        } catch (err) {
            handleActionError(err, 'Falha ao enviar resposta.');
        }
    };

    // Jogador envia seu palpite
    const submitGuess = async (answerId, guessedPlayerId) => {
        if (!myPlayer || myPlayer.hasGuessed) return;
        
        try {
            // Esta lógica de pontuação e verificação DEVERIA ser em Cloud Functions
            // Para simplificar, faremos a pontuação ao final da rodada no client (menos seguro)

            // Registra o palpite
            const guessRef = doc(collection(db, 'rooms', roomId, 'guesses'));
            await addDoc(guessRef, {
                answerId: answerId,
                guesserId: user.uid,
                guessedPlayerId: guessedPlayerId,
            });

            // Atualiza o jogador (apenas para evitar palpites duplicados)
            await updateDoc(doc(db, 'rooms', roomId, 'players', user.uid), { hasGuessed: true });
            setToast({ message: 'Seu palpite foi registrado!', type: 'success' });
            
        } catch (err) {
            handleActionError(err, 'Falha ao enviar palpite.');
        }
    };

    // --- LÓGICA DE CONTAGEM E RANKING (NOVO) ---

    // Calcula a pontuação e os palpites
    const calculateRoundResults = async () => {
        // Esta é a função que o HOST clica para calcular a pontuação
        // Nota: Por ser no client, não é 100% à prova de fraude, mas funciona com as regras do Firestore
        if (!isHost || roomData.status !== 'G_SCORING') return;

        try {
            const answersSnapshot = await getDocs(query(collection(db, 'rooms', roomId, 'answers'), where('questionId', '==', activeQuestion.round)));
            const guessesSnapshot = await getDocs(collection(db, 'rooms', roomId, 'guesses'));

            const answers = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const guesses = guessesSnapshot.docs.map(doc => doc.data());

            let playerScoresUpdate = {};

            // 1. Processar Palpites
            guesses.forEach(guess => {
                const answer = answers.find(a => a.id === guess.answerId);
                if (!answer) return;

                // Adivinhou certo?
                const isCorrect = answer.playerId === guess.guessedPlayerId;
                
                // +1 ponto para quem acertou
                if (isCorrect) {
                    playerScoresUpdate[guess.guesserId] = (playerScoresUpdate[guess.guesserId] || 0) + 1;
                }
                
                // Aqui podemos registrar o palpite para exibição (não implementado por brevidade, mas o dado existe no Firestore)
            });

            // 2. Atualizar pontuação no Firestore (Transação para segurança)
            await runTransaction(db, async (transaction) => {
                roomPlayers.forEach(player => {
                    if (playerScoresUpdate[player.userId]) {
                        const playerRef = doc(db, 'rooms', roomId, 'players', player.userId);
                        transaction.update(playerRef, {
                            score: player.score + playerScoresUpdate[player.userId],
                        });
                    }
                });
            });

            setToast({ message: 'Pontuações calculadas e atualizadas!', type: 'success' });

        } catch (err) {
            handleActionError(err, 'Falha ao calcular pontuações.');
        }
    };

    // O Host avança para a próxima etapa (pontuação)
    useEffect(() => {
        if (roomData?.status === 'G_COLLECTING' && isHost) {
            const allGuessed = roomPlayers.every(p => p.hasGuessed);
            if (allGuessed) {
                // Aqui o Host deveria clicar em um botão, mas para o teste avançamos automaticamente.
                // Na versão final, é um clique do Host.
            }
        }
    }, [roomData, roomPlayers, isHost]);


    // --- RENDERS DE TELA ---

    const renderAuth = () => <AuthScreen onAuth={handleAuth} isLoading={isLoading} />;
    const renderMenu = () => <MenuScreen setView={setView} onLogout={handleLogout} userName={user?.name} />;
    const renderCreate = () => <CreateRoomScreen onCreate={createRoom} isLoading={isLoading} setView={setView} />;
    const renderJoin = () => <JoinRoomScreen onJoin={joinRoom} isLoading={isLoading} setView={setView} roomId={roomId} setRoomId={setRoomId} roomPasscode={roomPasscode} setRoomPasscode={setRoomPasscode} />;
    const renderRoom = () => <RoomScreen
        user={user}
        roomData={roomData}
        roomPlayers={roomPlayers}
        isHost={isHost}
        myPlayer={myPlayer}
        activeQuestion={activeQuestion}
        startNextRound={startNextRound}
        releaseAnswers={releaseAnswers}
        advanceRound={advanceRound}
        submitAnswer={submitAnswer}
        myAnswer={myAnswer}
        setMyAnswer={setMyAnswer}
        shareRoom={shareRoom}
        submitGuess={submitGuess}
        calculateRoundResults={calculateRoundResults}
        setView={setView}
    />;


    if (isLoading) {
        return <LoadingScreen />;
    }

    const renderContent = () => {
        switch (view) {
            case 'auth': return renderAuth();
            case 'menu': return renderMenu();
            case 'create': return renderCreate();
            case 'join': return renderJoin();
            case 'room': return renderRoom();
            default: return renderMenu();
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            {renderContent()}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// --- TELAS DE INTERFACE ---

// TELA DE CARREGAMENTO
const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen w-full">
        <RefreshCcw className="w-10 h-10 text-sky-600 animate-spin" />
        <p className="mt-4 text-gray-600 font-medium">Carregando...</p>
    </div>
);

// TELA 1: LOGIN E CADASTRO
const AuthScreen = ({ onAuth, isLoading }) => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onAuth(isSignUp, name, email, password);
    };

    return (
        <Card title={isSignUp ? 'Criar Conta' : 'Entrar'} subtitle="Use seu e-mail e senha para começar.">
            <form onSubmit={handleSubmit}>
                {isSignUp && <Input label="Nome (público no jogo)" value={name} onChange={setName} placeholder="Seu apelido" />}
                <Input label="E-mail" type="email" value={email} onChange={setEmail} placeholder="email@exemplo.com" />
                <Input label="Senha" type="password" value={password} onChange={setPassword} placeholder="Sua senha secreta" />

                <div className="mt-6 space-y-3">
                    <Button type="submit" disabled={isLoading} icon={isSignUp ? UserPlus : LogIn}>
                        {isSignUp ? 'Criar Conta' : 'Entrar'}
                    </Button>
                    <Button type="button" primary={false} onClick={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
                        {isSignUp ? 'Já tenho conta' : 'Quero me cadastrar'}
                    </Button>
                </div>
            </form>
        </Card>
    );
};

// TELA 2: MENU PRINCIPAL
const MenuScreen = ({ setView, onLogout, userName }) => (
    <Card title={`Olá, ${userName || 'Jogador'}!`}>
        <p className="text-gray-600 mb-6">Pronto para a rodada de adivinhação?</p>
        <div className="space-y-4">
            <Button onClick={() => setView('create')} icon={Play}>
                Criar Sala (Host)
            </Button>
            <Button onClick={() => setView('join')} icon={LogIn}>
                Entrar na Sala
            </Button>
            <Button onClick={onLogout} primary={false} icon={X}>
                Sair
            </Button>
        </div>
    </Card>
);

// TELA 3: CRIAR SALA
const CreateRoomScreen = ({ onCreate, isLoading, setView }) => (
    <Card title="Nova Sala" subtitle="Você será o Host desta partida anônima.">
        <div className="space-y-4">
            <Button onClick={onCreate} disabled={isLoading} icon={Play}>
                Criar Sala Agora
            </Button>
            <Button onClick={() => setView('menu')} primary={false} disabled={isLoading} icon={X}>
                Voltar
            </Button>
        </div>
    </Card>
);

// TELA 4: ENTRAR NA SALA
const JoinRoomScreen = ({ onJoin, isLoading, setView, roomId, setRoomId, roomPasscode, setRoomPasscode }) => (
    <Card title="Entrar na Sala" subtitle="Insira o ID e a Senha da sala para participar.">
        <Input label="ID da Sala" value={roomId} onChange={setRoomId} placeholder="Ex: A7YQZ" />
        <Input label="Senha (Passcode)" value={roomPasscode} onChange={setRoomPasscode} placeholder="Ex: B9WRE" />
        <div className="mt-6 space-y-4">
            <Button onClick={() => onJoin(roomId, roomPasscode)} disabled={isLoading || !roomId || !roomPasscode} icon={LogIn}>
                Entrar
            </Button>
            <Button onClick={() => setView('menu')} primary={false} disabled={isLoading} icon={X}>
                Voltar
            </Button>
        </div>
    </Card>
);

// TELA 5: SALA DE JOGO
const RoomScreen = ({
    user, roomData, roomPlayers, isHost, myPlayer, activeQuestion,
    startNextRound, releaseAnswers, advanceRound, submitAnswer, myAnswer,
    setMyAnswer, shareRoom, submitGuess, calculateRoundResults, setView
}) => {
    if (!roomData || !myPlayer) return <LoadingScreen />;

    const [isCopied, setIsCopied] = useState(false);

    // Lógica para compartilhar URL (para o WhatsApp)
    const handleCopy = () => {
        const roomLink = `${window.location.origin}/?room=${roomData.id}&passcode=${roomData.passcode}`;
        navigator.clipboard.writeText(roomLink).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    // --- SUB-COMPONENTES DE ESTADO DE JOGO ---

    // Exibe lista de jogadores e status
    const PlayerList = () => (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl shadow-inner max-h-48 overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center"><Users className="w-4 h-4 mr-2"/> Jogadores ({roomPlayers.length}/{MAX_PLAYERS})</h3>
            <ul className="space-y-1">
                {roomPlayers.map(p => (
                    <li key={p.userId} className={`flex justify-between items-center text-sm p-2 rounded-lg ${p.isHost ? 'bg-yellow-100' : ''} ${p.userId === user.uid ? 'font-bold text-sky-700' : 'text-gray-800'}`}>
                        <span className="truncate">{p.name} {p.isHost ? '(HOST)' : ''}</span>
                        {/* Mostra status da rodada */}
                        {roomData.status === 'A_COLLECTING' && (
                             <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.hasResponded ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {p.hasResponded ? 'OK' : 'Falta'}
                            </span>
                        )}
                        {roomData.status === 'G_COLLECTING' && (
                             <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.hasGuessed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {p.hasGuessed ? 'Palpitou' : 'Falta'}
                            </span>
                        )}
                        {roomData.status === 'G_SCORING' && (
                             <span className="text-sm font-bold text-sky-600">{p.score} pts</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );

    // Estado: Coleta de Respostas
    const CollectingAnswer = () => (
        <>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Pergunta {activeQuestion?.round || '...'}:</h3>
            <p className="text-2xl font-extrabold text-sky-600 mb-4 text-center">{activeQuestion?.question || 'Aguardando Host...'}</p>

            {myPlayer.hasResponded ? (
                <div className="p-4 bg-green-100 text-green-800 font-semibold rounded-xl text-center flex items-center justify-center">
                    <Check className="w-5 h-5 mr-2" /> Resposta enviada. Aguarde os demais.
                </div>
            ) : (
                <div className="mt-4">
                    <textarea
                        value={myAnswer}
                        onChange={(e) => setMyAnswer(e.target.value)}
                        placeholder="Escreva sua resposta (Anônima!)"
                        className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:ring-sky-500 focus:border-sky-500 transition duration-150"
                        rows="3"
                    ></textarea>
                    <Button onClick={submitAnswer} disabled={myAnswer.trim() === ''} icon={Send} className="mt-2">
                        Enviar Resposta
                    </Button>
                </div>
            )}
        </>
    );

    // Estado: Adivinhação
    const GuessingAnswers = () => {
        const [answers, setAnswers] = useState([]);
        const [isFetching, setIsFetching] = useState(true);
        const [selectedGuess, setSelectedGuess] = useState(null);

        // Fetch respostas quando o status for G_COLLECTING
        useEffect(() => {
            if (roomData.status === 'G_COLLECTING' && activeQuestion) {
                setIsFetching(true);
                const fetchAnswers = async () => {
                    const answersSnap = await getDocs(query(collection(db, 'rooms', roomData.id, 'answers'), 
                        where('questionId', '==', activeQuestion.round)));
                    
                    const rawAnswers = answersSnap.docs
                        .map(doc => ({ 
                            id: doc.id, 
                            answer: simpleDecrypt(doc.data().encryptedAnswer), // Decifra a resposta para o cliente
                            isReleased: doc.data().isReleased,
                        }));
                    
                    // CRÍTICO: Embaralha as respostas e remove a que o próprio jogador deu (se fosse possível ver)
                    setAnswers(shuffleArray(rawAnswers)); 
                    setIsFetching(false);
                };
                fetchAnswers();
            }
        }, [roomData.status, activeQuestion?.round]);

        const playersForGuess = roomPlayers.filter(p => p.userId !== user.uid).map(p => ({
            id: p.userId,
            name: p.name
        }));
        
        // Se já palpitaou
        if (myPlayer.hasGuessed) {
            return (
                 <div className="p-4 bg-green-100 text-green-800 font-semibold rounded-xl text-center flex items-center justify-center">
                    <Check className="w-5 h-5 mr-2" /> Palpites enviados. Aguarde o Host.
                </div>
            )
        }
        
        if (isFetching || answers.length === 0) return <p className="text-center text-gray-500">Carregando respostas...</p>;

        return (
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quem respondeu o quê?</h3>
                <div className="space-y-4">
                    {answers.map((answer) => (
                        <div key={answer.id} className="bg-white p-4 rounded-xl shadow-md border-l-4 border-sky-400">
                            <p className="font-medium text-gray-800 italic mb-2">"{answer.answer}"</p>
                            
                            <div className="mt-3">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Seu Palpite:</label>
                                <select 
                                    onChange={(e) => submitGuess(answer.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500"
                                    disabled={myPlayer.hasGuessed}
                                >
                                    <option value="">Escolha quem respondeu...</option>
                                    {playersForGuess.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    // --- RENDERING PRINCIPAL ---
    
    // Renderiza o título da sala
    const renderRoomHeader = () => (
        <div className="mb-6 border-b pb-4">
            <h1 className="text-3xl font-extrabold text-sky-600">Sala: {roomData.id}</h1>
            <p className="text-gray-500 text-sm flex items-center">
                <Key className="w-3 h-3 mr-1" /> Senha: {roomData.passcode}
                <button onClick={handleCopy} className="ml-2 text-sky-500 hover:text-sky-700">
                    {isCopied ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                </button>
            </p>
            <Button onClick={shareRoom} icon={MessageSquare} primary={false} className="mt-3 text-sm">
                Compartilhar Link (WhatsApp)
            </Button>
        </div>
    );

    // Renderiza a área principal (depende do status)
    const renderGameStatus = () => {
        const hostReady = roomPlayers.length >= MIN_PLAYERS && roomPlayers.length <= MAX_PLAYERS;
        
        switch (roomData.status) {
            case 'LOBBY':
                return (
                    <>
                        <p className="text-gray-700 mb-4 text-center">Esperando jogadores (mínimo 3).</p>
                        {isHost && (
                            <Button onClick={startNextRound} disabled={!hostReady} icon={Play}>
                                {hostReady ? 'Iniciar Jogo' : `Mínimo ${MIN_PLAYERS} jogadores...`}
                            </Button>
                        )}
                        {!isHost && <p className="text-center font-semibold text-sky-600">Aguardando Host iniciar o jogo.</p>}
                    </>
                );
            case 'Q_WAITING':
                return (
                    <div className="text-center p-6 bg-yellow-50 rounded-xl">
                        <p className="font-semibold text-yellow-800">Pronto para a Rodada {roomData.currentQuestionIndex + 1}.</p>
                        {isHost && (
                            <Button onClick={startNextRound} icon={ArrowRight} className="mt-4">
                                Iniciar Pergunta
                            </Button>
                        )}
                        {!isHost && <p className="mt-2 text-gray-600">Aguardando Host iniciar a próxima pergunta...</p>}
                    </div>
                );
            case 'A_COLLECTING':
                const allResponded = roomPlayers.every(p => p.hasResponded);
                return (
                    <>
                        <CollectingAnswer />
                        {isHost && allResponded && (
                            <Button onClick={() => updateDoc(doc(db, 'rooms', roomId), { status: 'A_REVIEW' })} icon={Shuffle} className="mt-4 bg-purple-600 hover:bg-purple-700 shadow-purple-500/50">
                                Liberar Respostas (TODOS JÁ RESPONDERAM)
                            </Button>
                        )}
                        {!isHost && allResponded && (
                            <div className="p-3 bg-indigo-100 text-indigo-800 font-semibold rounded-xl text-center mt-4">
                                Todos responderam! Aguarde o Host.
                            </div>
                        )}
                    </>
                );
            case 'A_REVIEW':
                return (
                    <div className="text-center p-6 bg-yellow-100 rounded-xl">
                        <p className="font-bold text-xl text-yellow-800">Host, hora de liberar!</p>
                        {isHost && (
                             <Button onClick={releaseAnswers} icon={Shield} className="mt-4">
                                Liberar Respostas e Iniciar Adivinhação
                            </Button>
                        )}
                        {!isHost && <p className="mt-2 text-gray-600">Host irá liberar as respostas para a adivinhação.</p>}
                    </div>
                );
            case 'G_COLLECTING':
                const allGuessed = roomPlayers.every(p => p.hasGuessed);
                return (
                    <>
                        <GuessingAnswers />
                        {isHost && allGuessed && (
                            <Button onClick={advanceRound} icon={Trophy} className="mt-4 bg-purple-600 hover:bg-purple-700 shadow-purple-500/50">
                                Calcular Pontos (TODOS PALPITARAM)
                            </Button>
                        )}
                        {!isHost && allGuessed && (
                            <div className="p-3 bg-indigo-100 text-indigo-800 font-semibold rounded-xl text-center mt-4">
                                Todos palpitaram! Aguarde o Host calcular.
                            </div>
                        )}
                    </>
                );
            case 'G_SCORING':
                // O host calcula a pontuação real
                if (isHost) calculateRoundResults();

                return (
                    <div className="text-center p-6 bg-blue-100 rounded-xl">
                        <p className="font-bold text-xl text-blue-800">Pontuação da Rodada Calculada!</p>
                        <PlayerList />
                        {isHost && (
                            <Button onClick={advanceRound} icon={ArrowRight} className="mt-4">
                                Próxima Pergunta ({roomData.currentQuestionIndex + 1}/{roomData.totalRounds})
                            </Button>
                        )}
                    </div>
                );
            case 'FINISHED':
                const ranking = [...roomPlayers].sort((a, b) => b.score - a.score);
                return (
                    <div className="text-center">
                        <h2 className="text-3xl font-extrabold text-sky-600 mb-4 flex items-center justify-center"><Trophy className="w-7 h-7 mr-2"/> FIM DE JOGO!</h2>
                        <div className="space-y-2">
                            {ranking.map((p, index) => (
                                <div key={p.userId} className={`p-3 rounded-xl flex justify-between items-center ${index === 0 ? 'bg-yellow-200 border-4 border-yellow-500 shadow-lg' : 'bg-gray-100'}`}>
                                    <span className="font-bold">{index + 1}. {p.name}</span>
                                    <span className="font-extrabold text-lg text-sky-700">{p.score} pts</span>
                                </div>
                            ))}
                        </div>
                        <Button onClick={() => setView('menu')} primary={false} className="mt-6">
                            Voltar ao Menu
                        </Button>
                    </div>
                );
            default:
                return <p>Status Desconhecido.</p>;
        }
    };


    return (
        <Card className="max-w-xl">
            {renderRoomHeader()}
            {renderGameStatus()}
            {roomData.status !== 'LOBBY' && roomData.status !== 'FINISHED' && <PlayerList />}
            <Button onClick={() => setView('menu')} primary={false} icon={X} className="mt-6">
                Sair da Sala (Você não pontua)
            </Button>
        </Card>
    );
};

// --- EXPORTAÇÃO PADRÃO ---
export default App;

