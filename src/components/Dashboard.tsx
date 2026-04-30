import { Fingerprint, LogIn, LogOut, Clock, WifiOff, CloudUpload } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { usePunchesContext } from '../providers/PunchProvider';
import { useSync } from '../providers/SyncProvider';
import { formatMinutes, calculateWorkedMs, sortPunches, toDateKey } from '../utils';

const DEFAULT_PENDING_LUNCH_MINUTES = 60;

export function Dashboard() {
  const { punches, addPunch, expectedMinutes, isSavingPunch, isWorking, workedMinutes, balanceMinutes, remainingMinutes, pendingLunchMinutes, predictedExitStr } = usePunchesContext();
  const { isOnline, pendingPunchCount } = useSync();
  const [now, setNow] = useState(new Date());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTime, setConfirmTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = toDateKey(now);
  const todayPunches = sortPunches(punches.filter(p => toDateKey(p.timestamp) === todayKey));
  
  const h = Math.floor(workedMinutes * 60000 / 3600000);
  const m = Math.floor((workedMinutes * 60000 % 3600000) / 60000);
  const s = Math.floor((workedMinutes * 60000 % 60000) / 1000);
  const format2 = (v: number) => v.toString().padStart(2, '0');
  
  const buttonLabel = isSavingPunch ? 'SALVANDO...' : (isWorking ? 'REGISTRAR SAÍDA' : 'BATER PONTO');

  const getPunchLabel = (punch: { type?: string }) => {
    switch (punch.type) {
      case 'in': return 'Entrada';
      case 'lunch_start': return 'Ida intervalo';
      case 'lunch_end': return 'Volta intervalo';
      case 'out': return 'Saida';
      default: return 'Registro';
    }
  };

  const timeString = now.toLocaleTimeString('pt-BR', { hour12: false });
  const dateString = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const handleOpenConfirm = () => {
    if (isSavingPunch) return;
    setConfirmTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setConfirmOpen(true);
  };

  const handleConfirmPunch = async () => {
    const [hh, mm] = confirmTime.split(':').map(Number);
    const target = new Date();
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      target.setHours(hh, mm, 0, 0);
    }
    const saved = await addPunch(target);
    if (saved) setConfirmOpen(false);
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center relative z-10 min-h-[85vh] pt-10 md:pt-32 pb-40">
      
      {/* Live Clock */}
      <div className="flex flex-col items-center mb-8 sm:mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
        <h1 className="text-[56px] sm:text-[80px] font-extrabold tracking-tighter text-on-surface leading-none mb-2">
          {timeString.substring(0, 5)}<span className="text-outline-variant text-[40px] sm:text-[50px]">:{timeString.substring(6, 8)}</span>
        </h1>
        <p className="text-on-surface-variant font-medium text-lg uppercase tracking-widest">{dateString}</p>
      </div>

      {/* Main Punch Button */}
      <button
        type="button"
        disabled={isSavingPunch}
        className="relative flex items-center justify-center mb-10 sm:mb-16 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-70 touch-manipulation"
        onClick={handleOpenConfirm}
      >
        {isWorking && <div className="absolute inset-0 rounded-full border border-primary/20 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>}
        
        <div className={`w-56 h-56 sm:w-72 sm:h-72 rounded-full flex flex-col items-center justify-center transition-all duration-500 ${isWorking ? 'bg-primary border border-primary text-white shadow-xl scale-[1.02]' : 'bg-surface border-2 border-outline hover:border-primary/50 text-on-surface hover:bg-surface-variant'}`}>
          <Fingerprint size={56} className="mb-4 sm:w-16 sm:h-16" />
          <span className="text-label-sm tracking-widest">{buttonLabel}</span>
        </div>
      </button>

      {!isOnline && (
        <div className="w-full mb-8 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-error flex items-center gap-3">
          <WifiOff size={20} />
          <span className="text-body-sm font-semibold">
            Sem internet. Novos pontos serão guardados localmente e enviados quando a conexão voltar.
          </span>
        </div>
      )}

      {pendingPunchCount > 0 && (
        <div className="w-full mb-8 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-on-surface">
          <span className="text-body-sm font-semibold">
            {pendingPunchCount} ponto(s) aguardando sincronização.
          </span>
        </div>
      )}

      {/* Worked Hours Today & Extra Info */}
      <div className="w-full mb-8 border-b border-outline-variant pb-6">
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-label-sm text-outline tracking-widest block mb-1">HORAS HOJE</span>
            <span className="text-headline-md font-bold text-on-surface">{format2(h)}:{format2(m)}<span className="text-outline text-lg">:{format2(s)}</span></span>
          </div>
          <Clock className={`w-6 h-6 ${isWorking ? 'text-primary animate-pulse' : 'text-outline'}`} />
        </div>
        
        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
          <div className="flex flex-col">
            <span className="text-label-sm text-on-surface-variant">JORNADA</span>
            <span className="text-body-md font-semibold text-on-surface">{formatMinutes(expectedMinutes)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-sm text-on-surface-variant">SALDO</span>
            <span className={`text-body-md font-semibold ${balanceMinutes >= 0 ? (balanceMinutes === 0 ? 'text-on-surface' : 'text-primary') : 'text-error'}`}>
              {formatMinutes(balanceMinutes, true)}
            </span>
          </div>
          {isWorking && (
            <div className="flex flex-col">
              <span className="text-label-sm text-on-surface-variant">PREVISÃO DE SAÍDA</span>
              <span className="text-body-md font-semibold text-on-surface">{predictedExitStr}</span>
              {pendingLunchMinutes > 0 && (
                <span className="text-label-sm text-on-surface-variant">
                  inclui {formatMinutes(pendingLunchMinutes)} de intervalo
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline of Punches */}
      <div className="w-full flex flex-col gap-3">
        {todayPunches.length === 0 && (
          <p className="text-center text-on-surface-variant text-sm mt-4">Nenhum registro efetuado hoje.</p>
        )}
         {todayPunches.map((p, index) => {
           const label = getPunchLabel(p);
           const isEntrance = p.type === 'in' || p.type === 'lunch_end';
           return (
             <div key={p.id} className="glass-panel rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isEntrance ? 'bg-primary/10 text-primary' : 'bg-outline-variant text-on-surface-variant'}`}>
                  {isEntrance ? <LogIn size={20} /> : <LogOut size={20} />}
                </div>
              <span className="text-body-md font-semibold text-on-surface">{label}</span>
              {p.pending && (
                <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  pendente
                </span>
              )}
            </div>
              <div className="flex items-center gap-2 text-body-lg font-bold tabular-nums text-on-surface">
                {p.pending && <CloudUpload size={16} className="text-primary" />}
                {p.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-safe bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="text-headline-sm font-bold text-on-surface mb-3">Confirmar registro</h3>
            <label className="text-body-sm text-on-surface-variant block mb-2">Horario a registrar</label>
            <input
              type="time"
              value={confirmTime}
              onChange={(e) => setConfirmTime(e.target.value)}
              className="w-full bg-surface-variant border border-outline-variant text-on-surface rounded-lg px-3 py-2 mb-6"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 bg-surface-variant text-on-surface py-3 rounded-xl font-bold"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleConfirmPunch}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


