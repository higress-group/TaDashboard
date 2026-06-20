'use client';

import { memo } from 'react';
import { CopyButton } from '@/components/dashboard/copy-button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TruncatedIdProps {
  value: string;
  label: string;
}

function TruncatedIdImpl({ value, label }: TruncatedIdProps) {
  if (!value || value === '-') {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const truncated = value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
  return (
    <div className="flex items-center gap-1 min-w-0 ml-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-xs truncate max-w-[60%] cursor-help">{truncated}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs break-all">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">点击复制按钮复制完整 {label}</p>
        </TooltipContent>
      </Tooltip>
      <CopyButton text={value} />
    </div>
  );
}

// Used in tables that re-render on any data update. memo skips work
// when neither value nor label changed.
export const TruncatedId = memo(TruncatedIdImpl);
