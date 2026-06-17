'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Plus,
  Trash2,
  Sun,
  Moon,
  Eye,
  Upload,
  Pencil,
  FileCode,
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  XSquare,
  History,
  MoonStar,
  SunMedium,
  Rocket,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  X,
  Copy,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useWorkers } from '@/hooks/use-hiclaw-workers';
import { useTeams } from '@/hooks/use-hiclaw-teams';
import {
  useCreateWorker,
  useDeleteWorker,
  useWakeWorker,
  useSleepWorker,
  useEnsureReadyWorker,
  useUpdateWorker,
} from '@/hooks/use-hiclaw-mutations';
import { useSearch } from '@/lib/search-context';
import { hiclawApi } from '@/lib/hiclaw-api';
import { useHiClawStore } from '@/lib/hiclaw-store';
import {
  WORKER_PHASE_BADGE_CLASSES,
  WORKER_PHASE_LABELS,
  RUNTIME_LABELS,
} from '@/lib/phase-colors';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { StatusDot } from '@/components/dashboard/status-dot';
import { WorkerTraceDialog } from '@/components/dashboard/worker-trace';
import { WorkerDetailDialog } from '@/components/dashboard/worker-detail-dialog';
import { CopyButton } from '@/components/dashboard/copy-button';
import { MetricsMiniCard } from '@/components/dashboard/worker-metrics-mini-card';
import { BulkActionBar } from '@/components/dashboard/worker-bulk-action-bar';
import { useWorkerMetrics } from '@/hooks/use-worker-metrics';
import { workersToCsv, workersToJson } from '@/lib/worker-export';
import { downloadText, copyToClipboard } from '@/lib/download';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { SectionHeader } from '@/components/dashboard/section-header';
import { toast } from 'sonner';
import type { WorkerResponse, CreateWorkerRequest, UpdateWorkerRequest, WorkerRuntime, WorkerPhase } from '@/lib/hiclaw-api';

// ============ Sort Types ============
type SortKey = 'name' | 'phase' | 'runtime' | 'team';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: '按名称' },
  { value: 'phase', label: '按阶段' },
  { value: 'runtime', label: '按运行时' },
  { value: 'team', label: '按团队' },
];

const ITEMS_PER_PAGE = 12;

function WorkerCardMetrics({ name }: { name: string }) {
  const { data, isLoading } = useWorkerMetrics(name, { refetchInterval: 30_000 });
  return <MetricsMiniCard metrics={data ?? null} loading={isLoading} />;
}

export function WorkersSection() {
  const { data: workers, isLoading, error, isError, refetch, isRefetching } = useWorkers();
  const { data: teams } = useTeams();
  const { searchQuery } = useSearch();
  const { isConnected } = useHiClawStore();
  const createWorker = useCreateWorker();
  const deleteWorker = useDeleteWorker();
  const wakeWorker = useWakeWorker();
  const sleepWorker = useSleepWorker();
  const ensureReadyWorker = useEnsureReadyWorker();
  const updateWorker = useUpdateWorker();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailWorker, setDetailWorker] = useState<WorkerResponse | null>(null);
  const [editWorker, setEditWorker] = useState<WorkerResponse | null>(null);
  const [traceWorker, setTraceWorker] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [configText, setConfigText] = useState('');

  // View mode & sort & pagination
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk operations state
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'sleep' | 'wake' | 'delete' | null>(null);

  const [newWorker, setNewWorker] = useState<CreateWorkerRequest>({
    name: '',
    runtime: 'openclaw',
  });

  const [editForm, setEditForm] = useState<UpdateWorkerRequest & { name?: string }>({});
  const [phaseFilter, setPhaseFilter] = useState<Set<WorkerPhase>>(new Set());
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const togglePhase = useCallback((phase: WorkerPhase) => {
    setPhaseFilter((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setPhaseFilter(new Set());
    setTeamFilter('all');
  }, []);

  // Filter by search + phase + team
  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    const q = searchQuery.toLowerCase();
    return workers.filter((w) => {
      if (phaseFilter.size > 0 && !phaseFilter.has(w.phase)) return false;
      if (teamFilter !== 'all' && w.team !== teamFilter) return false;
      if (q) {
        return (
          w.name?.toLowerCase().includes(q) ||
          w.model?.toLowerCase().includes(q) ||
          w.runtime?.toLowerCase().includes(q) ||
          w.team?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workers, searchQuery, phaseFilter, teamFilter]);

  const phaseCounts = useMemo(() => {
    const m: Partial<Record<WorkerPhase, number>> = {};
    if (!workers) return m;
    for (const w of workers) m[w.phase] = (m[w.phase] ?? 0) + 1;
    return m;
  }, [workers]);

  const teamList = useMemo(() => {
    if (!workers) return [] as string[];
    const set = new Set<string>();
    for (const w of workers) if (w.team) set.add(w.team);
    return Array.from(set).sort();
  }, [workers]);

  // Sort
  const sortedWorkers = useMemo(() => {
    const sorted = [...filteredWorkers];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'phase':
          return a.phase.localeCompare(b.phase);
        case 'runtime':
          return a.runtime.localeCompare(b.runtime);
        case 'team':
          return (a.team || '').localeCompare(b.team || '');
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredWorkers, sortKey]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedWorkers.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedWorkers = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return sortedWorkers.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedWorkers, safeCurrentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortKey, phaseFilter.size, Array.from(phaseFilter).join(','), teamFilter]);

  // Runtime distribution
  const runtimeDist = useMemo(() => {
    const dist: Record<string, number> = {};
    workers?.forEach((w) => {
      dist[w.runtime] = (dist[w.runtime] || 0) + 1;
    });
    return dist;
  }, [workers]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Bulk operations
  const toggleSelect = (name: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedWorkers(new Set(filteredWorkers.map((w) => w.name)));
  };

  const deselectAll = () => {
    setSelectedWorkers(new Set());
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedWorkers.size === 0) return;
    const names = Array.from(selectedWorkers);
    let count = 0;

    if (bulkAction === 'sleep') {
      names.forEach((name) => {
        sleepWorker.mutate(name);
        count++;
      });
      toast.success(`已发送 ${count} 个休眠指令`);
    } else if (bulkAction === 'wake') {
      names.forEach((name) => {
        wakeWorker.mutate(name);
        count++;
      });
      toast.success(`已发送 ${count} 个唤醒指令`);
    } else if (bulkAction === 'delete') {
      names.forEach((name) => {
        deleteWorker.mutate(name);
        count++;
      });
      toast.success(`已删除 ${count} 个 Worker`);
    }

    setSelectedWorkers(new Set());
    setBulkAction(null);
  };

  // Export helpers (CSV / JSON / clipboard)
  const exportScope = sortedWorkers;
  const dateTag = new Date().toISOString().slice(0, 10);
  const handleExportJson = useCallback(() => {
    if (!exportScope.length) return;
    downloadText(`hiclaw-workers-${dateTag}.json`, workersToJson(exportScope), 'application/json');
    toast.success(`已导出 ${exportScope.length} 个 Worker 为 JSON`);
  }, [exportScope, dateTag]);
  const handleExportCsv = useCallback(() => {
    if (!exportScope.length) return;
    downloadText(`hiclaw-workers-${dateTag}.csv`, workersToCsv(exportScope), 'text/csv');
    toast.success(`已导出 ${exportScope.length} 个 Worker 为 CSV`);
  }, [exportScope, dateTag]);
  const handleCopyJson = useCallback(async () => {
    if (!exportScope.length) return;
    const ok = await copyToClipboard(workersToJson(exportScope as unknown as Record<string, unknown>[]));
    if (ok) toast.success(`已复制 ${exportScope.length} 个 Worker 到剪贴板`);
    else toast.error('复制失败，请检查浏览器权限');
  }, [exportScope]);

  const handleCreate = () => {
    createWorker.mutate(newWorker, {
      onSuccess: () => {
        setCreateOpen(false);
        setNewWorker({ name: '', runtime: 'openclaw' });
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteWorker.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await hiclawApi.uploadPackage(file);
      setUploadOpen(false);
    } catch {
      // error handled by toast
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (worker: WorkerResponse) => {
    setEditWorker(worker);
    setEditForm({
      name: worker.name,
      model: worker.model || '',
      runtime: worker.runtime,
      image: worker.image || '',
      soul: '',
      skills: worker.skills || [],
    });
  };

  const handleUpdate = () => {
    if (!editWorker) return;
    const { name: _, ...data } = editForm;
    updateWorker.mutate(
      { name: editWorker.name, data: data as UpdateWorkerRequest },
      {
        onSuccess: () => {
          setEditWorker(null);
          setEditForm({});
        },
      }
    );
  };

  // JSON config apply (replaces YAML parser)
  const handleConfigApply = () => {
    try {
      const parsed = JSON.parse(configText);
      const createReq: CreateWorkerRequest = {
        name: parsed.name || '',
        runtime: (parsed.runtime as WorkerRuntime) || 'openclaw',
        model: parsed.model || undefined,
        image: parsed.image || undefined,
        soul: parsed.soul || undefined,
        skills: parsed.skills || undefined,
      };
      createWorker.mutate(createReq, {
        onSuccess: () => {
          setConfigOpen(false);
          setConfigText('');
        },
      });
    } catch {
      toast.error('JSON 格式无效，请检查输入');
    }
  };

  // Show error state when disconnected
  if (isError && !isConnected) {
    return <ApiErrorState />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Workers"
        description="管理和监控 AI Agent Workers"
        isLive={isConnected}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        actions={
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!exportScope.length}>
                  <Download className="w-4 h-4 mr-1" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportJson}>
                  <Download className="w-3.5 h-3.5 mr-2" />
                  下载 JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv}>
                  <Download className="w-3.5 h-3.5 mr-2" />
                  下载 CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyJson}>
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  复制 JSON 到剪贴板
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />
              上传包
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <FileCode className="w-4 h-4 mr-1" />
              JSON 应用
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              创建 Worker
            </Button>
          </div>
        }
      />

      {/* Runtime Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(RUNTIME_LABELS).map(([key, label]) => (
          <Card key={key} className="glass-card">
            <CardContent className="p-3 flex items-center gap-3">
              <Bot className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{runtimeDist[key] || 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Operations Bar */}
      <AnimatePresence>
        {selectedWorkers.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-card px-4 py-3 rounded-xl border border-orange-500/20 shadow-lg flex items-center gap-3"
          >
            <span className="text-sm font-medium">已选择 {selectedWorkers.size} 个 Worker</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBulkAction('wake')}>
              <SunMedium className="w-3 h-3 mr-1" />
              批量唤醒
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBulkAction('sleep')}>
              <MoonStar className="w-3 h-3 mr-1" />
              批量休眠
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setBulkAction('delete')}>
              <Trash2 className="w-3 h-3 mr-1" />
              批量删除
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              <XSquare className="w-3 h-3 mr-1" />
              取消选择
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Action Confirmation */}
      <AlertDialog open={!!bulkAction} onOpenChange={() => setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量操作</AlertDialogTitle>
            <AlertDialogDescription>
              确定要{bulkAction === 'wake' ? '唤醒' : bulkAction === 'sleep' ? '休眠' : '删除'} {selectedWorkers.size} 个 Worker 吗？
              {bulkAction === 'delete' && '此操作不可撤销。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              className={bulkAction === 'delete' ? 'bg-destructive text-destructive-foreground' : ''}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Filter row: phase chips + team dropdown */}
      <div className="flex items-center gap-3 flex-wrap rounded-lg border border-border/60 bg-card/40 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
          <Filter className="w-3 h-3" />
          过滤
        </div>
        <div className="flex flex-wrap gap-1">
          {(['Pending', 'Running', 'Sleeping', 'Updating', 'Stopped', 'Failed', 'Ready'] as WorkerPhase[]).map((p) => {
            const active = phaseFilter.has(p);
            const count = phaseCounts[p] ?? 0;
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePhase(p)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                  active
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300'
                    : 'border-border/60 text-muted-foreground hover:border-orange-500/30'
                }`}
                aria-pressed={active}
              >
                {WORKER_PHASE_LABELS[p] ?? p} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">团队</span>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[160px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {teamList.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(phaseFilter.size > 0 || teamFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={clearFilters}>
            <X className="w-3 h-3 mr-1" />
            清除过滤
          </Button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {filteredWorkers.length} / {workers?.length ?? 0}
        </span>
        <BulkActionBar
          filteredWorkers={filteredWorkers}
          filtersActive={phaseFilter.size > 0 || teamFilter !== 'all'}
          onAfter={() => refetch()}
        />
      </div>

      {/* Toolbar: Select All + Sort + View Toggle */}
      {filteredWorkers.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
              <CheckSquare className="w-3 h-3 mr-1" />
              全选
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
              <Square className="w-3 h-3 mr-1" />
              取消全选
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort Dropdown */}
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

            {/* View Toggle */}
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

      {/* Workers List */}
      {isLoading ? (
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 w-32 rounded shimmer" />
                  <div className="h-4 w-24 rounded shimmer" />
                  <div className="h-4 w-20 rounded shimmer" />
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
      ) : filteredWorkers.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? '没有匹配的 Worker' : '暂无 Worker'}
            </p>
            {!searchQuery && (
              <Button variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                创建第一个 Worker
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedWorkers.map((worker, i) => (
                <motion.div
                  key={worker.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <Card className={`glass-card hover-lift ${selectedWorkers.has(worker.name) ? 'ring-2 ring-orange-500/50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            onClick={() => toggleSelect(worker.name)}
                            className="shrink-0"
                            title={selectedWorkers.has(worker.name) ? '取消选择' : '选择'}
                          >
                            {selectedWorkers.has(worker.name) ? (
                              <CheckSquare className="w-4 h-4 text-orange-500" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
                            )}
                          </button>
                          <StatusDot phase={worker.phase} />
                          <Bot className="w-5 h-5 text-orange-500 shrink-0" />
                          <span className="font-medium truncate">{worker.name}</span>
                        </div>
                        <Badge className={WORKER_PHASE_BADGE_CLASSES[worker.phase]} variant="secondary">
                          {WORKER_PHASE_LABELS[worker.phase] || worker.phase}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">模型</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs truncate ml-2 cursor-help">{worker.model || '-'}</span>
                            </TooltipTrigger>
                            <TooltipContent>完整模型名: {worker.model || '未设置'}</TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">运行时</span>
                          <Badge variant="outline" className="text-xs">
                            {RUNTIME_LABELS[worker.runtime] || worker.runtime}
                          </Badge>
                        </div>
                        {worker.team && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">团队</span>
                            <span className="text-xs truncate ml-2">{worker.team}</span>
                          </div>
                        )}
                      </div>

                      <WorkerCardMetrics name={worker.name} />

                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => setDetailWorker(worker)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          详情
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setTraceWorker(worker.name)}
                          title="View trace timeline"
                        >
                          <History className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openEdit(worker)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {worker.state === 'Sleeping' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => wakeWorker.mutate(worker.name)}
                          >
                            <Sun className="w-3 h-3" />
                          </Button>
                        ) : worker.state === 'Running' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => sleepWorker.mutate(worker.name)}
                          >
                            <Moon className="w-3 h-3" />
                          </Button>
                        ) : null}
                        {(worker.phase === 'Pending' || worker.phase === 'Stopped') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => ensureReadyWorker.mutate(worker.name)}
                            title="Ensure Ready"
                          >
                            <Rocket className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(worker.name)}
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
                    <TableHead className="w-10"></TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>阶段</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>运行时</TableHead>
                    <TableHead>模型</TableHead>
                    <TableHead>团队</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkers.map((worker) => (
                    <TableRow
                      key={worker.name}
                      className={selectedWorkers.has(worker.name) ? 'bg-orange-500/5' : ''}
                    >
                      <TableCell>
                        <button
                          onClick={() => toggleSelect(worker.name)}
                          title={selectedWorkers.has(worker.name) ? '取消选择' : '选择'}
                        >
                          {selectedWorkers.has(worker.name) ? (
                            <CheckSquare className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot phase={worker.phase} />
                          <Bot className="w-4 h-4 text-orange-500 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{worker.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={WORKER_PHASE_BADGE_CLASSES[worker.phase]} variant="secondary">
                          {WORKER_PHASE_LABELS[worker.phase] || worker.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{worker.state}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {RUNTIME_LABELS[worker.runtime] || worker.runtime}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-xs truncate max-w-[150px] block cursor-help">
                              {worker.model || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>完整模型名: {worker.model || '未设置'}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs truncate max-w-[100px] block">{worker.team || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailWorker(worker)}
                            title="查看详情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(worker)}
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {worker.state === 'Sleeping' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => wakeWorker.mutate(worker.name)}
                              title="唤醒"
                            >
                              <Sun className="w-3.5 h-3.5" />
                            </Button>
                          ) : worker.state === 'Running' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => sleepWorker.mutate(worker.name)}
                              title="休眠"
                            >
                              <Moon className="w-3.5 h-3.5" />
                            </Button>
                          ) : null}
                          {(worker.phase === 'Pending' || worker.phase === 'Stopped') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => ensureReadyWorker.mutate(worker.name)}
                              title="Ensure Ready"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(worker.name)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                共 {sortedWorkers.length} 个 Worker，第 {safeCurrentPage}/{totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first, last, and pages around current
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - safeCurrentPage) <= 1) return true;
                      return false;
                    })
                    .map((page, idx, arr) => {
                      const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                      return (
                        <span key={page} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-1 text-xs text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={page === safeCurrentPage ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 w-8 p-0 text-xs"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </span>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Worker Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>创建 Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={newWorker.name}
                onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                placeholder="worker-name"
              />
            </div>
            <div className="space-y-2">
              <Label>运行时 *</Label>
              <Select
                value={newWorker.runtime}
                onValueChange={(v) => setNewWorker({ ...newWorker, runtime: v as CreateWorkerRequest['runtime'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openclaw">OpenClaw</SelectItem>
                  <SelectItem value="copaw">CoPaw</SelectItem>
                  <SelectItem value="hermes">Hermes</SelectItem>
                  <SelectItem value="openhuman">OpenHuman</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <Input
                value={newWorker.model || ''}
                onChange={(e) => setNewWorker({ ...newWorker, model: e.target.value })}
                placeholder="gpt-4 / claude-3 等"
              />
            </div>
            <div className="space-y-2">
              <Label>镜像</Label>
              <Input
                value={newWorker.image || ''}
                onChange={(e) => setNewWorker({ ...newWorker, image: e.target.value })}
                placeholder="容器镜像地址（可选）"
              />
            </div>
            <div className="space-y-2">
              <Label>Soul</Label>
              <Textarea
                value={newWorker.soul || ''}
                onChange={(e) => setNewWorker({ ...newWorker, soul: e.target.value })}
                placeholder="Worker 人格描述（可选）"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>技能（逗号分隔）</Label>
              <Input
                value={newWorker.skills?.join(', ') || ''}
                onChange={(e) => setNewWorker({
                  ...newWorker,
                  skills: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="skill1, skill2, skill3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newWorker.name || createWorker.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {createWorker.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Dialog */}
      <Dialog open={!!editWorker} onOpenChange={() => { setEditWorker(null); setEditForm({}); }}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>编辑 Worker - {editWorker?.name}</DialogTitle>
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
              <Select
                value={editForm.runtime || ''}
                onValueChange={(v) => setEditForm({ ...editForm, runtime: v as WorkerRuntime })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openclaw">OpenClaw</SelectItem>
                  <SelectItem value="copaw">CoPaw</SelectItem>
                  <SelectItem value="hermes">Hermes</SelectItem>
                  <SelectItem value="openhuman">OpenHuman</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Soul</Label>
              <Textarea
                value={editForm.soul || ''}
                onChange={(e) => setEditForm({ ...editForm, soul: e.target.value })}
                placeholder="Worker 人格描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>技能（逗号分隔）</Label>
              <Input
                value={editForm.skills?.join(', ') || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  skills: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : [],
                })}
                placeholder="skill1, skill2, skill3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditWorker(null); setEditForm({}); }}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateWorker.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {updateWorker.isPending ? '更新中...' : '更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON Config Apply Dialog (replaces YAML) */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>JSON 配置应用</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              请输入 JSON 格式的 Worker 配置，将自动解析并创建 Worker。
            </p>
            <Textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder={`{\n  "name": "my-worker",\n  "runtime": "openclaw",\n  "model": "gpt-4",\n  "image": "custom-image",\n  "soul": "你是一个助手",\n  "skills": ["skill1", "skill2"]\n}`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfigOpen(false); setConfigText(''); }}>
              取消
            </Button>
            <Button
              onClick={handleConfigApply}
              disabled={!configText.trim() || createWorker.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {createWorker.isPending ? '应用中...' : '应用'}
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
              确定要删除 Worker &quot;{deleteTarget}&quot; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWorker.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteWorker.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteWorker.isPending ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Worker Detail Dialog (v2: 5 sections, 6 copy buttons, room/team jumps) */}
      <WorkerDetailDialog
        worker={detailWorker}
        open={!!detailWorker}
        onOpenChange={(o) => !o && setDetailWorker(null)}
        onJumpToChat={(roomID) => {
          setDetailWorker(null);
          window.dispatchEvent(new CustomEvent('ta-jump-chat', { detail: { roomID } }));
        }}
        onJumpToTeam={(teamName) => {
          setDetailWorker(null);
          window.dispatchEvent(new CustomEvent('ta-jump-team', { detail: { teamName } }));
        }}
      />

      {/* Upload Package Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>上传包</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="block mb-2">选择文件</Label>
            <Input type="file" onChange={handleUpload} disabled={uploading} />
            {uploading && <p className="text-sm text-muted-foreground mt-2">上传中...</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkerTraceDialog
        workerName={traceWorker}
        open={traceWorker !== null}
        onOpenChange={(open) => { if (!open) setTraceWorker(null); }}
      />
    </div>
  );
}
