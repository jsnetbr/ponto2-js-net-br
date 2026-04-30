import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { sortPunches, toDateKey, validateEditedPunchTime } from './utils';
import { supabase } from './utils/supabase';

export interface Punch {
  id: string;
  timestamp: Date;
  type: 'in' | 'out';
}

interface AppContextType {
  user: User | null;
  loadingAuth: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  punches: Punch[];
  addPunch: (timestampOverride?: Date) => Promise<boolean>;
  updatePunch: (id: string, newTimestamp: Date) => Promise<boolean>;
  deletePunch: (id: string) => Promise<boolean>;
  isSavingPunch: boolean;
  isOnline: boolean;
  pendingPunchCount: number;
  expectedMinutes: number;
  updateExpectedMinutes: (v: number) => Promise<void>;
  error: string | null;
}

const DEFAULT_EXPECTED_MINUTES = 528;
const AppContext = createContext<AppContextType | undefined>(undefined);

const toUserMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  if (error.message.includes('Invalid login credentials')) return 'Email ou senha invalidos.';
  if (error.message.includes('Email not confirmed')) return 'Confirme seu email antes de entrar.';
  return `${fallback} (${error.message})`;
};

const normalizeExpectedMinutes = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.round(value);
  return normalized < 1 || normalized > 1440 ? null : normalized;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [expectedMinutes, setExpectedMinutes] = useState(DEFAULT_EXPECTED_MINUTES);
  const [error, setError] = useState<string | null>(null);
  const [isSavingPunch, setIsSavingPunch] = useState(false);
  const [pendingPunchCount, setPendingPunchCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const getQueueStorageKey = (uid: string) => `pontojs:pendingPunches:${uid}`;
  const readPendingQueue = (uid: string): number => {
    try {
      const parsed = Number(window.localStorage.getItem(getQueueStorageKey(uid)) ?? '0');
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  };
  const writePendingQueue = (uid: string, value: number) => {
    const normalized = Math.max(0, Math.floor(value));
    if (normalized === 0) window.localStorage.removeItem(getQueueStorageKey(uid));
    else window.localStorage.setItem(getQueueStorageKey(uid), String(normalized));
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

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

  useEffect(() => {
    if (!user) return;
    setPendingPunchCount(readPendingQueue(user.id));
    void (async () => {
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!profile) await supabase.from('profiles').upsert({ id: user.id, email: user.email ?? '' });

      const { data: settings } = await supabase.from('user_settings').select('expected_minutes').eq('user_id', user.id).maybeSingle();
      if (!settings) {
        await supabase.from('user_settings').upsert({ user_id: user.id, expected_minutes: DEFAULT_EXPECTED_MINUTES });
        setExpectedMinutes(DEFAULT_EXPECTED_MINUTES);
      } else {
        setExpectedMinutes(normalizeExpectedMinutes(settings.expected_minutes) ?? DEFAULT_EXPECTED_MINUTES);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPunches([]);
      return;
    }
    void (async () => {
      const { data, error: loadError } = await supabase
        .from('punches')
        .select('id,timestamp,type')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });
      if (loadError) {
        setError(toUserMessage(loadError, 'Erro ao carregar historico.'));
        return;
      }
      setPunches((data ?? []).map((row) => ({ id: row.id, timestamp: new Date(row.timestamp), type: row.type })));
    })();
  }, [user]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(toUserMessage(authError, 'Erro ao autenticar.'));
  };
  const signUp = async (email: string, password: string) => {
    setError(null);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) setError(toUserMessage(authError, 'Erro ao criar conta.'));
    else setError('Conta criada. Verifique seu email para confirmar.');
  };
  const logOut = async () => {
    setError(null);
    setPunches([]);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(toUserMessage(signOutError, 'Erro ao sair.'));
  };

  const refreshPunches = async () => {
    if (!user) return;
    const { data } = await supabase.from('punches').select('id,timestamp,type').eq('user_id', user.id).order('timestamp');
    setPunches((data ?? []).map((row) => ({ id: row.id, timestamp: new Date(row.timestamp), type: row.type })));
  };

  const addPunch = async (timestampOverride?: Date): Promise<boolean> => {
    if (!user) return false;
    setError(null);
    if (isSavingPunch) return false;
    const now = timestampOverride ?? new Date();
    const todayPunches = sortPunches(punches.filter((p) => toDateKey(p.timestamp) === toDateKey(now)));
    if (todayPunches.length > 0 && Date.now() - todayPunches[todayPunches.length - 1].timestamp.getTime() < 15000) {
      setError('Aguarde alguns segundos antes de registrar novamente.');
      return false;
    }
    if (!isOnline) {
      const queued = readPendingQueue(user.id) + 1;
      writePendingQueue(user.id, queued);
      setPendingPunchCount(queued);
      setError(`Sem internet. ${queued} ponto(s) aguardando sincronizacao.`);
      return true;
    }
    setIsSavingPunch(true);
    const type: 'in' | 'out' = todayPunches.length % 2 === 0 ? 'in' : 'out';
    const { error: addError } = await supabase.from('punches').insert({ user_id: user.id, timestamp: now.toISOString(), type });
    setIsSavingPunch(false);
    if (addError) {
      setError(toUserMessage(addError, 'Erro ao registrar ponto.'));
      return false;
    }
    await refreshPunches();
    return true;
  };

  useEffect(() => {
    void (async () => {
      if (!user || !isOnline || isSavingPunch) return;
      const queued = readPendingQueue(user.id);
      if (queued <= 0) return;
      setIsSavingPunch(true);
      try {
        for (let i = 0; i < queued; i += 1) {
          const todayCount = punches.filter((p) => toDateKey(p.timestamp) === toDateKey(new Date())).length + i;
          const type: 'in' | 'out' = todayCount % 2 === 0 ? 'in' : 'out';
          const now = new Date();
          const { error: addError } = await supabase.from('punches').insert({ user_id: user.id, timestamp: now.toISOString(), type });
          if (addError) throw addError;
        }
        writePendingQueue(user.id, 0);
        setPendingPunchCount(0);
        setError(`${queued} ponto(s) sincronizados.`);
        await refreshPunches();
      } catch (syncError) {
        setError(toUserMessage(syncError, 'Falha ao sincronizar fila.'));
      } finally {
        setIsSavingPunch(false);
      }
    })();
  }, [user, isOnline, punches, isSavingPunch]);

  const updatePunch = async (id: string, newTimestamp: Date): Promise<boolean> => {
    if (!user || !isOnline) return false;
    const validationMessage = validateEditedPunchTime(punches, id, newTimestamp);
    if (validationMessage) {
      setError(validationMessage);
      return false;
    }
    const { error: updateError } = await supabase.from('punches').update({ timestamp: newTimestamp.toISOString() }).eq('id', id).eq('user_id', user.id);
    if (updateError) {
      setError(toUserMessage(updateError, 'Erro ao atualizar ponto.'));
      return false;
    }
    await refreshPunches();
    return true;
  };

  const deletePunch = async (id: string): Promise<boolean> => {
    if (!user || !isOnline) return false;
    const { error: deleteError } = await supabase.from('punches').delete().eq('id', id).eq('user_id', user.id);
    if (deleteError) {
      setError(toUserMessage(deleteError, 'Erro ao excluir ponto.'));
      return false;
    }
    await refreshPunches();
    return true;
  };

  const updateExpectedMinutes = async (value: number) => {
    const normalized = normalizeExpectedMinutes(value);
    if (normalized == null) {
      setError('Jornada diaria invalida. Informe entre 1 e 1440 minutos.');
      return;
    }
    setExpectedMinutes(normalized);
    if (!user) return;
    const { error: settingsError } = await supabase.from('user_settings').upsert({ user_id: user.id, expected_minutes: normalized });
    if (settingsError) setError(toUserMessage(settingsError, 'Erro ao salvar jornada diaria.'));
  };

  return (
    <AppContext.Provider value={{ user, loadingAuth, signIn, signUp, logOut, punches, addPunch, updatePunch, deletePunch, isSavingPunch, isOnline, pendingPunchCount, expectedMinutes, updateExpectedMinutes, error }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext deve ser usado dentro de AppProvider');
  return context;
};
