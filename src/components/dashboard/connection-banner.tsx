'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHiClawStore } from '@/lib/hiclaw-store';
import { WifiOff, Settings, RefreshCw, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConnectionBanner() {
  const {
    isConnected,
    isChecking,
    connectionError,
    controllerUrl,
    autoReconnect,
    reconnectInterval,
    checkConnection,
    openSettings,
  } = useHiClawStore();

  const intervalSec = Math.round(reconnectInterval / 1000);
  const startTimeRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  // Tick every second when disconnected
  useEffect(() => {
    if (isConnected || !autoReconnect) {
      return undefined;
    }

    startTimeRef.current = Date.now();

    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, autoReconnect, reconnectInterval]);

  // Compute countdown from elapsed time
  const countdown = (() => {
    if (isConnected || !autoReconnect || !startTimeRef.current) return 0;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const remaining = intervalSec - (elapsed % intervalSec);
    return remaining === intervalSec ? intervalSec : remaining;
  })();

  const handleRetry = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  if (isConnected) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 min-w-0">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="font-medium shrink-0">未连接到 HiClaw Controller</span>
        <span className="text-amber-500/70 truncate text-xs">({controllerUrl})</span>
        {connectionError && (
          <span className="text-amber-500/70 text-xs shrink-0">- {connectionError}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Auto-reconnect indicator */}
        {autoReconnect && !isChecking && countdown > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500/80">
            <Clock className="w-3 h-3" />
            <span>{countdown}s</span>
          </div>
        )}
        {isChecking && (
          <div className="flex items-center gap-1.5 text-xs text-amber-500/80">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>连接中...</span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isChecking}
          className="h-7 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
          重试
        </Button>
        <Button variant="outline" size="sm" onClick={openSettings} className="h-7 text-xs">
          <Settings className="w-3 h-3 mr-1" />
          设置
        </Button>
      </div>
    </div>
  );
}
