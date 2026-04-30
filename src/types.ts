export interface Punch {
  id: string;
  timestamp: Date;
  type: 'in' | 'out' | 'lunch_start' | 'lunch_end';
  pending?: boolean;
}

export interface PendingPunch {
  id: string;
  timestamp: string;
  type: 'in' | 'out' | 'lunch_start' | 'lunch_end';
}
