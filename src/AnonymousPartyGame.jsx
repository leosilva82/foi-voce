/* global __app_id __firebase_config __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { Loader2, Zap } from 'lucide-react';

// === CONFIGURAÇÃO DE AMBIENTE DO CANVAS ===
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const STATUS = {
    PENDING: 'Conectando...',
    SUCCESS: 'Sucesso!',
    ERROR: 'Erro Fatal'
};

const ConnectionTesterMinimal = () => {
    const [connectionStatus, setConnectionStatus] = useState(STATUS.PENDING);
    const [userId, setUserId] = useState('Aguardando...');
    const [authDetails, setAuthDetails] = useState('Iniciando...');

    // O useEffect é a parte mais segura para rodar a lógica de inicialização
    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            setConnectionStatus(STATUS.ERROR);
            setAuthDetails('ERRO: Configuração do Firebase ausente.');
            return;
        }

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Use uma função que se auto-executa para lidar com o async/await dentro do useEffect
        const attemptAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                    setAuthDetails('Autenticação com TOKEN CUSTOMIZADO.');
                } else {
                    await signInAnonymously(auth);
                    setAuthDetails('Autenticação ANÔNIMA.');
                }
                
                const user = auth.currentUser;
                if (user && user.uid) {
                    setUserId(user.uid);
                    setConnectionStatus(STATUS.SUCCESS);
                } else {
                    setUserId('ID não encontrado.');
                    setConnectionStatus(STATUS.ERROR);
                }
            } catch (error) {
                console.error("ERRO COMPLETO DO FIREBASE:", error);
                setConnectionStatus(STATUS.ERROR);
                setUserId('Erro de autenticação.');
                setAuthDetails(`Falha na Autenticação: ${error.code}`);
            }
        };

        attemptAuth();

        // O linter não deve reclamar pois 'auth' é usado no try/catch
        // e 'attemptAuth' não tem dependências externas.
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
            <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-lg text-center">
                <h1 className="text-3xl font-extrabold mb-6 flex items-center justify-center text-purple-400">
                    <Zap className="w-8 h-8 mr-2" /> Teste de Conexão
                </h1>
                
                {connectionStatus === STATUS.PENDING && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400 mb-4" />
                        <p className="text-xl">Conectando ao Firebase...</p>
                    </div>
                )}

                {connectionStatus !== STATUS.PENDING && (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-800 rounded-lg">
                            <p className="text-gray-400 font-semibold">STATUS GERAL:</p>
                            <p className={`text-2xl font-bold ${connectionStatus === STATUS.SUCCESS ? 'text-green-400' : 'text-red-400'}`}>
                                {connectionStatus}
                            </p>
                        </div>
                        
                        <div className="p-4 bg-gray-800 rounded-lg break-words text-left">
                            <p className="text-gray-400 font-semibold">DETALHES DA AUTENTICAÇÃO:</p>
                            <p className="text-lg font-mono text-yellow-300">{authDetails}</p>
                        </div>

                        <div className="p-4 bg-gray-800 rounded-lg break-words text-left">
                            <p className="text-gray-400 font-semibold">SEU ID (UID):</p>
                            <p className="text-lg font-mono">{userId}</p>
                        </div>
                        
                        {connectionStatus === STATUS.SUCCESS && (
                            <p className="text-center text-lg text-green-300 pt-4">✅ O Firebase está funcionando corretamente!</p>
                        )}
                        
                        {connectionStatus === STATUS.ERROR && (
                            <p className="text-center text-lg text-red-300 pt-4">❌ Houve um erro na conexão. Verifique os logs do console.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionTesterMinimal;

