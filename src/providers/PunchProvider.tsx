import React, { createContext, useContext, useMemo } from 'react';
import { QueryClient, QueryProvider } from '@tanstack/react-query';
import { sortPunches, toDateKey, validateEditedPunchTime } from '../utils';
import { useProfile, useUserSettings, usePunches, useAddPunch, useUpdateUserSettings, useCurrentPunch, useUpdatePunch, useDeletePunch } from '../hooks/useSupabase';
import { useAuth } from './AuthProvider';
import { useSync } from './SyncProvider';
import { useToast } from '../ToastContext';
import type { Punch, PendingPunch } from '../types';

interface PunchContextType {
  punches: Punch[];
  isWorking: boolean;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  remainingMinutes: number;
  pendingLunchMinutes: number;
  predictedExitStr: string;
  addPunch: (timestampOverride?: Date) => Promise<boolean>;
  updatePunch: (id: string, newTimestamp: Date) => Promise<boolean>;
  deletePunch: (id: string) => Promise<boolean>;
  isSavingPunch: boolean;
  updateExpectedMinutes: (v: number) => Promise<void>;
  updateLunchMinutes: (v: number) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DEFAULT_EXPECTED_MINUTES = 528;
const DEFAULT_LUNCH_MINUTES = 60;
const PunchContext = createContext<PunchContextType | undefined>(undefined);

const calculateWorkedMs = (punches: Punch[], targetNowMs: number): number => {
  let workedMs = 0;
  const sortedPunches = [...punches].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (let i = 0; i < sortedPunches.length; i += 2) {
    const start = sortedPunches[i].timestamp.getTime();
    const end = sortedPunches[i + 1] ? sortedPunches[i + 1].timestamp.getTime() : targetNowMs;
    if (end > start) workedMs += (end - start);
  }
  return workedMs;
};

const toUserMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;
  return `${fallback} (${error.message})`;
};

export function PunchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline, addPendingPunch, removePendingPunch } = useSync();
  
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }), []);

  const profileQuery = useProfile(user?.id ?? '');
  const settingsQuery = useUserSettings(user?.id ?? '');
  const punchesQuery = usePunches(user?.id ?? '');
  const currentPunchData = useCurrentPunch(user?.id ?? '');
  
  const { mutateAsync: addPunchMutation } = useAddPunch();
  const { mutateAsync: updateSettingsMutation } = useUpdateUserSettings();
  const { mutateAsync: updatePunchMutation } = useUpdatePunch();
  const { mutateAsync: deletePunchMutation } = useDeletePunch();

  const expectedMinutes = settingsQuery.data?.expected_minutes ?? DEFAULT_EXPECTED_MINUTES;
  const lunchMinutes = settingsQuery.data?.lunch_minutes ?? DEFAULT_LUNCH_MINUTES;
  const isWorking = currentPunchData.isWorking;
  const todayPunches = punchesQuery.data?.filter(p => toDateKey(new Date(p.timestamp)) === toDateKey(new Date())) ?? [];
  const workedMinutes = Math.floor(calculateWorkedMs(todayPunches.map(p => ({ 
    timestamp: new Date(p.timestamp), 
    pending: p.pending 
  })), Date.now()) / 60000);
  const balanceMinutes = workedMinutes - expectedMinutes;
  const remainingMinutes = Math.max(expectedMinutes - workedMinutes, 0);
  const pendingLunchMinutes = isWorking && todayPunches.length === 1 ? lunchMinutes : 0;
  const predictedExitStr = isWorking ? 
    new Date(Date.now() + (remainingMinutes + pendingLunchMinutes) * 60000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 
    '--:--';

  const addPunch = async (timestampOverride?: Date): Promise<boolean> => {
    if (!user) return false;
    const now = timestampOverride ?? new Date();
    const todayPunchesForCheck = punchesQuery.data?.filter(p => toDateKey(new Date(p.timestamp)) === toDateKey(now)) ?? [];
    if (todayPunchesForCheck.length > 0 && Date.now() - todayPunchesForCheck[todayPunchesForCheck.length - 1].timestamp.getTime() < 15000) {
      toast('Aguarde alguns segundos antes de registrar novamente.', 'error');
      return false;
    }
    
    const lastPunch = todayPunchesForCheck[todayPunchesForCheck.length - 1];
    let type: 'in' | 'out' | 'lunch_start' | 'lunch_end' = 'in';
    
    if (lastPunch) {
      const lastType = lastPunch.type;
      if (lastType === 'in') type = 'lunch_start';
      else if (lastType === 'lunch_start') type = 'lunch_end';
      else if (lastType === 'lunch_end') type = 'out';
      else if (lastType === 'out') type = 'in';
    }
    
    if (!isOnline) {
      const pending: PendingPunch = {
        id: `local-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`,
        timestamp: now.toISOString(),
        type,
      };
      addPendingPunch(pending);
      toast(`Ponto guardado no celular.`, 'info');
      return true;
    }
    
    try {
      await addPunchMutation({ userId: user.id, punchData: { timestamp: now.toISOString(), type } });
      return true;
    } catch (error) {
      toast(toUserMessage(error, 'Erro ao registrar ponto.'), 'error');
      return false;
    }
  };

  const updatePunch = async (id: string, newTimestamp: Date): Promise<boolean> => {
    if (!user) return false;
    const validationMessage = validateEditedPunchTime(punchesQuery.data ?? [], id, newTimestamp);
    if (validationMessage) {
      toast(validationMessage, 'error');
      return false;
    }
    try {
      await updatePunchMutation({ id, timestamp: newTimestamp.toISOString() });
      return true;
    } catch (error) {
      toast(toUserMessage(error, 'Erro ao atualizar ponto.'), 'error');
      return false;
    }
  };

  const deletePunch = async (id: string): Promise<boolean> => {
    if (!user) return false;
    if (id.startsWith('local-') || id.startsWith('legacy-')) {
      removePendingPunch(id);
      toast('Ponto pendente removido do celular.', 'info');
      return true;
    }
    try {
      await deletePunchMutation(id);
      return true;
    } catch (error) {
      toast(toUserMessage(error, 'Erro ao excluir ponto.'), 'error');
      return false;
    }
  };

  const updateExpectedMinutes = async (value: number) => {
    const normalized = Math.round(value);
    if (normalized < 1 || normalized > 1440) {
      toast('Jornada diaria invalida. Informe entre 1 e 1440 minutos.', 'error');
      return;
    }
    if (!user) return;
    try {
      await updateSettingsMutation({ userId: user.id, settings: { expected_minutes: normalized } });
    } catch (error) {
      toast(toUserMessage(error, 'Erro ao salvar jornada diaria.'), 'error');
    }
  };

  const updateLunchMinutes = async (value: number) => {
    const normalized = Math.round(value);
    if (normalized < 0 || normalized > 1440) {
      toast('Intervalo invalido. Informe entre 0 e 1440 minutos.', 'error');
      return;
    }
    if (!user) return;
    try {
      await updateSettingsMutation({ userId: user.id, settings: { lunch_minutes: normalized } });
    } catch (error) {
      toast(toUserMessage(error, 'Erro ao salvar intervalo.'), 'error');
    }
  };

  const refreshData = async () => {
    if (!user) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['userSettings', user.id] }),
      queryClient.invalidateQueries({ queryKey: ['punches', user.id] }),
    ]);
  };

  return (
    <QueryProvider client={queryClient}>
      <PunchContext.Provider value={{ 
        punches: punchesQuery.data?.map(p => ({ id: p.id, timestamp: new Date(p.timestamp), type: p.type, pending: p.pending })) ?? [],
        isWorking, workedMinutes, expectedMinutes, balanceMinutes, remainingMinutes, pendingLunchMinutes, predictedExitStr,
        addPunch, updatePunch, deletePunch, isSavingPunch: false, updateExpectedMinutes, updateLunchMinutes, refreshData
      }}>
        {children}
      </PunchContext.Provider>
    </QueryProvider>
  );
}

export const usePunchesContext = () => {
  const context = useContext(PunchContext);
  if (!context) throw new Error('usePunchesContext must be used within a PunchProvider');
  return context;
};
