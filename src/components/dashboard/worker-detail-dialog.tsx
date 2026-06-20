'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ExternalLink, MessageSquare, Users } from 'lucide-react';
import { StatusDot } from '@/components/dashboard/status-dot';
import { CopyButton } from '@/components/dashboard/copy-button';
import { MetricsGroup } from '@/components/dashboard/worker-metrics-group';
import { PhaseTimeline } from '@/components/dashboard/phase-timeline';
import {
  WORKER_PHASE_BADGE_CLASSES,
  WORKER_PHASE_LABELS,
  RUNTIME_LABELS,
} from '@/lib/phase-colors';
import type { WorkerResponse } from '@/lib/hiclaw-api';
import { cn } from '@/lib/utils';

interface WorkerDetailDialogProps {
  worker: WorkerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToChat?: (roomID: string) => void;
  onJumpToTeam?: (teamName: string) => void;
}

const SLOW_LOAD_MS = 10_000;

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</h4>
      {children}
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  copy?: boolean;
  action?: { label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void };
}

function Row({ label, value, copy, action }: RowProps) {
  const showCopy = copy && value && value !== '-';
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-b-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
        <span className="font-mono text-xs text-right break-all truncate">{value || '-'}</span>
        {showCopy && <CopyButton value={value} title={`复制 ${label}`} />}
        {action && (
          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5" onClick={action.onClick}>
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function WorkerDetailDialog({ worker, open, onOpenChange, onJumpToChat, onJumpToTeam }: WorkerDetailDialogProps) {
  const [slowAlertShown, setSlowAlertShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setSlowAlertShown(false);
      return;
    }
    setSlowAlertShown(false);
    const t = setTimeout(() => setSlowAlertShown(true), SLOW_LOAD_MS);
    return () => clearTimeout(t);
  }, [open, worker?.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Worker 详情</span>
            {worker && <span className="font-mono text-muted-foreground">· {worker.name}</span>}
          </DialogTitle>
        </DialogHeader>
        {!worker && <p className="text-xs text-muted-foreground py-4">未选择 Worker。</p>}
        {worker && (
          <div className="space-y-3 py-3 text-sm">
            {slowAlertShown && (
              <div className="flex items-start gap-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>数据加载较慢，显示的内容可能不完整。</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <StatusDot phase={worker.phase} />
              <Badge className={cn(WORKER_PHASE_BADGE_CLASSES[worker.phase])} variant="secondary">
                {WORKER_PHASE_LABELS[worker.phase] || worker.phase}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{worker.message || ''}</span>
            </div>

            <Section title="基本信息">
              <Row label="名称" value={worker.name} copy />
              <Row label="状态" value={worker.state} />
              <Row
                label="团队"
                value={worker.team || '-'}
                action={worker.team && onJumpToTeam ? { label: '跳转', icon: Users, onClick: () => onJumpToTeam(worker.team) } : undefined}
              />
              <Row label="角色" value={worker.role || '-'} />
              <Row
                label="房间 ID"
                value={worker.roomID || '-'}
                copy
                action={worker.roomID && onJumpToChat ? { label: '打开聊天', icon: MessageSquare, onClick: () => onJumpToChat(worker.roomID) } : undefined}
              />
            </Section>

            <Section title="运行时配置">
              <Row label="运行时" value={RUNTIME_LABELS[worker.runtime] || worker.runtime} />
              <Row label="模型" value={worker.model} copy />
              <Row label="镜像" value={worker.image} copy />
              <Row label="版本" value={worker.version || '-'} />
              <Row label="容器管理" value={worker.containerManaged ? '是' : '否'} />
              <Row label="容器状态" value={worker.containerState || '-'} />
            </Section>

            <Section title="网络">
              <Row label="Matrix 用户" value={worker.matrixUserID} copy />
              {(worker.exposedPorts?.length ?? 0) > 0 ? (
                <div className="pt-1 space-y-1">
                  <p className="text-xs text-muted-foreground">暴露端口</p>
                  {worker.exposedPorts!.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-1 text-[11px] font-mono">
                      <span className="text-muted-foreground">{p.port} → {p.domain}</span>
                      <div className="flex items-center gap-1">
                        <CopyButton value={`${p.port} -> ${p.domain}`} title="复制端口映射" />
                        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-0.5" onClick={() => window.open(`https://${p.domain}`, '_blank', 'noopener')}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">未暴露端口</p>
              )}
            </Section>

            <Section title="资源指标">
              <MetricsGroup workerName={worker.name} />
            </Section>

            <Section title="活动时间线">
              <PhaseTimeline workerName={worker.name} refetchInterval={5_000} />
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
