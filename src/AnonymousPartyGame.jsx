/* global __app_id __firebase_config __initial_auth_token */
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
getAuth,
signInAnonymously,
signInWithCustomToken,
onAuthStateChanged
} from 'firebase/auth';
import {
getFirestore,
doc,
setDoc,
onSnapshot
} from 'firebase/firestore';
import { Loader2, Zap, Save, AlertTriangle } from 'lucide-react';
// Variáveis de Ambiente (fornecidas pelo sistema)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// Verifica e faz parsing da configuração do Firebase
const firebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// --- COMPONENTE PRINCIPAL (usado no App.jsx) ---
export const AnonymousPartyGame = () => {
const [db, setDb] = useState(null);
const [userId, setUserId] = useState(null);
const [isAuthReady, setIsAuthReady] = useState(false);
const [initError, setInitError] = useState(null);
const [inputText, setInputText] = useState('');
const [lastSavedData, setLastSavedData] = useState('Aguardando...');
const [statusMessage, setStatusMessage] = useState('Conectando...');
const [isSaving, setIsSaving] = useState(false);

// 1. SETUP DO FIREBASE E AUTENTICAÇÃO
useEffect(() => {
    // 1.1 Verificação de Configuração Crítica
    if (!firebaseConfig || !firebaseConfig.apiKey) {
        setInitError("ERRO: A chave 'apiKey' do Firebase não foi fornecida. A conexão não pode ser estabelecida. (Verifique __firebase_config)");
        setIsAuthReady(true);
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        
        setDb(firestore);

        const authListener = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setStatusMessage(`Autenticado com Sucesso. ID: ${user.uid.substring(0, 8)}...`);
            } else {
                // Tenta login anônimo como fallback
                await signInAnonymously(firebaseAuth).catch(e => {
                     console.error("Erro no Login Anônimo:", e);
                     setInitError("Falha na autenticação. Verifique as regras de segurança.");
                });
            }
            setIsAuthReady(true);
        });

        if (initialAuthToken) {
            signInWithCustomToken(firebaseAuth, initialAuthToken).catch(e => {
                console.error("Erro no Login com Token:", e);
            });
        }

        return () => authListener();
    } catch (error) {
        console.error("Erro Fatal na inicialização do Firebase:", error);
        setInitError(`ERRO CRÍTICO: ${error.message}. Verifique sua configuração.`);
        setIsAuthReady(true);
    }
}, []);

// 2. Listener de Dados (Leitura)
useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    // Caminho PRIVADO para teste: /artifacts/{appId}/users/{userId}/testData/mainDocument
    const documentPath = `artifacts/${appId}/users/${userId}/testData/mainDocument`;
    const docRef = doc(db, documentPath);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data().content || 'Nenhum conteúdo salvo.';
            setLastSavedData(data);
            if (!statusMessage.includes('ERRO')) {
                setStatusMessage(`Leitura de dados em tempo real OK. Usuário: ${userId.substring(0, 8)}...`);
            }
        } else {
            setLastSavedData('Documento não existe. Salve algo para criá-lo.');
        }
    }, (error) => {
        console.error("Erro ao ler o Firestore:", error);
        setStatusMessage(`ERRO DE PERMISSÃO: ${error.code}. Verifique as Regras de Segurança.`);
        setLastSavedData('FALHA NA LEITURA.');
    });

    return () => unsubscribe();
}, [db, userId, isAuthReady, statusMessage]);

// 3. Função de Salvar Dado (Escrita)
const saveData = useCallback(async () => {
    if (!db || !userId || isSaving) return;
    
    setIsSaving(true);
    setStatusMessage("Salvando dado...");

    try {
        const documentPath = `artifacts/${appId}/users/${userId}/testData/mainDocument`;
        const docRef = doc(db, documentPath);

        await setDoc(docRef, {
            content: inputText,
            timestamp: new Date().toISOString(),
            savedBy: userId,
        }, { merge: true });

        setStatusMessage("Dado salvo com sucesso! Leitura atualizada em tempo real.");
        setInputText('');
    } catch (error) {
        console.error("Erro ao salvar no Firestore:", error);
        setStatusMessage(`ERRO DE ESCRITA: ${error.code}. Verifique as Regras de Segurança.`);
    } finally {
        setIsSaving(false);
    }
}, [db, userId, inputText, isSaving]);


// UI de Erro de Inicialização
if (initError) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4 text-center">
            <AlertTriangle className="w-12 h-12 mb-4 text-red-500" />
            <h1 className="text-2xl font-bold text-red-400 mb-3">ERRO DE CONFIGURAÇÃO CRÍTICA</h1>
            <p className="text-gray-300 max-w-lg mb-6">{initError}</p>
            <p className="text-sm text-gray-500">Este erro geralmente indica que a variável de ambiente do Firebase não foi injetada corretamente.</p>
        </div>
    );
}

if (!isAuthReady) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
            <Loader2 className="w-8 h-8 animate-spin mr-2 text-purple-400" />
            <p>Iniciando conexão segura com Firebase...</p>
        </div>
    );
}

return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col items-center justify-start">
        <div className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-purple-600 w-full max-w-md mx-auto mt-10">
            
            <h1 className="text-3xl font-extrabold text-purple-400 mb-4 flex items-center justify-center">
                <Zap className="w-6 h-6 mr-2" /> Teste de Conexão Firestore
            </h1>
            
            {/* Status */}
            <div className="p-3 mb-6 rounded-lg text-center font-medium" style={{ 
                backgroundColor: statusMessage.includes('ERRO') ? '#4a1717' : '#174a17', 
                color: statusMessage.includes('ERRO') ? '#f87171' : '#a7f3d0' 
            }}>
                {statusMessage}
            </div>

            {/* Último Dado Salvo */}
            <div className="mb-8 p-4 bg-gray-700 rounded-lg border border-gray-600">
                <h3 className="text-lg font-semibold mb-2 text-gray-200">Último Dado Lido (Em Tempo Real):</h3>
                <p className="text-white break-words italic">"{lastSavedData}"</p>
            </div>

            {/* Formulário de Salvamento */}
            <form onSubmit={(e) => { e.preventDefault(); saveData(); }} className="space-y-4">
                <h3 className="text-xl font-semibold mb-3 text-purple-300">Salvar Novo Dado:</h3>
                <input
                    type="text"
                    placeholder="Digite o dado de teste..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500"
                    required
                />
                <button 
                    type="submit"
                    disabled={isSaving || !userId}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 disabled:bg-gray-600 flex items-center justify-center"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    {isSaving ? 'Salvar no Firestore' : 'Salvar no Firestore'}
                </button>
            </form>

        </div>
        
        <p className="text-gray-500 text-sm mt-4 break-words">Caminho do Firestore usado: /artifacts/{appId}/users/{userId}/testData/mainDocument</p>

    </div>
);

};
export default AnonymousPartyGame;
