import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthProvider';
import { useToast } from '../ToastContext';
import type { PendingPunch } from '../types';

interface SyncContextType {
  isOnline: boolean;
  pendingPunchCount: number;
  isSavingPunch: boolean;
  addPendingPunch: (punch: PendingPunch) => void;
  removePendingPunch: (id: string) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pendingQueue, setPendingQueue] = useState<PendingPunch[]>([]);
  const [pendingPunchCount, setPendingPunchCount] = useState(0);
  const [isSavingPunch, setIsSavingPunch] = useState(false);

  const getQueueStorageKey = (uid: string) => `pontojs:pendingPunches:${uid}`;

  const readPendingQueue = (uid: string): PendingPunch[] => {
    try {
      const raw = window.localStorage.getItem(getQueueStorageKey(uid));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is PendingPunch => 
          typeof item?.id === 'string' && typeof item?.timestamp === 'string' && (item?.type === 'in' || item?.type === 'out' || item?.type === 'lunch_start' || item?.type === 'lunch_end')
        );
      }
      return [];
    } catch { return []; }
  };

  const writePendingQueue = (uid: string, value: PendingPunch[]) => {
    if (value.length === 0) window.localStorage.removeItem(getQueueStorageKey(uid));
    else window.localStorage.setItem(getQueueStorageKey(uid), JSON.stringify(value));
    setPendingQueue(value);
    setPendingPunchCount(value.length);
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
    if (!user) {
      setPendingQueue([]);
      setPendingPunchCount(0);
      return;
    }
    const queue = readPendingQueue(user.id);
    setPendingQueue(queue);
    setPendingPunchCount(queue.length);
  }, [user]);

  useEffect(() => {
    void (async () => {
      if (!user || !isOnline || isSavingPunch) return;
      const queued = pendingQueue.length > 0 ? pendingQueue : readPendingQueue(user.id);
      if (queued.length <= 0) return;
      
      setIsSavingPunch(true);
      toast(`Sincronizando ${queued.length} ponto(s)...`, 'info');
      
      try {
        const payload = queued.map(item => ({
          user_id: user.id,
          timestamp: item.timestamp,
          type: item.type,
        }));

        const { error } = await supabase
          .from('punches')
          .upsert(payload, { onConflict: 'user_id,timestamp,type', ignoreDuplicates: true });
        
        if (error) throw error;

        writePendingQueue(user.id, []);
        toast(`${queued.length} ponto(s) sincronizados.`, 'success');
      } catch (error) {
        console.error('Sync error:', error);
        toast('Falha ao sincronizar fila. Tentaremos novamente em breve.', 'error');
      } finally {
        setIsSavingPunch(false);
      }
    })();
  }, [user, isOnline, pendingQueue, isSavingPunch]);

  const addPendingPunch = (punch: PendingPunch) => {
    const current = readPendingQueue(user?.id ?? '');
    const updated = [...current, punch];
    writePendingQueue(user?.id ?? '', updated);
  };

  const removePendingPunch = (id: string) => {
    const current = readPendingQueue(user?.id ?? '');
    const updated = current.filter(p => p.id !== id);
    writePendingQueue(user?.id ?? '', updated);
  };

  return (
    <SyncContext.Provider value={{ isOnline, pendingPunchCount, isSavingPunch, addPendingPunch, removePendingPunch }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
