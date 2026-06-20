'use client';

import { memo } from 'react';
import type { WorkerPhase, ManagerPhase, TeamPhase, HumanPhase } from '@/lib/hiclaw-api';

type StatusPhase = WorkerPhase | ManagerPhase | TeamPhase | HumanPhase;

function StatusDotImpl({ phase }: { phase: StatusPhase }) {
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

// Pure prop (string literal), no state, 26+ usages across sections.
// React.memo skips re-renders when the phase string reference is
// unchanged (typical when only a single worker's data updates).
export const StatusDot = memo(StatusDotImpl);
