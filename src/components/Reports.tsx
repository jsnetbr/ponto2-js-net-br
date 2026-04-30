import { CheckCircle2, AlertCircle } from 'lucide-react';
import React, { useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { formatMinutes, calculateWorkedMs, toDateKey } from '../utils';

export function Reports() {
  const { expectedMinutes, punches } = useAppContext();

  const balanceMins = useMemo(() => {
    const groupsByDay: Record<string, typeof punches> = {};
    punches.forEach((p) => {
      const dateKey = toDateKey(p.timestamp);
      if (!groupsByDay[dateKey]) groupsByDay[dateKey] = [];
      groupsByDay[dateKey].push(p);
    });

    let workedTotal = 0;
    let closedDays = 0;

    Object.keys(groupsByDay).forEach((dateKey) => {
      const dayPunches = groupsByDay[dateKey].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const hasOpenPunch = dayPunches.length % 2 !== 0;
      if (hasOpenPunch) return;

      const ms = calculateWorkedMs(dayPunches, dayPunches[dayPunches.length - 1].timestamp.getTime());
      const mins = Math.floor(ms / 60000);
      workedTotal += mins;
      if (mins > 0) closedDays += 1;
    });

    const expectedTotal = expectedMinutes * closedDays;
    return workedTotal - expectedTotal;
  }, [punches, expectedMinutes]);

  const balanceFmt = formatMinutes(balanceMins, true);

  return (
    <div className="pt-12 md:pt-32 pb-32 px-6 max-w-5xl mx-auto flex flex-col gap-8 relative z-10 w-full">
      <div className="mb-4">
        <h2 className="text-display-lg text-on-surface">Relatorios</h2>
        <p className="text-body-md text-on-surface-variant mt-2">Metricas de rendimento reais gerais.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="glass-panel rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group max-w-sm">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500"></div>
          <h3 className="text-body-sm font-bold text-on-surface-variant mb-2">BANCO DE HORAS</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-display-lg font-bold ${balanceMins >= 0 ? 'text-primary' : 'text-error'}`}>
              {balanceFmt}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-4 text-label-sm font-medium">
            <span className={`flex items-center gap-1 ${balanceMins >= 0 ? 'text-primary bg-primary/10' : 'text-error bg-error/10'} px-2 py-1 rounded-full`}>
              {balanceMins >= 0 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {balanceMins >= 0 ? 'Banco Positivo' : 'Banco Negativo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
