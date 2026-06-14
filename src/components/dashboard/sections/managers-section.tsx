'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  Plus,
  Trash2,
  Eye,
  Pencil,
  Download,
  LayoutGrid,
  List,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useManagers } from '@/hooks/use-hiclaw-managers';
import { useWorkers } from '@/hooks/use-hiclaw-workers';
import { useTeams } from '@/hooks/use-hiclaw-teams';
import { useCreateManager, useDeleteManager, useUpdateManager } from '@/hooks/use-hiclaw-mutations';
import { useSearch } from '@/lib/search-context';
import { useHiClawStore } from '@/lib/hiclaw-store';
import {
  MANAGER_PHASE_BADGE_CLASSES,
  MANAGER_PHASE_LABELS,
  RUNTIME_LABELS,
  WORKER_PHASE_BADGE_CLASSES,
} from '@/lib/phase-colors';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { StatusDot } from '@/components/dashboard/status-dot';
import { SectionHeader } from '@/components/dashboard/section-header';
import { TruncatedId } from '@/components/dashboard/truncated-id';
import { CopyButton } from '@/components/dashboard/copy-button';
import { toast } from 'sonner';
import type { ManagerResponse, ManagerPhase, ManagerState, CreateManagerRequest, UpdateManagerRequest } from '@/lib/hiclaw-api';

// ============ Sort Types ============
type SortKey = 'name' | 'phase' | 'runtime';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: '按名称' },
  { value: 'phase', label: '按阶段' },
  { value: 'runtime', label: '按运行时' },
];

// Derive manager skills dynamically from runtime type and configuration
function getManagerSkills(manager: ManagerResponse): string[] {
  // If the API returns an explicit skills array, use it
  const mAny = manager as Record<string, unknown>;
  if (Array.isArray(mAny.skills)) return mAny.skills as string[];

  // Otherwise derive from runtime type
  const runtime = (manager.runtime || '').toLowerCase();
  const skills: string[] = [];
  if (runtime.includes('openclaw')) {
    skills.push('task_assignment', 'worker_coordination', 'progress_tracking', 'result_aggregation');
  } else if (runtime.includes('copaw')) {
    skills.push('team_formation', 'conflict_resolution', 'load_balancing', 'skill_matching');
  } else if (runtime.includes('hermes')) {
    skills.push('communication_relay', 'message_routing', 'realtime_coordination', 'stream_processing');
  } else if (runtime.includes('openhuman')) {
    skills.push('human_approval', 'escalation', 'quality_assurance', 'audit_logging');
  } else {
    skills.push('coordination', 'scheduling');
  }

  // Common manager skills
  skills.push('health_monitoring', 'error_recovery');
  return skills;
}

export function ManagersSection() {
  const { data: managers, isLoading, isError, refetch, isRefetching } = useManagers();
  const { data: workers } = useWorkers();
  const { data: teams } = useTeams();
  const { searchQuery } = useSearch();
  const { isConnected } = useHiClawStore();
  const createManager = useCreateManager();
  const deleteManager = useDeleteManager();
  const updateManager = useUpdateManager();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailManager, setDetailManager] = useState<ManagerResponse | null>(null);
  const [editManager, setEditManager] = useState<ManagerResponse | null>(null);

  const [newManager, setNewManager] = useState<CreateManagerRequest>({ name: '' });
  const [editForm, setEditForm] = useState<UpdateManagerRequest & { name?: string; state?: string }>({});

  // Sort & view
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const filteredManagers = useMemo(() => {
    if (!managers) return [];
    if (!searchQuery) return managers;
    const q = searchQuery.toLowerCase();
    return managers.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.model || '').toLowerCase().includes(q) ||
        (m.runtime || '').toLowerCase().includes(q)
    );
  }, [managers, searchQuery]);

  // Sort
  const sortedManagers = useMemo(() => {
    const sorted = [...filteredManagers];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'phase':
          return (a.phase || '').localeCompare(b.phase || '');
        case 'runtime':
          return (a.runtime || '').localeCompare(b.runtime || '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredManagers, sortKey]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (!managers) return;
    const data = JSON.stringify(managers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hiclaw-managers-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Managers 数据已导出');
  }, [managers]);

  const handleCreate = () => {
    createManager.mutate(newManager, {
      onSuccess: () => {
        setCreateOpen(false);
        setNewManager({ name: '' });
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteManager.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const openEdit = (manager: ManagerResponse) => {
    setEditManager(manager);
    setEditForm({
      name: manager.name,
      model: manager.model || '',
      runtime: manager.runtime || '',
      image: manager.image || '',
      state: manager.state,
    });
  };

  const handleUpdate = () => {
    if (!editManager) return;
    const { name: _, state: __, ...data } = editForm;
    updateManager.mutate(
      { name: editManager.name, data: data as UpdateManagerRequest },
      {
        onSuccess: () => {
          setEditManager(null);
          setEditForm({});
        },
      }
    );
  };

  if (isError && !isConnected) {
    return <ApiErrorState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Managers"
        description="管理团队领导和协调者"
        isLive={isConnected}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!managers || managers.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              导出 JSON
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              创建 Manager
            </Button>
          </div>
        }
      />

      {/* Toolbar: Sort + View Toggle */}
      {sortedManagers.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'card' | 'table')}>
              <TabsList className="h-8">
                <TabsTrigger value="card" className="px-2 py-1 text-xs gap-1">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  卡片
                </TabsTrigger>
                <TabsTrigger value="table" className="px-2 py-1 text-xs gap-1">
                  <List className="w-3.5 h-3.5" />
                  表格
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      )}

      {/* Managers List */}
      {isLoading ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 w-32 rounded shimmer" />
                  <div className="h-4 w-24 rounded shimmer" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-full rounded shimmer" />
              ))}
            </CardContent>
          </Card>
        )
      ) : sortedManagers.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? '没有匹配的 Manager' : '暂无 Manager'}
            </p>
            {!searchQuery && (
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                创建第一个 Manager
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedManagers.map((manager, i) => (
                <motion.div
                  key={manager.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <Card className="glass-card hover-lift">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot phase={manager.phase} />
                          <Crown className="w-5 h-5 text-violet-500 shrink-0" />
                          <span className="font-medium truncate">{manager.name}</span>
                        </div>
                        <Badge className={MANAGER_PHASE_BADGE_CLASSES[manager.phase]} variant="secondary">
                          {MANAGER_PHASE_LABELS[manager.phase] || manager.phase}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        {/* Model - prominently displayed */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">模型</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs font-semibold truncate ml-2 cursor-help text-foreground">
                                {manager.model || '-'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>完整模型名: {manager.model || '未设置'}</TooltipContent>
                          </Tooltip>
                        </div>
                        {/* Runtime Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">运行时</span>
                          <Badge variant="outline" className="text-xs">
                            {RUNTIME_LABELS[manager.runtime] || manager.runtime || '-'}
                          </Badge>
                        </div>
                        {/* Welcome Sent Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">欢迎消息</span>
                          {manager.welcomeSent ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-xs text-green-600 dark:text-green-400">已发送</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">未发送</span>
                            </div>
                          )}
                        </div>
                        {/* Matrix User ID - truncated with copy */}
                        {manager.matrixUserID && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Matrix ID</span>
                            <TruncatedId value={manager.matrixUserID} label="Matrix 用户 ID" />
                          </div>
                        )}
                        {/* Room ID - truncated with copy */}
                        {manager.roomID && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">房间 ID</span>
                            <TruncatedId value={manager.roomID} label="房间 ID" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => setDetailManager(manager)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          详情
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEdit(manager)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(manager.name)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <Card className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>阶段</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>运行时</TableHead>
                    <TableHead>欢迎消息</TableHead>
                    <TableHead>Matrix ID</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedManagers.map((manager) => (
                    <TableRow key={manager.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot phase={manager.phase} />
                          <Crown className="w-4 h-4 text-violet-500 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{manager.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={MANAGER_PHASE_BADGE_CLASSES[manager.phase]} variant="secondary">
                          {MANAGER_PHASE_LABELS[manager.phase] || manager.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-xs truncate max-w-[150px] block cursor-help">
                              {manager.model || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>完整模型名: {manager.model || '未设置'}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {RUNTIME_LABELS[manager.runtime] || manager.runtime || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {manager.welcomeSent ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">已发送</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">未发送</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {manager.matrixUserID ? (
                          <TruncatedId value={manager.matrixUserID} label="Matrix 用户 ID" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailManager(manager)}
                            title="查看详情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(manager)}
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(manager.name)}
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Create Manager Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>创建 Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={newManager.name}
                onChange={(e) => setNewManager({ ...newManager, name: e.target.value })}
                placeholder="manager-name"
              />
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <Input
                value={newManager.model || ''}
                onChange={(e) => setNewManager({ ...newManager, model: e.target.value })}
                placeholder="gpt-4 / claude-3 等"
              />
            </div>
            <div className="space-y-2">
              <Label>运行时</Label>
              <Input
                value={newManager.runtime || ''}
                onChange={(e) => setNewManager({ ...newManager, runtime: e.target.value })}
                placeholder="运行时名称（可选）"
              />
            </div>
            <div className="space-y-2">
              <Label>镜像</Label>
              <Input
                value={newManager.image || ''}
                onChange={(e) => setNewManager({ ...newManager, image: e.target.value })}
                placeholder="容器镜像地址（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              onClick={handleCreate}
              disabled={!newManager.name || createManager.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {createManager.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={!!editManager} onOpenChange={() => { setEditManager(null); setEditForm({}); }}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>编辑 Manager - {editManager?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模型</Label>
              <Input
                value={editForm.model || ''}
                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                placeholder="gpt-4 / claude-3 等"
              />
            </div>
            <div className="space-y-2">
              <Label>运行时</Label>
              <Input
                value={editForm.runtime || ''}
                onChange={(e) => setEditForm({ ...editForm, runtime: e.target.value })}
                placeholder="运行时名称"
              />
            </div>
            <div className="space-y-2">
              <Label>镜像</Label>
              <Input
                value={editForm.image || ''}
                onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                placeholder="容器镜像地址"
              />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={editForm.state || ''}
                onValueChange={(v) => setEditForm({ ...editForm, state: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Running">Running</SelectItem>
                  <SelectItem value="Sleeping">Sleeping</SelectItem>
                  <SelectItem value="Stopped">Stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditManager(null); setEditForm({}); }}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateManager.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {updateManager.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 Manager &quot;{deleteTarget}&quot; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manager Detail Dialog */}
      <Dialog open={!!detailManager} onOpenChange={() => setDetailManager(null)}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manager 详情 - {detailManager?.name}</DialogTitle>
          </DialogHeader>
          {detailManager && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2 mb-3">
                <StatusDot phase={detailManager.phase} />
                <Badge className={MANAGER_PHASE_BADGE_CLASSES[detailManager.phase]} variant="secondary">
                  {MANAGER_PHASE_LABELS[detailManager.phase] || detailManager.phase}
                </Badge>
              </div>
              {[
                ['名称', detailManager.name],
                ['状态', detailManager.state],
                ['模型', detailManager.model || '-'],
                ['运行时', RUNTIME_LABELS[detailManager.runtime] || detailManager.runtime || '-'],
                ['镜像', detailManager.image || '-'],
                ['版本', detailManager.version || '-'],
                ['欢迎消息', detailManager.welcomeSent ? '已发送' : '未发送'],
                ['消息', detailManager.message || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs max-w-[60%] text-right break-all">{value}</span>
                </div>
              ))}
              {/* Matrix User ID with copy */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Matrix 用户</span>
                {detailManager.matrixUserID ? (
                  <div className="flex items-center gap-1 min-w-0 max-w-[60%]">
                    <span className="font-mono text-xs truncate">{detailManager.matrixUserID}</span>
                    <CopyButton text={detailManager.matrixUserID} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              {/* Room ID with copy */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">房间 ID</span>
                {detailManager.roomID ? (
                  <div className="flex items-center gap-1 min-w-0 max-w-[60%]">
                    <span className="font-mono text-xs truncate">{detailManager.roomID}</span>
                    <CopyButton text={detailManager.roomID} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">技能</p>
                <div className="flex flex-wrap gap-1">
                  {getManagerSkills(detailManager).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-[10px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">协调的团队</p>
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const managedTeams = teams?.filter((t) => t.leaderName === detailManager.name) || [];
                    return managedTeams.length > 0 ? managedTeams.map((t) => (
                      <Badge key={t.name} variant="secondary" className="text-xs gap-1">
                        {t.name}
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                          {t.readyWorkers}/{t.totalWorkers}
                        </Badge>
                      </Badge>
                    )) : <span className="text-xs text-muted-foreground">-</span>;
                  })()}
                </div>
              </div>
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">协调的 Workers</p>
                <div className="flex flex-wrap gap-1">
                  {(() => {
                    const managedTeamNames = new Set(
                      teams?.filter((t) => t.leaderName === detailManager.name).map((t) => t.name) || []
                    );
                    const managedWorkers = workers?.filter((w) => managedTeamNames.has(w.team)) || [];
                    return managedWorkers.length > 0 ? managedWorkers.map((w) => (
                      <Badge key={w.name} variant="secondary" className={`text-xs ${WORKER_PHASE_BADGE_CLASSES[w.phase] || ''}`}>
                        {w.name}
                      </Badge>
                    )) : <span className="text-xs text-muted-foreground">-</span>;
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
