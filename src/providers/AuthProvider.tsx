import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { useToast } from '../ToastContext';

interface AuthContextType {
  user: User | null;
  loadingAuth: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toUserMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes('Invalid login credentials')) return 'Email ou senha invalidos.';
  if (error.message.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.';
  return `${fallback} (${error.message})`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoadingAuth(false);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) toast(toUserMessage(authError, 'Erro ao autenticar.'), 'error');
  };
  
  const signUp = async (email: string, password: string) => {
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) toast(toUserMessage(authError, 'Erro ao criar conta.'), 'error');
    else toast('Conta criada. Verifique seu email para confirmar.', 'success');
  };
  
  const logOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) toast(toUserMessage(signOutError, 'Erro ao sair.'), 'error');
  };

  return (
    <AuthContext.Provider value={{ user, loadingAuth, signIn, signUp, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
