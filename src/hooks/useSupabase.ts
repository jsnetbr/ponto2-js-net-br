import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../utils/supabase';
import { ProfileSchema, UserSettingsSchema, PunchSchema, type UserSettings } from '../schemas';

const logError = (message: string, error: unknown) => {
  if (import.meta.env.DEV) {
    console.error(message, error);
  }
};

export const useProfile = (userId: string, userEmail: string) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) return ProfileSchema.parse(data);

      const email = userEmail?.trim() || `user-${userId}@local.invalid`;
      const { data: inserted, error: insertError } = await getSupabase()
        .from('profiles')
        .insert({ id: userId, email })
        .select('*')
        .single();

      if (insertError) throw insertError;
      return ProfileSchema.parse(inserted);
    },
    enabled: !!userId,
  });
};

export const useUserSettings = (userId: string) => {
  return useQuery({
    queryKey: ['userSettings', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) return UserSettingsSchema.parse(data);

      const defaults = { user_id: userId, expected_minutes: 528, lunch_minutes: 60 };
      const { data: inserted, error: insertError } = await getSupabase()
        .from('user_settings')
        .insert(defaults)
        .select('*')
        .single();
      if (insertError) throw insertError;
      return UserSettingsSchema.parse(inserted);
    },
    enabled: !!userId,
  });
};

export const usePunches = (userId: string) => {
  return useQuery({
    queryKey: ['punches', userId],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('punches')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return (data || []).map((p) => PunchSchema.parse(p));
    },
    enabled: !!userId,
  });
};

export const useAddPunch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, punchData }: { userId: string; punchData: { timestamp: string; type: 'in' | 'out' | 'lunch_start' | 'lunch_end' } }) => {
      const { data, error } = await getSupabase()
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
      logError('Erro ao adicionar punch:', error);
    },
  });
};

export const useUpdateUserSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, settings }: { userId: string; settings: Partial<UserSettings> }) => {
      const { data, error } = await getSupabase()
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
      logError('Erro ao atualizar configuracoes:', error);
    },
  });
};

export const useUpdatePunch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (punchData: { userId: string; id: string; timestamp: string }) => {
      const { data, error } = await getSupabase()
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
      logError('Erro ao atualizar punch:', error);
    },
  });
};

export const useDeletePunch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, punchId }: { userId: string; punchId: string }) => {
      const { error } = await getSupabase()
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
      logError('Erro ao excluir punch:', error);
    },
  });
};

export const useCurrentPunch = (userId: string) => {
  const punchesQuery = usePunches(userId);

  return {
    ...punchesQuery,
    currentPunch: punchesQuery.data?.[punchesQuery.data?.length - 1] || null,
    isWorking: punchesQuery.data?.length % 2 !== 0 || false,
  };
};
