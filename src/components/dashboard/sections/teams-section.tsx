'use client';

import { useState, useMemo, useCallback } from 'react';
import { useResetFlag } from '@/hooks/use-reset-flag';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Trash2,
  Eye,
  Pencil,
  UserCheck,
  Bot,
  Download,
  Crown,
  ArrowUpDown,
  UserPlus,
  Copy,
  Check,
  LayoutGrid,
  List,
} from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useTeams } from '@/hooks/use-hiclaw-teams';
import { useWorkers } from '@/hooks/use-hiclaw-workers';
import { useManagers } from '@/hooks/use-hiclaw-managers';
import { useCreateTeam, useDeleteTeam, useUpdateTeam } from '@/hooks/use-hiclaw-mutations';
import { useSearch } from '@/lib/search-context';
import { useHiClawStore } from '@/lib/hiclaw-store';
import {
  TEAM_PHASE_BADGE_CLASSES,
  TEAM_PHASE_LABELS,
  WORKER_PHASE_LABELS,
  WORKER_PHASE_BADGE_CLASSES,
} from '@/lib/phase-colors';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { StatusDot } from '@/components/dashboard/status-dot';
import { SectionHeader } from '@/components/dashboard/section-header';
import { SurfaceEmptyState, SurfaceShell, SurfaceSkeletonGrid } from '@/components/dashboard/surface-shell';
import { toast } from 'sonner';
import type { TeamResponse, CreateTeamRequest, UpdateTeamRequest, WorkerResponse, ManagerResponse } from '@/lib/hiclaw-api';

// ============ Sort Types ============
type SortKey = 'name' | 'phase' | 'readiness';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: '按名称' },
  { value: 'phase', label: '按阶段' },
  { value: 'readiness', label: '按就绪度' },
];

// ============ Sub-component: Team Workers List (extracted from IIFE) ============
function TeamWorkersList({ teamName, workers }: { teamName: string; workers: WorkerResponse[] }) {
  const teamWorkers = workers.filter((w) => w.team === teamName);
  if (teamWorkers.length === 0) {
    return (
      <div className="pt-3 border-t border-border">
        <p className="text-muted-foreground text-xs">该团队暂无 Worker</p>
      </div>
    );
  }
  return (
    <div className="pt-3 border-t border-border">
      <p className="text-muted-foreground mb-2">团队中的 Workers</p>
      <div className="space-y-2">
        {teamWorkers.map((w) => (
          <div key={w.name} className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
            <StatusDot phase={w.phase} />
            <Bot className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium">{w.name}</span>
            <Badge className={`${WORKER_PHASE_BADGE_CLASSES[w.phase] || ''} text-[10px] ml-auto`} variant="secondary">
              {WORKER_PHASE_LABELS[w.phase] || w.phase}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Sub-component: Team Topology Visualization ============
function TeamTopologyDiagram({ team, workers, managers }: {
  team: TeamResponse;
  workers: WorkerResponse[];
  managers: ManagerResponse[];
}) {
  const teamWorkers = workers.filter((w) => w.team === team.name);
  const leaderName = team.leaderName;
  const leaderManager = managers.find((m) => m.name === leaderName);

  return (
    <div className="flex flex-col items-center gap-0 py-4">
      {/* Manager Node */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-purple-500/40 bg-purple-500/10 shadow-sm`}>
        <StatusDot phase={leaderManager?.phase || 'Pending'} />
        <Crown className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium">{leaderName || '未指定'}</span>
        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600 dark:text-purple-400">
          Manager
        </Badge>
      </div>

      {/* Connection line: Manager → Team Room */}
      <div className="w-0.5 h-6 bg-purple-500/30" />

      {/* Team Room Node */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 shadow-sm`}>
        <StatusDot phase={team.phase} />
        <Users className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium">{team.name}</span>
        <Badge className={TEAM_PHASE_BADGE_CLASSES[team.phase]} variant="secondary">
          {TEAM_PHASE_LABELS[team.phase] || team.phase}
        </Badge>
      </div>

      {/* Connection line: Team Room → Workers */}
      {teamWorkers.length > 0 && (
        <>
          <div className="w-0.5 h-6 bg-emerald-500/30" />
          {/* Branch point */}
          <div className="relative flex items-start justify-center gap-3 flex-wrap">
            {teamWorkers.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] h-0.5 bg-orange-500/20 max-w-[400px]" />
            )}
            {teamWorkers.map((w) => (
              <div key={w.name} className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-orange-500/20" />
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/5`}>
                  <StatusDot phase={w.phase} />
                  <Bot className="w-3 h-3 text-orange-500" />
                  <span className="text-xs font-medium">{w.name}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {teamWorkers.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">暂无 Worker</p>
      )}
    </div>
  );
}

// ============ Sub-component: Copy Button ============
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useResetFlag(1500);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied();
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-0.5 rounded hover:bg-muted/50 transition-colors"
      title="复制"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-muted-foreground" />
      )}
    </button>
  );
}

export function TeamsSection() {
  const { data: teams, isLoading, isError, refetch, isRefetching } = useTeams();
  const { data: workers } = useWorkers();
  const { data: managers } = useManagers();
  const { searchQuery } = useSearch();
  const { isConnected } = useHiClawStore();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [detailTeam, setDetailTeam] = useState<TeamResponse | null>(null);
  const [editTeam, setEditTeam] = useState<TeamResponse | null>(null);
  const [topologyTeam, setTopologyTeam] = useState<TeamResponse | null>(null);

  const [newTeam, setNewTeam] = useState<CreateTeamRequest>({ name: '', leader: { name: '' } });
  const [editForm, setEditForm] = useState<UpdateTeamRequest & { name?: string }>({});

  // Sort & view
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Add worker state
  const [addWorkerPopoverOpen, setAddWorkerPopoverOpen] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchQuery) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.teamName || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  // Sort
  const sortedTeams = useMemo(() => {
    const sorted = [...filteredTeams];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'phase':
          return (a.phase || '').localeCompare(b.phase || '');
        case 'readiness': {
          const ra = a.totalWorkers > 0 ? a.readyWorkers / a.totalWorkers : 0;
          const rb = b.totalWorkers > 0 ? b.readyWorkers / b.totalWorkers : 0;
          return rb - ra;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [filteredTeams, sortKey]);

  // Available workers for a team (workers not already in the team)
  const getAvailableWorkers = useCallback((teamName: string, currentWorkerNames: string[]) => {
    if (!workers) return [];
    const inTeamSet = new Set(currentWorkerNames);
    return workers.filter((w) => !inTeamSet.has(w.name) && (!w.team || w.team === ''));
  }, [workers]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (!teams) return;
    const data = JSON.stringify(teams, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hiclaw-teams-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('团队数据已导出');
  }, [teams]);

  const handleCreate = () => {
    createTeam.mutate(newTeam, {
      onSuccess: () => {
        setCreateOpen(false);
        setNewTeam({ name: '', leader: { name: '' } });
      },
    });
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteTeam.mutate(deleteTarget, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const openEdit = (team: TeamResponse) => {
    setEditTeam(team);
    setEditForm({
      name: team.name,
      teamName: team.teamName || '',
      description: team.description || '',
      workerNames: team.workerNames || [],
    });
  };

  const handleUpdate = () => {
    if (!editTeam) return;
    const { name: _, ...data } = editForm;
    updateTeam.mutate(
      { name: editTeam.name, data: data as UpdateTeamRequest },
      {
        onSuccess: () => {
          setEditTeam(null);
          setEditForm({});
        },
      }
    );
  };

  // Quick add worker to team
  const handleAddWorkerToTeam = (teamName: string, workerName: string, currentWorkerNames: string[]) => {
    const newWorkerNames = [...currentWorkerNames, workerName];
    updateTeam.mutate(
      { name: teamName, data: { workerNames: newWorkerNames } },
      {
        onSuccess: () => {
          toast.success(`已将 Worker "${workerName}" 添加到团队 "${teamName}"`);
          setAddWorkerPopoverOpen(null);
        },
      }
    );
  };

  const getWorkersForTeam = (teamName: string) => {
    return workers?.filter((w) => w.team === teamName) || [];
  };

  if (isError && !isConnected) {
    return <ApiErrorState />;
  }

  return (
    <div className="space-y-6">
      {/* Communication Topology - Visual Diagram */}
      <SurfaceShell contentClassName="p-4">
        <h3 className="text-sm font-semibold mb-3">通信拓扑</h3>
          <div className="flex items-center justify-center gap-4 py-4 flex-wrap">
            {/* Manager Node */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-purple-500/40 bg-purple-500/10">
                <Crown className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Manager</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">协调调度</p>
            </div>

            {/* SVG Arrow */}
            <svg width="40" height="24" viewBox="0 0 40 24" className="shrink-0">
              <line x1="0" y1="12" x2="32" y2="12" stroke="currentColor" strokeWidth="1.5" className="text-purple-500/40" />
              <polygon points="32,6 40,12 32,18" className="fill-purple-500/40" />
            </svg>

            {/* Team Room Node */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10">
                <Users className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">Teams</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">团队房间</p>
            </div>

            {/* SVG Arrow */}
            <svg width="40" height="24" viewBox="0 0 40 24" className="shrink-0">
              <line x1="0" y1="12" x2="32" y2="12" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500/40" />
              <polygon points="32,6 40,12 32,18" className="fill-emerald-500/40" />
            </svg>

            {/* Worker Node */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-orange-500/40 bg-orange-500/10">
                <Bot className="w-4 h-4 text-orange-500" />
                <span className="text-sm">Workers</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">执行任务</p>
            </div>
          </div>
      </SurfaceShell>

      {/* Header */}
      <SectionHeader
        title="团队"
        description="管理团队和协作配置"
        isLive={isConnected}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!teams || teams.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              导出 JSON
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              创建团队
            </Button>
          </div>
        }
      />

      {/* Toolbar: Sort + View Toggle */}
      {sortedTeams.length > 0 && (
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

      {/* Teams List */}
      {isLoading ? (
        viewMode === 'card' ? (
          <SurfaceSkeletonGrid count={6} cols={3} rows={2} />
        ) : (
          <SurfaceShell contentClassName="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-full rounded shimmer" />
            ))}
          </SurfaceShell>
        )
      ) : sortedTeams.length === 0 ? (
        <SurfaceEmptyState
          icon={<Users className="w-12 h-12" />}
          message={searchQuery ? '没有匹配的团队' : '暂无团队'}
          action={
            !searchQuery ? (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                创建第一个团队
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTeams.map((team, i) => (
                <motion.div
                  key={team.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  layout
                >
                  <SurfaceShell hover contentClassName="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot phase={team.phase} />
                        <Users className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span className="font-medium truncate">{team.name}</span>
                      </div>
                      <Badge className={TEAM_PHASE_BADGE_CLASSES[team.phase]} variant="secondary">
                        {TEAM_PHASE_LABELS[team.phase] || team.phase}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-sm">
                      {team.description && (
                        <p className="text-muted-foreground text-xs line-clamp-2">{team.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Leader</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs truncate ml-2 cursor-help">{team.leaderName || '-'}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Leader: {team.leaderName || '未指定'}</p>
                            <p>就绪状态: {team.leaderReady ? '已就绪' : '未就绪'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Workers</span>
                        <span className="text-xs">
                          {team.readyWorkers}/{team.totalWorkers}
                        </span>
                      </div>
                      {team.teamRoomID && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">房间</span>
                          <div className="flex items-center gap-1 min-w-0 ml-2">
                            <span className="font-mono text-xs truncate max-w-[60%]">{team.teamRoomID}</span>
                            <CopyButton text={team.teamRoomID} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => setDetailTeam(team)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        详情
                      </Button>
                      <Popover
                        open={addWorkerPopoverOpen === team.name}
                        onOpenChange={(open) => setAddWorkerPopoverOpen(open ? team.name : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" title="添加 Worker">
                            <UserPlus className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="end">
                          <div className="space-y-1">
                            <p className="text-xs font-medium px-2 py-1 text-muted-foreground">可添加的 Workers</p>
                            {getAvailableWorkers(team.name, team.workerNames || []).length === 0 ? (
                              <p className="text-xs text-muted-foreground px-2 py-2">没有可添加的 Worker</p>
                            ) : (
                              <div className="max-h-40 overflow-y-auto">
                                {getAvailableWorkers(team.name, team.workerNames || []).map((w) => (
                                  <button
                                    key={w.name}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/50 transition-colors text-left"
                                    onClick={() => handleAddWorkerToTeam(team.name, w.name, team.workerNames || [])}
                                  >
                                    <StatusDot phase={w.phase} />
                                    <Bot className="w-3 h-3 text-orange-500" />
                                    <span className="truncate">{w.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setTopologyTeam(team)}
                        title="查看拓扑"
                      >
                        <UserCheck className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEdit(team)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(team.name)}
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
                    <TableHead>阶段</TableHead>
                    <TableHead>Leader</TableHead>
                    <TableHead>Workers</TableHead>
                    <TableHead>房间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTeams.map((team) => (
                    <TableRow key={team.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusDot phase={team.phase} />
                          <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={TEAM_PHASE_BADGE_CLASSES[team.phase]} variant="secondary">
                          {TEAM_PHASE_LABELS[team.phase] || team.phase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs truncate max-w-[120px] block cursor-help">
                              {team.leaderName || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Leader: {team.leaderName || '未指定'}</p>
                            <p>就绪: {team.leaderReady ? '是' : '否'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{team.readyWorkers}/{team.totalWorkers}</span>
                      </TableCell>
                      <TableCell>
                        {team.teamRoomID ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs truncate max-w-[120px]">{team.teamRoomID}</span>
                            <CopyButton text={team.teamRoomID} />
                          </div>
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
                            onClick={() => setDetailTeam(team)}
                            title="查看详情"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Popover
                            open={addWorkerPopoverOpen === `table-${team.name}`}
                            onOpenChange={(open) => setAddWorkerPopoverOpen(open ? `table-${team.name}` : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="添加 Worker" aria-label="添加 Worker">
                                <UserPlus className="w-3.5 h-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="end">
                              <div className="space-y-1">
                                <p className="text-xs font-medium px-2 py-1 text-muted-foreground">可添加的 Workers</p>
                                {getAvailableWorkers(team.name, team.workerNames || []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground px-2 py-2">没有可添加的 Worker</p>
                                ) : (
                                  <div className="max-h-40 overflow-y-auto">
                                    {getAvailableWorkers(team.name, team.workerNames || []).map((w) => (
                                      <button
                                        key={w.name}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted/50 transition-colors text-left"
                                        onClick={() => handleAddWorkerToTeam(team.name, w.name, team.workerNames || [])}
                                      >
                                        <StatusDot phase={w.phase} />
                                        <Bot className="w-3 h-3 text-orange-500" />
                                        <span className="truncate">{w.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setTopologyTeam(team)}
                            title="查看拓扑"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(team)}
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(team.name)}
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

      {/* Create Team Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>创建团队</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称 *</Label>
              <Input
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="team-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Leader 名称 *</Label>
              <Input
                value={newTeam.leader?.name || ''}
                onChange={(e) => setNewTeam({ ...newTeam, leader: { name: e.target.value } })}
                placeholder="leader-name"
              />
            </div>
            <div className="space-y-2">
              <Label>团队名称</Label>
              <Input
                value={newTeam.teamName || ''}
                onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })}
                placeholder="显示名称（可选）"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={newTeam.description || ''}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="团队描述（可选）"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Worker 名称（逗号分隔）</Label>
              <Input
                value={newTeam.workerNames?.join(', ') || ''}
                onChange={(e) => setNewTeam({
                  ...newTeam,
                  workerNames: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
                })}
                placeholder="worker1, worker2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              onClick={handleCreate}
              disabled={!newTeam.name || !newTeam.leader?.name || createTeam.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {createTeam.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={!!editTeam} onOpenChange={() => { setEditTeam(null); setEditForm({}); }}>
        <DialogContent className="sm:max-w-lg max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>编辑团队 - {editTeam?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>团队名称</Label>
              <Input
                value={editForm.teamName || ''}
                onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })}
                placeholder="显示名称"
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="团队描述"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Worker 名称（逗号分隔）</Label>
              <Input
                value={editForm.workerNames?.join(', ') || ''}
                onChange={(e) => setEditForm({
                  ...editForm,
                  workerNames: e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : [],
                })}
                placeholder="worker1, worker2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTeam(null); setEditForm({}); }}>
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateTeam.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
            >
              {updateTeam.isPending ? '更新中...' : '更新'}
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
              确定要删除团队 &quot;{deleteTarget}&quot; 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTeam.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTeam.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteTeam.isPending ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Team Detail Dialog */}
      <Dialog open={!!detailTeam} onOpenChange={() => setDetailTeam(null)}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>团队详情 - {detailTeam?.name}</DialogTitle>
          </DialogHeader>
          {detailTeam && (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2 mb-3">
                <StatusDot phase={detailTeam.phase} />
                <Badge className={TEAM_PHASE_BADGE_CLASSES[detailTeam.phase]} variant="secondary">
                  {TEAM_PHASE_LABELS[detailTeam.phase] || detailTeam.phase}
                </Badge>
              </div>
              {[
                ['名称', detailTeam.name],
                ['团队名称', detailTeam.teamName || '-'],
                ['描述', detailTeam.description || '-'],
                ['Leader', detailTeam.leaderName || '-'],
                ['Leader 就绪', detailTeam.leaderReady ? '是' : '否'],
                ['Workers', `${detailTeam.readyWorkers}/${detailTeam.totalWorkers}`],
                ['人类成员', (detailTeam.humanMembers || []).join(', ') || '-'],
                ['Worker 列表', (detailTeam.workerNames || []).join(', ') || '-'],
                ['团队房间', detailTeam.teamRoomID || '-'],
                ['Leader DM 房间', detailTeam.leaderDMRoomID || '-'],
                ['空闲超时', detailTeam.workerIdleTimeout || '-'],
                ['消息', detailTeam.message || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs max-w-[60%] text-right break-all">{value}</span>
                </div>
              ))}
              {detailTeam.leaderHeartbeat && (
                <div className="pt-2">
                  <p className="text-muted-foreground mb-1">Leader 心跳</p>
                  <p className="text-xs font-mono">
                    启用: {detailTeam.leaderHeartbeat.enabled ? '是' : '否'} / 间隔: {detailTeam.leaderHeartbeat.every}
                  </p>
                </div>
              )}
              <TeamWorkersList teamName={detailTeam.name} workers={workers || []} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Team Topology Dialog */}
      <Dialog open={!!topologyTeam} onOpenChange={() => setTopologyTeam(null)}>
        <DialogContent className="sm:max-w-xl max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>团队拓扑 - {topologyTeam?.name}</DialogTitle>
          </DialogHeader>
          {topologyTeam && workers && (
            <TeamTopologyDiagram
              team={topologyTeam}
              workers={workers}
              managers={managers || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
