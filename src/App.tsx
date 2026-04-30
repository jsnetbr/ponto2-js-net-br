import React, { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigation } from './components/Navigation';
import { AppIcon } from './components/AppIcon';
import { ToastProvider } from './ToastContext';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { PunchProvider } from './providers/PunchProvider';
import { SyncProvider, useSync } from './providers/SyncProvider';
import { isSupabaseConfigured } from './utils/supabase';

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const History = lazy(() => import('./components/History').then((module) => ({ default: module.History })));
const Settings = lazy(() => import('./components/Settings').then((module) => ({ default: module.Settings })));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, loadingAuth, signIn, signUp } = useAuth();
  const { isOnline, pendingPunchCount } = useSync();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (loadingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-surface px-6 py-10 text-center">
         <div className="mb-8">
           <AppIcon size={88} />
         </div>
         <h1 className="text-display-lg text-on-surface mb-4">pontojs.</h1>
         <p className="text-body-lg text-on-surface-variant max-w-sm mb-12">
           Seu controle de ponto eletrônico minimalista. Faça login para acessar o banco de horas.
         </p>
         <div className="w-full max-w-sm flex flex-col gap-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="seu@email.com" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-on-surface" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Sua senha" className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-on-surface" />
          <button onClick={() => signIn(email, password)} className="bg-primary text-white font-bold tracking-wider px-8 py-4 rounded-full w-full hover:bg-primary-container hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl cursor-pointer">
            ENTRAR
          </button>
          <button onClick={() => signUp(email, password)} className="bg-surface-variant text-on-surface font-bold tracking-wider px-8 py-4 rounded-full w-full hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
            CRIAR CONTA
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-bg text-on-surface flex h-[100dvh] font-sans flex-col relative w-full overflow-hidden transition-colors duration-500">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 w-full h-full overflow-y-auto no-scrollbar relative z-10 md:pt-20">
         {user && (!isOnline || pendingPunchCount > 0) && (
           <div className="fixed left-4 right-4 bottom-nav z-40 mx-auto max-w-md rounded-2xl border border-outline bg-surface-variant/95 px-4 py-3 text-body-sm font-semibold text-on-surface shadow-2xl backdrop-blur md:hidden">
             {!isOnline
               ? 'Sem internet: seus pontos ficam guardados no celular.'
               : `${pendingPunchCount} ponto(s) aguardando sincronizacao.`}
           </div>
         )}
         <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="pb-24 md:pb-0"
          >
            <Suspense
              fallback={
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              }
            >
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function MissingConfigScreen() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-surface px-6 py-10 text-center">
      <div className="mb-8">
        <AppIcon size={88} />
      </div>
      <h1 className="text-display-lg text-on-surface mb-4">pontojs.</h1>
      <div className="w-full max-w-md flex flex-col gap-4 rounded-2xl border border-error/30 bg-error-container/30 p-6 text-left">
        <h2 className="text-headline-md font-bold text-error">Configuração incompleta</h2>
        <p className="text-body-md text-on-surface">
          O aplicativo precisa das variáveis de ambiente do Supabase para funcionar.
        </p>
        <div className="flex flex-col gap-2 text-body-sm text-on-surface-variant">
          <code className="rounded-lg bg-surface-variant px-3 py-2 font-mono text-on-surface">VITE_SUPABASE_URL</code>
          <code className="rounded-lg bg-surface-variant px-3 py-2 font-mono text-on-surface">VITE_SUPABASE_PUBLISHABLE_KEY</code>
        </div>
        <p className="text-body-sm text-on-surface-variant pt-2">
          No Cloudflare Pages, vá em <strong>Settings {'>'} Environment variables</strong> e adicione essas variáveis. Depois, faça um novo deploy.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured()) {
    return <MissingConfigScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            <PunchProvider>
              <AppContent />
            </PunchProvider>
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
