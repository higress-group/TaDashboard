'use client';

import type { WorkerPhase, ManagerPhase, TeamPhase, HumanPhase } from '@/lib/hiclaw-api';

type StatusPhase = WorkerPhase | ManagerPhase | TeamPhase | HumanPhase;

export function StatusDot({ phase }: { phase: StatusPhase }) {
  let dotClass = 'bg-gray-400';
  let pulseClass = '';

  switch (phase) {
    case 'Running':
    case 'Ready':
    case 'Active':
      dotClass = 'bg-emerald-500';
      pulseClass = 'status-dot-green';
      break;
    case 'Sleeping':
    case 'Pending':
    case 'Updating':
      dotClass = 'bg-amber-500';
      pulseClass = 'status-dot-amber';
      break;
    case 'Failed':
    case 'Degraded':
      dotClass = 'bg-red-500';
      pulseClass = 'status-dot-red';
      break;
    case 'Stopped':
      dotClass = 'bg-gray-400';
      break;
  }

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${dotClass} ${pulseClass}`} />
  );
}
