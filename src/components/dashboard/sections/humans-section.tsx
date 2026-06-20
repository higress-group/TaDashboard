'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  UserCheck,
  Plus,
  Trash2,
  Eye,
  Download,
  Pencil,
  LayoutGrid,
  List,
  ArrowUpDown,
  Lock,
  Mail,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/dashboard/copy-button';
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
import { useHumans } from '@/hooks/use-hiclaw-humans';
import { useCreateHuman, useDeleteHuman, useUpdateHuman } from '@/hooks/use-hiclaw-mutations';
import { useSearch } from '@/lib/search-context';
import { useHiClawStore } from '@/lib/hiclaw-store';
import {
  HUMAN_PHASE_BADGE_CLASSES,
  HUMAN_PHASE_LABELS,
} from '@/lib/phase-colors';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { StatusDot } from '@/components/dashboard/status-dot';
import { SectionHeader } from '@/components/dashboard/section-header';
import { SurfaceEmptyState, SurfaceShell, SurfaceSkeletonGrid } from '@/components/dashboard/surface-shell';
import { toast } from 'sonner';
import type { HumanResponse, CreateHumanRequest, UpdateHumanRequest } from '@/lib/hiclaw-api';

// ============ Sort Types ============
type SortKey = 'name' | 'phase';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: '按名称' },
  { value: 'phase', label: '按阶段' },
];

// ============ Permission Level Labels ============
const PERMISSION_LABELS: Record<number, string> = {
  1: '观察者',
  2: '操作者',
  3: '管理员',
};

const PERMISSION_BADGE_CLASSES: Record<number, string> = {
  1: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  2: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  3: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function HumansSection() {
  const { data: humans, isLoading, isError, refetch, isRefetching } = useHumans();
  const { searchQuery } = useSearch();
  const { isConnected } = useHiClawStore();
  const createHuman = useCreateHuman();
  const deleteHuman = useDeleteHuman();
  const updateHuman = useUpdateHuman();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailHuman, setDetailHuman] = useState<HumanResponse | null>(null);
  const [editHuman, setEditHuman] = useState<HumanResponse | null>(null);

  const [newHuman, setNewHuman] = useState<CreateHumanRequest>({
    name: '',
    displayName: '',
    permissionLevel: 1,
  });

  const [editForm, setEditForm] = useState<UpdateHumanRequest & { name?: string }>({});

  // Sort & view
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Filter by search
  const filteredHumans = useMemo(() => {
    if (!humans) return [];
    if (!searchQuery) return humans;
    const q = searchQuery.toLowerCase();
    return humans.filter(
      (h) =>
        (h.name || '').toLowerCase().includes(q) ||
        (h.displayName || '').toLowerCase().includes(q) ||
        (h.email || '').toLowerCase().includes(q) ||
        (h.matrixUserID || '').toLowerCase().includes(q)
    );
  }, [humans, searchQuery]);

  // Sort
  const sortedHumans = useMemo(() => {
    const sorted = [...filteredHumans];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'phase':
          return (a.phase || '').localeCompare(b.phase || '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredHumans, sortKey]);

  // Stats
  const phaseStats = useMemo(() => {
    const stats: Record<string, number> = { Active: 0, Pending: 0, Failed: 0 };
    humans?.forEach((h) => {
      stats[h.phase] = (stats[h.phase] || 0) + 1;
    });
    return stats;
  }, [humans]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (!humans) return;
    const data = JSON.stringify(humans, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hiclaw-humans-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Humans 数据已导出');
  }, [humans]);

  const handleCreate = () => {
    createHuman.mutate(newHuman, {
      onSuccess: () => {
        setCreateOpen(false);
        setNewHuman({ name: '', displayName: '', permissionLevel: 1 });
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteHuman.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const openEdit = (human: HumanResponse) => {
    setEditHuman(human);
    setEditForm({
      name: human.name,
      displayName: human.displayName || '',
      email: human.email || '',
      permissionLevel: ((human.permissionLevel ?? 1) as 1 | 2 | 3),
      accessibleTeams: human.accessibleTeams || [],
      accessibleWorkers: human.accessibleWorkers || [],
      note: human.note || '',
    });
  };

  const handleUpdate = () => {
    if (!editHuman) return;
    const { name: _, ...data } = editForm;
    updateHuman.mutate(
      { name: editHuman.name, data: data as UpdateHumanRequest },
      {
        onSuccess: () => {
          setEditHuman(null);
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
        title="Humans"
        description="管理人类用户和权限"
        isLive={isConnected}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!humans || humans.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              导出 JSON
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              创建 Human
            </Button>
          </div>
        }
      />

      {/* Phase Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { key: 'Active', label: '活跃', icon: UserCheck, color: 'text-green-500' },
          { key: 'Pending', label: '等待中', icon: UserCheck, color: 'text-yellow-500' },
          { key: 'Failed', label: '失败', icon: UserCheck, color: 'text-red-500' },
        ].map(({ key, label, icon: Icon, color }) => (
          <SurfaceShell key={key} contentClassName="p-3 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-bold">{phaseStats[key] || 0}</p>
            </div>
          </SurfaceShell>
        ))}
      </div>

      {/* Toolbar: Sort + View Toggle */}
      {sortedHumans.length > 0 && (
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

      {/* Humans List */}
      {isLoading ? (
        viewMode === 'card' ? (
          <SurfaceSkeletonGrid count={3} cols={3} rows={2} />
        ) : (
          <SurfaceShell contentClassName="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-full rounded shimmer" />
            ))}
          </SurfaceShell>
        )
      ) : sortedHumans.length === 0 ? (
        <SurfaceEmptyState
          icon={<UserCheck className="w-12 h-12" />}
          message={searchQuery ? '没有匹配的 Human' : '暂无 Human'}
          action={
            !searchQuery ? (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                创建第一个 Human
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedHumans.map((human, i) => (
                <motion.div
                  key={human.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <SurfaceShell hover contentClassName="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot phase={human.phase} />
                        <UserCheck className="w-5 h-5 text-teal-500 shrink-0" />
                        <span className="font-medium truncate">{human.name}</span>
                      </div>
                      <Badge className={HUMAN_PHASE_BADGE_CLASSES[human.phase]} variant="secondary">
                        {HUMAN_PHASE_LABELS[human.phase] || human.phase}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">显示名称</span>
                        <span className="text-xs truncate ml-2">{human.displayName}</span>
                      </div>
                      {human.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">邮箱</span>
                          <span className="text-xs truncate ml-2">{human.email}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">权限</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${PERMISSION_BADGE_CLASSES[human.permissionLevel || 1] || ''}`}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {PERMISSION_LABELS[human.permissionLevel || 1] || `L${human.permissionLevel || 1}`}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">房间</span>
                        <span className="text-xs text-muted-foreground">{human.rooms?.length || 0} 个</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => setDetailHuman(human)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        详情
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEdit(human)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(human.name)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </SurfaceShell>
                </motion.div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <SurfaceShell contentClassName="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>显示名称</TableHead>
                    <TableHead>阶段</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>房间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHumans.map((human) => (
                    <TableRow key={human.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot phase={human.phase} />
                          <UserCheck className="w-4 h-4 text-teal-500 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{human.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs truncate max-w-[120px] block">{human.displayName}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={HUMAN_PHASE_BADGE_CLASSES[human.phase]} variant="secondary">
                          {HUMAN_PHASE_LABELS[human.phase] || human.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${PERMISSION_BADGE_CLASSES[human.permissionLevel || 1] || ''}`}
                        >
                          {PERMISSION_LABELS[human.permissionLevel || 1] || `L${human.permissionLevel || 1}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {human.email ? (
                          <span className="text-xs truncate max-w-[150px] block">{human.email}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{human.rooms?.length || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailHuman(human)}
                            title="查看详情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(human)}
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(human.name)}
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
            </SurfaceShell>
          )}
        </>
      )}

      {/* Create Human Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>创建 Human</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={newHuman.name}
                onChange={(e) => setNewHuman({ ...newHuman, name: e.target.value })}
                placeholder="human-name"
              />
            </div>
            <div className="space-y-2">
              <Label>显示名称 *</Label>
              <Input
                value={newHuman.displayName}
                onChange={(e) => setNewHuman({ ...newHuman, displayName: e.target.value })}
                placeholder="用户显示名称"
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                value={newHuman.email || ''}
                onChange={(e) => setNewHuman({ ...newHuman, email: e.target.value || undefined })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>权限等级</Label>
              <Select
                value={String(newHuman.permissionLevel || 1)}
                onValueChange={(v) => setNewHuman({ ...newHuman, permissionLevel: Number(v) as 1 | 2 | 3 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - 观察者</SelectItem>
                  <SelectItem value="2">2 - 操作者</SelectItem>
                  <SelectItem value="3">3 - 管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>可访问团队（逗号分隔）</Label>
              <Input
                value={newHuman.accessibleTeams?.join(', ') || ''}
                onChange={(e) => setNewHuman({
                  ...newHuman,
                  accessibleTeams: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="team1, team2, team3"
              />
            </div>
            <div className="space-y-2">
              <Label>可访问 Workers（逗号分隔）</Label>
              <Input
                value={newHuman.accessibleWorkers?.join(', ') || ''}
                onChange={(e) => setNewHuman({
                  ...newHuman,
                  accessibleWorkers: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="worker1, worker2, worker3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              onClick={handleCreate}
              disabled={!newHuman.name || !newHuman.displayName || createHuman.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {createHuman.isPending ? '创建中...' : '创建'}
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
              确定要删除 Human &quot;{deleteTarget}&quot; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteHuman.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteHuman.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteHuman.isPending ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Human Dialog */}
      <Dialog open={!!editHuman} onOpenChange={() => { setEditHuman(null); setEditForm({}); }}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>编辑 Human - {editHuman?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>显示名称</Label>
              <Input
                value={editForm.displayName || ''}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                placeholder="用户显示名称"
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value || undefined })}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>权限等级</Label>
              <Select
                value={String(editForm.permissionLevel || 1)}
                onValueChange={(v) => setEditForm({ ...editForm, permissionLevel: Number(v) as 1 | 2 | 3 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - 观察者</SelectItem>
                  <SelectItem value="2">2 - 操作者</SelectItem>
                  <SelectItem value="3">3 - 管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>可访问团队（逗号分隔）</Label>
              <Input
                value={editForm.accessibleTeams?.join(', ') || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  accessibleTeams: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="team1, team2, team3"
              />
            </div>
            <div className="space-y-2">
              <Label>可访问 Workers（逗号分隔）</Label>
              <Input
                value={editForm.accessibleWorkers?.join(', ') || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  accessibleWorkers: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="worker1, worker2, worker3"
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                value={editForm.note || ''}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value || undefined })}
                placeholder="备注信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditHuman(null); setEditForm({}); }}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateHuman.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {updateHuman.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Human Detail Dialog */}
      <Dialog open={!!detailHuman} onOpenChange={() => setDetailHuman(null)}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Human 详情 - {detailHuman?.name}</DialogTitle>
          </DialogHeader>
          {detailHuman && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2 mb-3">
                <StatusDot phase={detailHuman.phase} />
                <Badge className={HUMAN_PHASE_BADGE_CLASSES[detailHuman.phase]} variant="secondary">
                  {HUMAN_PHASE_LABELS[detailHuman.phase] || detailHuman.phase}
                </Badge>
              </div>
              {[
                ['名称', detailHuman.name],
                ['显示名称', detailHuman.displayName],
                ['阶段', detailHuman.phase],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs max-w-[60%] text-right break-all">{value}</span>
                </div>
              ))}
              {/* Matrix User ID with copy */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Matrix 用户</span>
                {detailHuman.matrixUserID ? (
                  <div className="flex items-center gap-1 min-w-0 max-w-[60%]">
                    <span className="font-mono text-xs truncate">{detailHuman.matrixUserID}</span>
                    <CopyButton text={detailHuman.matrixUserID} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              {/* Initial Password with copy and warning */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">初始密码</span>
                {detailHuman.initialPassword ? (
                  <div className="flex items-center gap-1 min-w-0 max-w-[60%]">
                    <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      敏感
                    </Badge>
                    <span className="font-mono text-xs truncate">{detailHuman.initialPassword}</span>
                    <CopyButton text={detailHuman.initialPassword} />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              {/* Email */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">邮箱</span>
                {detailHuman.email ? (
                  <div className="flex items-center gap-1 min-w-0 max-w-[60%]">
                    <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{detailHuman.email}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
              {/* Permission Level */}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">权限等级</span>
                <Badge
                  variant="outline"
                  className={`text-xs ${PERMISSION_BADGE_CLASSES[detailHuman.permissionLevel || 1] || ''}`}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {detailHuman.permissionLevel || 1} - {PERMISSION_LABELS[detailHuman.permissionLevel || 1]}
                </Badge>
              </div>
              {/* Message */}
              {detailHuman.message && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">消息</span>
                  <span className="font-mono text-xs max-w-[60%] text-right break-all">{detailHuman.message}</span>
                </div>
              )}
              {/* Accessible Teams */}
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">可访问团队</p>
                <div className="flex flex-wrap gap-1">
                  {detailHuman.accessibleTeams && detailHuman.accessibleTeams.length > 0 ? (
                    detailHuman.accessibleTeams.map((team) => (
                      <Badge key={team} variant="outline" className="text-xs">
                        {team}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              {/* Accessible Workers */}
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">可访问 Workers</p>
                <div className="flex flex-wrap gap-1">
                  {detailHuman.accessibleWorkers && detailHuman.accessibleWorkers.length > 0 ? (
                    detailHuman.accessibleWorkers.map((worker) => (
                      <Badge key={worker} variant="outline" className="text-xs">
                        {worker}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              {/* Rooms */}
              <div className="pt-2">
                <p className="text-muted-foreground mb-2">房间 ({detailHuman.rooms?.length || 0})</p>
                <div className="max-h-32 overflow-y-auto custom-scrollbar">
                  <div className="flex flex-wrap gap-1">
                    {detailHuman.rooms && detailHuman.rooms.length > 0 ? (
                      detailHuman.rooms.map((room) => (
                        <Badge key={room} variant="secondary" className="text-[10px] font-mono">
                          {room.length > 20 ? `${room.slice(0, 10)}...${room.slice(-4)}` : room}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
