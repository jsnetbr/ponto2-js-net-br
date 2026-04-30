import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { ProfileSchema, UserSettingsSchema, PunchSchema, type UserSettings } from '../schemas';

// Hook para perfil do usuário
export const useProfile = (userId: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return ProfileSchema.parse(data);
    },
    enabled: !!userId,
  });
};

// Hook para configurações do usuário
export const useUserSettings = (userId: string) => {
  return useQuery({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return UserSettingsSchema.parse(data);
    },
    enabled: !!userId,
  });
};

// Hook para punches do usuário
export const usePunches = (userId: string) => {
  return useQuery({
    queryKey: ['punches', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punches')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(p => PunchSchema.parse(p));
    },
    enabled: !!userId,
  });
};

// Mutation para adicionar punch
export const useAddPunch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, punchData }: { userId: string; punchData: { timestamp: string; type: 'in' | 'out' | 'lunch_start' | 'lunch_end' } }) => {
      const { data, error } = await supabase
        .from('punches')
        .insert([
          {
            user_id: userId,
            timestamp: punchData.timestamp,
            type: punchData.type,
          },
        ])
        .select()
        .single();
      
      if (error) throw error;
      return PunchSchema.parse(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['punches', variables.userId] });
    },
    onError: (error) => {
      console.error('Erro ao adicionar punch:', error);
      throw error;
    },
  });
};

// Mutation para atualizar configurações
export const useUpdateUserSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, settings }: { userId: string; settings: Partial<UserSettings> }) => {
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return UserSettingsSchema.parse(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userSettings', variables.userId] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar configurações:', error);
      throw error;
    },
  });
};

// Mutation para atualizar punch
export const useUpdatePunch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (punchData: { userId: string; id: string; timestamp: string }) => {
      const { data, error } = await supabase
        .from('punches')
        .update({ timestamp: punchData.timestamp })
        .eq('id', punchData.id)
        .eq('user_id', punchData.userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['punches', variables.userId] });
    },
    onError: (error) => {
      console.error('Erro ao atualizar punch:', error);
      throw error;
    },
  });
};

// Mutation para excluir punch
export const useDeletePunch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, punchId }: { userId: string; punchId: string }) => {
      const { error } = await supabase
        .from('punches')
        .delete()
        .eq('id', punchId)
        .eq('user_id', userId);
      
      if (error) throw error;
      return punchId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['punches', variables.userId] });
    },
    onError: (error) => {
      console.error('Erro ao excluir punch:', error);
      throw error;
    },
  });
};

// Hook para obter punch atual (último punch)
export const useCurrentPunch = (userId: string) => {
  const punchesQuery = usePunches(userId);
  
  return {
    ...punchesQuery,
    currentPunch: punchesQuery.data?.[punchesQuery.data?.length - 1] || null,
    isWorking: punchesQuery.data?.length % 2 !== 0 || false,
  };
};
