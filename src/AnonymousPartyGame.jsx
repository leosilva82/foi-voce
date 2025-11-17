/* global __app_id __firebase_config __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { Loader2, Zap, Info } from 'lucide-react';

// === CONFIGURAÇÃO DE AMBIENTE DO CANVAS ===
// As configurações e tokens são injetados automaticamente
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Status
const STATUS = {
    LOADING: 'Carregando...',
    SUCCESS: 'Sucesso!',
    ERROR: 'Erro Fatal de Conexão'
};

const ConnectionTester = () => {
    const [connectionStatus, setConnectionStatus] = useState(STATUS.LOADING);
    const [userId, setUserId] = useState('ID do Usuário Desconhecido');
    const [authDetails, setAuthDetails] = useState('');

    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            setConnectionStatus(STATUS.ERROR);
            setAuthDetails('ERRO: Configuração do Firebase não encontrada (variável __firebase_config vazia).');
            return;
        }

        const runTest = async () => {
            try {
                // 1. Inicializa o Firebase App
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                
                let user;

                // 2. Tenta Autenticar
                if (initialAuthToken) {
                    // Tenta login com o token fornecido pelo ambiente
                    await signInWithCustomToken(auth, initialAuthToken);
                    setAuthDetails('Autenticação com TOKEN CUSTOMIZADO bem-sucedida.');
                } else {
                    // Faz login anônimo como fallback
                    await signInAnonymously(auth);
                    setAuthDetails('Autenticação ANÔNIMA bem-sucedida (Sem token customizado).');
                }
                
                // 3. Obtém o ID do Usuário
                user = auth.currentUser;
                if (user && user.uid) {
                    setUserId(user.uid);
                    setConnectionStatus(STATUS.SUCCESS);
                } else {
                    setUserId('Usuário autenticado, mas o UID não foi encontrado.');
                    setConnectionStatus(STATUS.SUCCESS);
                }

            } catch (error) {
                console.error("ERRO COMPLETO DO FIREBASE:", error);
                setConnectionStatus(STATUS.ERROR);
                setAuthDetails(`Código do Erro: ${error.code} | Mensagem: ${error.message}`);
            }
        };

        runTest();
    }, []);

    const getColor = () => {
        switch(connectionStatus) {
            case STATUS.SUCCESS: return 'bg-green-600';
            case STATUS.ERROR: return 'bg-red-700';
            default: return 'bg-gray-800';
        }
    }

    return (
        <div className={`flex flex-col items-center justify-center min-h-screen ${getColor()} text-white p-6 transition duration-500`}>
            <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-lg">
                <h1 className="text-3xl font-extrabold mb-6 flex items-center justify-center text-purple-400">
                    <Zap className="w-8 h-8 mr-2" /> Teste de Conexão Firebase
                </h1>
                
                {connectionStatus === STATUS.LOADING && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400 mb-4" />
                        <p className="text-xl">{STATUS.LOADING}</p>
                    </div>
                )}

                {connectionStatus !== STATUS.LOADING && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-800 rounded-lg">
                            <p className="text-gray-400 font-semibold">STATUS GERAL:</p>
                            <p className={`text-2xl font-bold ${connectionStatus === STATUS.SUCCESS ? 'text-green-400' : 'text-red-400'}`}>
                                {connectionStatus}
                            </p>
                        </div>
                        
                        <div className="p-4 bg-gray-800 rounded-lg break-words">
                            <p className="text-gray-400 font-semibold">TIPO DE AUTENTICAÇÃO:</p>
                            <p className="text-lg font-mono text-yellow-300">{authDetails}</p>
                        </div>

                        <div className="p-4 bg-gray-800 rounded-lg break-words">
                            <p className="text-gray-400 font-semibold">SEU ID (UID):</p>
                            <p className="text-lg font-mono">{userId}</p>
                        </div>
                        
                        {connectionStatus === STATUS.SUCCESS && (
                            <p className="text-center text-lg text-green-300 pt-4">A conexão está OK! O problema não é o Firebase.</p>
                        )}
                        
                        {connectionStatus === STATUS.ERROR && (
                            <p className="text-center text-lg text-red-300 pt-4">ERRO: Verifique o console para detalhes do erro.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionTester;

