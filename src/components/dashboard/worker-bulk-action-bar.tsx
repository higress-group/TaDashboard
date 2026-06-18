'use client';

import { useState, useCallback } from 'react';
import {
  Download,
  Moon,
  Sun,
  PowerOff,
  Trash2,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useWorkerBulkAction, type BulkAction } from '@/hooks/use-worker-bulk-action';
import { workersToCsv, workersToJson } from '@/lib/worker-export';
import { downloadText, copyToClipboard } from '@/lib/download';
import { cn } from '@/lib/utils';
import type { WorkerResponse } from '@/lib/hiclaw-api';

interface BulkActionBarProps {
  filteredWorkers: WorkerResponse[];
  filtersActive: boolean;
  onAfter?: () => void;
}

interface ConfirmState {
  action: BulkAction;
  workers: WorkerResponse[];
  /** when set, require the user to type this string to confirm */
  requireText?: string;
  description: string;
}

export function BulkActionBar({ filteredWorkers, filtersActive, onAfter }: BulkActionBarProps) {
  const { execute, running, progress, result, retry, skip, reset } = useWorkerBulkAction({ onAfter });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const ask = useCallback(
    (action: BulkAction, requireText?: string) => {
      if (filteredWorkers.length === 0) return;
      const descriptions: Record<BulkAction, string> = {
        sleep: `对 ${filteredWorkers.length} 个 Worker 执行 sleep 操作，确认？`,
        wake: `对 ${filteredWorkers.length} 个 Worker 执行 wake 操作，确认？`,
        'ensure-ready': `对 ${filteredWorkers.length} 个 Worker 执行 ensure-ready 操作，确认？`,
        delete: `将永久删除 ${filteredWorkers.length} 个 Worker，请输入 "DELETE" 确认：`,
      };
      setConfirmText('');
      setConfirm({ action, workers: filteredWorkers, requireText, description: descriptions[action] });
    },
    [filteredWorkers],
  );

  const doExport = useCallback(
    (format: 'csv' | 'json') => {
      const text = format === 'csv' ? workersToCsv(filteredWorkers) : workersToJson(filteredWorkers);
      const filename = `workers-${new Date().toISOString().slice(0, 10)}.${format}`;
      const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
      void downloadText(filename, text, mime);
    },
    [filteredWorkers],
  );

  const doCopyJson = useCallback(async () => {
    await copyToClipboard(workersToJson(filteredWorkers));
  }, [filteredWorkers]);

  const doExecute = useCallback(async () => {
    if (!confirm) return;
    if (confirm.requireText && confirmText !== confirm.requireText) return;
    const action = confirm.action;
    setConfirm(null);
    setConfirmText('');
    await execute(confirm.workers, action);
  }, [confirm, confirmText, execute]);

  const count = filteredWorkers.length;
  const showProgress = running && progress.total > 0;
  const showResult = !running && result && (result.successes.length > 0 || result.failures.length > 0);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={count === 0}
            className={cn('h-7 text-xs gap-1', filtersActive && 'ring-1 ring-primary/40')}
          >
            <Download className="w-3 h-3" />
            批量操作
            <span className="text-[10px] text-muted-foreground">({count})</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-[10px]">生命周期</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => ask('wake')} disabled={count === 0}>
            <Sun className="w-3.5 h-3.5 mr-2" /> 批量 wake
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => ask('sleep')} disabled={count === 0}>
            <Moon className="w-3.5 h-3.5 mr-2" /> 批量 sleep
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => ask('ensure-ready')} disabled={count === 0}>
            <PlayCircle className="w-3.5 h-3.5 mr-2" /> 批量 ensure-ready
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">危险</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => ask('delete', 'DELETE')}
            disabled={count === 0}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" /> 批量删除
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px]">导出当前过滤</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => doExport('csv')} disabled={count === 0}>
            <Download className="w-3.5 h-3.5 mr-2" /> 下载 CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => doExport('json')} disabled={count === 0}>
            <Download className="w-3.5 h-3.5 mr-2" /> 下载 JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={doCopyJson} disabled={count === 0}>
            <Download className="w-3.5 h-3.5 mr-2" /> 复制 JSON 到剪贴板
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量操作</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {confirm?.requireText && (
            <div className="py-2">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={confirm.requireText}
                className="font-mono"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={doExecute}
              disabled={!!confirm?.requireText && confirmText !== confirm.requireText}
              className={cn(confirm?.action === 'delete' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            >
              {confirm?.action === 'delete' ? '确认删除' : '确认执行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(showProgress || showResult) && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(360px,90vw)] rounded-xl border border-border bg-card shadow-lg p-3 text-xs space-y-2" role="status" aria-live="polite" aria-busy={running}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">批量操作进度</p>
            {!running && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={reset} aria-label="关闭">
                <XCircle className="w-3 h-3" />
              </Button>
            )}
          </div>
          {showProgress && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>已完成 {progress.done} / {progress.total}</span>
                <span>{progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {showResult && (
            <>
              {result!.successes.length > 0 && (
                <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> 成功 {result!.successes.length} 个
                </p>
              )}
              {result!.failures.length > 0 && (
                <div className="space-y-1">
                  <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <PowerOff className="w-3 h-3" /> 失败 {result!.failures.length} 个
                  </p>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {result!.failures.map((f) => (
                      <li key={f.worker.name} className="flex items-center justify-between gap-2 bg-muted/40 rounded px-2 py-1">
                        <span className="font-mono truncate">{f.worker.name}</span>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => retry(f)}>
                            重试
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-muted-foreground" onClick={() => skip(f.worker.name)}>
                            跳过
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
