import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { VerificationStatus } from '../types.ts';

interface StatusMarkerProps {
  status: VerificationStatus;
  isStale?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; textClass: string; borderClass: string; Icon: typeof CheckCircle2 }
> = {
  SUPPORTED: {
    label: 'Supported',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/25 bg-emerald-500/8',
    Icon: CheckCircle2,
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/25 bg-amber-500/8',
    Icon: AlertTriangle,
  },
  CONFLICT: {
    label: 'Conflict',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/25 bg-red-500/10',
    Icon: ShieldAlert,
  },
  NO_EVIDENCE: {
    label: 'No Evidence',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-600/35 bg-slate-700/20',
    Icon: HelpCircle,
  },
};

export function StatusMarker({ status, isStale = false, compact = false }: StatusMarkerProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${cfg.borderClass} ${cfg.textClass}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{cfg.label}</span>
      </span>
      {isStale && !compact && (
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300">
          <Clock className="h-3 w-3 shrink-0" />
          <span>Stale</span>
        </span>
      )}
    </span>
  );
}
