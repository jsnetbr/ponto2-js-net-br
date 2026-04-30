import React, { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Navigation } from './components/Navigation';
import { useAuth } from './providers/AuthProvider';
import { usePunchesContext } from './providers/PunchProvider';
import { useSync } from './providers/SyncProvider';
import { ToastProvider } from './ToastContext';
import { AppIcon } from './components/AppIcon';

const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const History = lazy(() => import('./components/History').then((module) => ({ default: module.History })));
const Settings = lazy(() => import('./components/Settings').then((module) => ({ default: module.Settings })));

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, loadingAuth, signIn, signUp } = useAuth();
  const { isOnline, pendingPunchCount } = useSync();
  const { } = usePunchesContext(); // Not used here but available
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

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SyncProvider>
          <PunchProvider>
            <AppContent />
          </PunchProvider>
        </SyncProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
