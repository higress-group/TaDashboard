'use client';

import { WifiOff, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHiClawStore } from '@/lib/hiclaw-store';
import { useQueryClient } from '@tanstack/react-query';

interface ApiErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ApiErrorState({ message, onRetry }: ApiErrorStateProps) {
  const { openSettings } = useHiClawStore();
  const queryClient = useQueryClient();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      queryClient.invalidateQueries();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <WifiOff className="w-8 h-8 text-amber-500" />
      </div>
      <p className="text-lg font-medium mb-1">未连接到 HiClaw Controller</p>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
        {message || '无法连接到 HiClaw Controller，请检查网络连接和 Controller 地址配置'}
      </p>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={openSettings}>
          <Settings className="w-4 h-4 mr-1.5" />
          连接设置
        </Button>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="w-4 h-4 mr-1.5" />
          重试
        </Button>
      </div>
    </div>
  );
}
