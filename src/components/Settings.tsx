import { Clock, LogOut, Shield, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useToast } from '../ToastContext';
import { useUserSettings } from '../hooks/useSupabase';
import { useAuth } from '../providers/AuthProvider';
import { usePunchesContext } from '../providers/PunchProvider';
import { getSupabase } from '../utils/supabase';

export function Settings() {
  const { logOut, user } = useAuth();
  const { expectedMinutes, updateExpectedMinutes, updateLunchMinutes } = usePunchesContext();
  const { toast } = useToast();
  const { data: settings } = useUserSettings(user?.id ?? '');
  const [localHours, setLocalHours] = useState(Math.floor(expectedMinutes / 60));
  const [localMins, setLocalMins] = useState(expectedMinutes % 60);
  const [lunchMins, setLunchMins] = useState(settings?.lunch_minutes ?? 60);

  const [displayName, setDisplayName] = useState('');
  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalHours(Math.floor(expectedMinutes / 60));
    setLocalMins(expectedMinutes % 60);
  }, [expectedMinutes]);

  useEffect(() => {
    setLunchMins(settings?.lunch_minutes ?? 60);
  }, [settings?.lunch_minutes]);

  useEffect(() => {
    if (!user) return;
    setEmailInput(user.email ?? '');
    void (async () => {
      const { data } = await getSupabase().from('profiles').select('display_name').eq('id', user.id).maybeSingle();
      setDisplayName(data?.display_name ?? '');
    })();
  }, [user]);

  const handleSaveWorkday = () => {
    const safeHours = Math.max(0, Math.min(24, localHours));
    const safeMinutes = Math.max(0, Math.min(59, localMins));
    setLocalHours(safeHours);
    setLocalMins(safeMinutes);
    updateExpectedMinutes((safeHours * 60) + safeMinutes);
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;
    setSaving(true);
    const trimmed = displayName.trim();
    const { error } = await getSupabase()
      .from('profiles')
      .update({ display_name: trimmed || null })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast(`Erro ao salvar nome: ${error.message}`, 'error');
      return;
    }
    toast('Nome atualizado com sucesso.', 'success');
  };

  const handleUpdateEmail = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      toast('Informe um email valido.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await getSupabase().auth.updateUser({ email: emailInput.trim() });
    setSaving(false);
    if (error) {
      toast(`Erro ao solicitar troca de email: ${error.message}`, 'error');
      return;
    }
    toast('Solicitacao enviada. Confirme no email para concluir a troca.', 'success');
  };

  const handleUpdatePassword = async () => {
    if (passwordInput.length < 6) {
      toast('A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }
    if (passwordInput !== passwordConfirm) {
      toast('As senhas nao conferem.', 'error');
      return;
    }

    setSaving(true);
    const { error } = await getSupabase().auth.updateUser({ password: passwordInput });
    setSaving(false);
    if (error) {
      toast(`Erro ao alterar senha: ${error.message}`, 'error');
      return;
    }
    setPasswordInput('');
    setPasswordConfirm('');
    toast('Senha atualizada com sucesso.', 'success');
  };

  return (
    <div className="pt-12 md:pt-32 pb-32 px-6 max-w-3xl mx-auto flex flex-col gap-6 relative z-10 w-full mb-32">
      <div className="mb-2">
        <h2 className="text-display-lg text-on-surface">Ajustes</h2>
        <p className="text-body-md text-on-surface-variant mt-2">Perfil, seguranca e aparencia.</p>
      </div>

      <section className="glass-panel rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-variant/30">
          <h3 className="text-headline-md text-on-surface flex items-center gap-2">
            <User className="text-primary w-6 h-6" />
            Conta
          </h3>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant">
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {(displayName?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase()}
              </div>
            </div>
            <div>
              <p className="text-body-lg font-bold text-on-surface">{displayName || 'Usuario'}</p>
              <p className="text-body-sm text-on-surface-variant">{user?.email}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-label-sm text-on-surface block mb-1">NOME EXIBIDO</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 text-on-surface" placeholder="Seu nome" />
            </div>
            <button disabled={saving} onClick={handleSaveDisplayName} className="bg-primary text-white px-4 py-2 rounded-lg font-bold">Salvar nome</button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-label-sm text-on-surface block mb-1">NOVO EMAIL</label>
              <input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 text-on-surface" placeholder="novo@email.com" />
            </div>
            <button disabled={saving} onClick={handleUpdateEmail} className="bg-surface-variant text-on-surface px-4 py-2 rounded-lg font-bold border border-outline-variant">Trocar email</button>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-variant/30">
          <h3 className="text-headline-md text-on-surface flex items-center gap-2">
            <Shield className="text-primary w-6 h-6" />
            Seguranca
          </h3>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-label-sm text-on-surface block mb-1">NOVA SENHA</label>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 text-on-surface" placeholder="Minimo 6 caracteres" />
            </div>
            <div>
              <label className="text-label-sm text-on-surface block mb-1">CONFIRMAR SENHA</label>
              <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 text-on-surface" placeholder="Repita a senha" />
            </div>
          </div>
          <button disabled={saving} onClick={handleUpdatePassword} className="bg-surface-variant text-on-surface px-4 py-2 rounded-lg font-bold border border-outline-variant self-start">Alterar senha</button>
        </div>
      </section>

      <section className="glass-panel rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-variant/30">
          <h3 className="text-headline-md text-on-surface flex items-center gap-2">
            <Clock className="text-primary w-6 h-6" />
            Jornada de Trabalho
          </h3>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <label className="text-label-sm text-on-surface block mb-1">JORNADA DIARIA PREVISTA</label>
              <span className="text-body-md text-on-surface-variant text-sm">Defina quanto tempo voce deve trabalhar por dia.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-24">
                <input type="number" min="0" max="24" value={localHours} onChange={(e) => setLocalHours(parseInt(e.target.value, 10) || 0)} onBlur={handleSaveWorkday} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 pr-6 text-body-md font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-sm">h</span>
              </div>
              <span className="text-surface-variant-on font-bold">:</span>
              <div className="relative w-24">
                <input type="number" min="0" max="59" value={localMins.toString().padStart(2, '0')} onChange={(e) => setLocalMins(parseInt(e.target.value, 10) || 0)} onBlur={handleSaveWorkday} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 pr-7 text-body-md font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-sm">m</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-label-sm text-on-surface block mb-1">INTERVALO DE ALMOCO</label>
              <span className="text-body-sm text-on-surface-variant">Tempo previsto para pausa.</span>
            </div>
            <div className="relative w-32">
              <input type="number" min="0" max="1440" value={lunchMins} onChange={(e) => setLunchMins(parseInt(e.target.value, 10) || 0)} onBlur={() => updateLunchMinutes(lunchMins)} className="w-full bg-surface-variant border border-outline-variant rounded-lg px-3 py-2 pr-8 text-body-md font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-center" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-label-sm">min</span>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-xl overflow-hidden flex flex-col p-4">
        <button onClick={logOut} className="w-full flex items-center justify-between bg-surface-variant hover:bg-outline-variant border border-outline-variant/50 rounded-lg px-5 py-3 transition-colors active:scale-[0.98]">
          <div className="flex items-center gap-3">
            <LogOut className="text-on-surface-variant w-5 h-5" />
            <span className="text-label-sm text-on-surface-variant mt-0.5">SAIR DA CONTA</span>
          </div>
        </button>
      </section>
    </div>
  );
}
