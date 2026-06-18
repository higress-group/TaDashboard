'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Bot,
  Users,
  Crown,
  UserCheck,
  MessageSquare,
  Server,
  Container,
  Sparkles,
  GitBranch,
  Shield,
  Cpu,
  Rocket,
  Search,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight as ChevronSep,
  Home,
  Zap,
  Plus,
  Activity,
  Clock,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHiClawStore } from '@/lib/hiclaw-store';
import { useMatrixStore } from '@/lib/matrix-store';
import { useNotificationStore } from '@/lib/notification-store';
import { useSearch } from '@/lib/search-context';
import { useHiClawStatus } from '@/hooks/use-hiclaw-status';
import { useVersion } from '@/hooks/use-hiclaw-version';
import { useAutoReconnect } from '@/hooks/use-auto-reconnect';
import { useWorkers } from '@/hooks/use-hiclaw-workers';
import { useTeams } from '@/hooks/use-hiclaw-teams';
import { useManagers } from '@/hooks/use-hiclaw-managers';
import { ConnectionBanner } from './connection-banner';
import { SettingsDialog } from './settings-dialog';
import { NotificationPopover } from './notification-popover';
import { ActivityFeed } from './activity-feed';
import { SectionErrorBoundary } from './section-error-boundary';
import { ModernSectionHeader, useModernChrome, ModernChromeFallback } from './modern-chrome';

// Lazy load sections for performance
const OverviewSection = lazy(() => import('./sections/overview-section').then(m => ({ default: m.OverviewSection })));
const WorkersSection = lazy(() => import('./sections/workers-section').then(m => ({ default: m.WorkersSection })));
const TeamsSection = lazy(() => import('./sections/teams-section').then(m => ({ default: m.TeamsSection })));
const ManagersSection = lazy(() => import('./sections/managers-section').then(m => ({ default: m.ManagersSection })));
const HumansSection = lazy(() => import('./sections/humans-section').then(m => ({ default: m.HumansSection })));
const ChatSection = lazy(() => import('./sections/chat-section').then(m => ({ default: m.ChatSection })));
const InfrastructureSection = lazy(() => import('./sections/infrastructure-section').then(m => ({ default: m.InfrastructureSection })));
const K8sSection = lazy(() => import('./sections/k8s-section').then(m => ({ default: m.K8sSection })));
const SkillsSection = lazy(() => import('./sections/skills-section').then(m => ({ default: m.SkillsSection })));
const ArchitectureSection = lazy(() => import('./sections/architecture-section').then(m => ({ default: m.ArchitectureSection })));
const SecuritySection = lazy(() => import('./sections/security-section').then(m => ({ default: m.SecuritySection })));
const RuntimeSection = lazy(() => import('./sections/runtime-section').then(m => ({ default: m.RuntimeSection })));
const QuickstartSection = lazy(() => import('./sections/quickstart-section').then(m => ({ default: m.QuickstartSection })));

const STORAGE_KEY = 'hiclaw-active-section';

const navItems = [
  { id: 'overview', label: '总览', icon: LayoutDashboard, description: '集群心跳、Worker 阶段分布与资源吞吐一屏可见。' },
  { id: 'workers', label: 'Workers', icon: Bot, description: 'Worker 实时状态、阶段分布与最近活动。' },
  { id: 'teams', label: '团队', icon: Users, description: '团队组成、协作关系与 Owner 列表。' },
  { id: 'managers', label: 'Managers', icon: Crown, description: 'Manager 调度视图、当前负责团队与健康度。' },
  { id: 'humans', label: 'Humans', icon: UserCheck, description: 'Human 协作成员、当前在线与角色。' },
  { id: 'chat', label: 'Matrix 聊天', icon: MessageSquare, description: 'Matrix 房间实时消息，支持 A2UI 与 Markdown。' },
  { id: 'infrastructure', label: '基础设施', icon: Server, description: '拓扑、节点健康与连接关系图。' },
  { id: 'k8s', label: 'K8s 资源', icon: Container, description: '集群中 Pod / Deployment / Service 实时状态。' },
  { id: 'skills', label: '技能生态', icon: Sparkles, description: '可用技能、版本与最近一次调用时间。' },
  { id: 'architecture', label: '架构', icon: GitBranch, description: '系统模块关系与控制流拓扑。' },
  { id: 'security', label: '安全模型', icon: Shield, description: '认证、授权与凭据生命周期。' },
  { id: 'runtime', label: '多运行时', icon: Cpu, description: '支持的运行时与当前部署目标。' },
  { id: 'quickstart', label: '快速开始', icon: Rocket, description: '一键接入 HiClaw + Matrix 的引导步骤。' },
];

const sectionMap: Record<string, React.ComponentType> = {
  overview: OverviewSection,
  workers: WorkersSection,
  teams: TeamsSection,
  managers: ManagersSection,
  humans: HumansSection,
  chat: ChatSection,
  infrastructure: InfrastructureSection,
  k8s: K8sSection,
  skills: SkillsSection,
  architecture: ArchitectureSection,
  security: SecuritySection,
  runtime: RuntimeSection,
  quickstart: QuickstartSection,
};

/** Sections that support "create" actions */
const createActions = [
  { id: 'create-worker', label: '创建 Worker', icon: Bot, section: 'workers' },
  { id: 'create-team', label: '创建 Team', icon: Users, section: 'teams' },
  { id: 'create-human', label: '创建 Human', icon: UserCheck, section: 'humans' },
  { id: 'open-chat', label: '打开 Matrix 聊天', icon: MessageSquare, section: 'chat' },
] as const;

function SectionSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg shimmer" />
      <div className="h-4 w-64 bg-muted rounded shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl shimmer" />
        ))}
      </div>
      <div className="h-48 bg-muted rounded-xl shimmer" />
    </div>
  );
}

/** Hook for hash + localStorage based active section routing */
function useActiveSection() {
  const [activeSection, setActiveSectionInternal] = useState<string>(() => {
    // 1. Try hash first
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1);
      if (hash && navItems.some(n => n.id === hash)) {
        return hash;
      }
      // 2. Try localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && navItems.some(n => n.id === stored)) {
          return stored;
        }
      } catch {}
    }
    return 'overview';
  });

  const setActiveSection = useCallback((section: string) => {
    setActiveSectionInternal(section);
  }, []);

  // Sync hash → state on back/forward navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && navItems.some(n => n.id === hash)) {
        setActiveSectionInternal(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync state → hash + localStorage
  useEffect(() => {
    window.location.hash = activeSection;
    try {
      localStorage.setItem(STORAGE_KEY, activeSection);
    } catch {}
  }, [activeSection]);

  return { activeSection, setActiveSection };
}

export function HiClawDashboard() {
  const queryClient = useQueryClient();
  const { activeSection, setActiveSection } = useActiveSection();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const { theme, setTheme } = useTheme();
  const { isConnected, openSettings, controllerUrl, connectionLatency, lastConnectedAt, reconnectInterval } = useHiClawStore();
  const { isLoggedIn: matrixLoggedIn, isSyncing: matrixSyncing } = useMatrixStore();
  const notifications = useNotificationStore((s) => s.notifications);
  const { searchQuery, setSearchQuery } = useSearch();
  const { data: versionData } = useVersion();
  const { data: healthData } = useHiClawStatus();
  const { data: workers } = useWorkers();
  const { data: teams } = useTeams();
  const { data: managers } = useManagers();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(debouncedQuery);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [debouncedQuery, setSearchQuery]);

  // Auto check connection on mount
  const checkConnection = useHiClawStore((s) => s.checkConnection);
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Drive the auto-reconnect interval from a React lifecycle so the timer is
  // cleared on unmount and StrictMode-safe.
  useAutoReconnect();

  // Track last refresh time based on data updates
  useEffect(() => {
    if (workers !== undefined || teams !== undefined || managers !== undefined) {
      setLastRefreshTime(new Date());
    }
  }, [workers, teams, managers]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K: Focus search
      if (isCmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Cmd/Ctrl + 1-9: Switch sections
      if (isCmdOrCtrl && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < navItems.length) {
          setActiveSection(navItems[index].id);
          setMobileMenuOpen(false);
        }
      }

      // Escape: Close dialogs or blur search
      if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveSection]);

  const ActiveSectionComponent = sectionMap[activeSection] || OverviewSection;

  // Modern chrome applies modern section header / layout primitives around
  // the legacy section body. When disabled, the body renders inside a
  // `ModernChromeFallback` notice that explains the migration label.
  const { enabled: modernChrome } = useModernChrome();
  const activeMeta = navItems.find((n) => n.id === activeSection);

  // Breadcrumb
  const activeLabel = activeMeta?.label || '总览';

  // Count data for badges
  const workerCount = workers?.length ?? 0;
  const teamCount = teams?.length ?? 0;
  const managerCount = managers?.length ?? 0;

  // Badge counts map for sidebar items
  const countMap: Record<string, number> = useMemo(() => ({
    workers: workerCount,
    teams: teamCount,
    managers: managerCount,
  }), [workerCount, teamCount, managerCount]);

  // Determine which sections have recent (unread) notifications
  const sectionsWithNotifications = useMemo(() => {
    const sectionSet = new Set<string>();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    notifications.forEach((n) => {
      if (!n.read && n.timestamp > fiveMinutesAgo) {
        // Match notification title/message keywords to sections
        const msg = (n.title + ' ' + n.message).toLowerCase();
        if (msg.includes('worker')) sectionSet.add('workers');
        if (msg.includes('团队') || msg.includes('team')) sectionSet.add('teams');
        if (msg.includes('manager')) sectionSet.add('managers');
        if (msg.includes('matrix') || msg.includes('聊天') || msg.includes('chat')) sectionSet.add('chat');
        if (msg.includes('infra') || msg.includes('基础设施')) sectionSet.add('infrastructure');
        if (msg.includes('k8s') || msg.includes('kubernetes')) sectionSet.add('k8s');
      }
    });
    return sectionSet;
  }, [notifications]);

  // Format latency
  const latencyText = connectionLatency != null ? `${connectionLatency}ms` : '--';
  const latencyColor = connectionLatency != null
    ? connectionLatency < 100 ? 'text-emerald-500'
    : connectionLatency < 300 ? 'text-amber-500'
    : 'text-red-500'
    : 'text-muted-foreground';

  // Format last connected/refresh time
  const lastRefreshText = (() => {
    const now = Date.now();
    const diff = now - lastRefreshTime.getTime();
    if (diff < 5000) return '刚刚';
    if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    return lastRefreshTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  })();

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
  }, [setActiveSection]);

  const handleQuickAction = useCallback((section: string) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  }, [setActiveSection]);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['hiclaw'] });
      await queryClient.invalidateQueries({ queryKey: ['matrix'] });
      setLastRefreshTime(new Date());
    } finally {
      setIsRefreshingAll(false);
    }
  }, [queryClient]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex flex-1 min-h-0">
          {/* Desktop Sidebar */}
          <aside
            className={`hidden md:flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 ${
              sidebarCollapsed ? 'w-16' : 'w-56'
            }`}
          >
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
              <div className="w-8 h-8 rounded-lg mesh-gradient flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                H
              </div>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-bold text-lg"
                >
                  HiClaw
                </motion.span>
              )}
            </div>

            {/* Nav items */}
            <nav className="flex-1 py-2 overflow-y-auto custom-scrollbar">
              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const count = countMap[item.id];
                const hasNotification = sectionsWithNotifications.has(item.id);
                const button = (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-200 relative ${
                      isActive
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium border-r-2 border-orange-500'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-500' : ''}`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    {/* Count badge */}
                    {!sidebarCollapsed && count > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-auto text-[10px] h-5 min-w-[20px] px-1.5 flex items-center justify-center"
                      >
                        {count}
                      </Badge>
                    )}
                    {/* Collapsed mode: count badge next to icon */}
                    {sidebarCollapsed && count > 0 && (
                      <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center">
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                    {/* Notification dot */}
                    {hasNotification && !isActive && (
                      <span className={`w-2 h-2 rounded-full bg-orange-500 animate-pulse ${sidebarCollapsed ? 'absolute top-1.5 right-1.5' : 'mr-1 ml-0'}`} />
                    )}
                    {!sidebarCollapsed && !count && (
                      <kbd className="ml-auto text-[10px] text-muted-foreground/50 hidden lg:inline-block">
                        ⌘{idx + 1}
                      </kbd>
                    )}
                  </button>
                );

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right">
                        {item.label}
                        {count > 0 && ` (${count})`}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return button;
              })}
            </nav>

            {/* Collapse toggle */}
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </Button>
            </div>
          </aside>

          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black z-40 md:hidden"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <motion.aside
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 md:hidden"
                >
                  <div className="flex items-center justify-between px-4 h-14 border-b border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg mesh-gradient flex items-center justify-center text-white font-bold text-sm">
                        H
                      </div>
                      <span className="font-bold text-lg">HiClaw</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} aria-label="关闭菜单">
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                  <nav className="py-2">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      const count = countMap[item.id];
                      const hasNotification = sectionsWithNotifications.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm relative ${
                            isActive
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium'
                              : 'text-muted-foreground hover:bg-accent'
                          }`}
                          aria-label={item.label}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : ''}`} />
                          <span>{item.label}</span>
                          {count > 0 && (
                            <Badge
                              variant="secondary"
                              className="ml-auto text-[10px] h-5 min-w-[20px] px-1.5"
                            >
                              {count}
                            </Badge>
                          )}
                          {hasNotification && !isActive && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse ml-1" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Header */}
            <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-3 px-4 sticky top-0 z-30">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开菜单"
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="搜索... (⌘K)"
                  value={debouncedQuery}
                  onChange={(e) => setDebouncedQuery(e.target.value)}
                  className="pl-9 h-9 bg-background/50"
                  aria-label="全局搜索"
                />
              </div>

              {/* Cluster Status Badges (only when connected) */}
              {isConnected && (
                <div className="hidden lg:flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] h-6 gap-1 px-1.5">
                    <Bot className="w-3 h-3" />
                    {workerCount}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-6 gap-1 px-1.5">
                    <Users className="w-3 h-3" />
                    {teamCount}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-6 gap-1 px-1.5">
                    <Crown className="w-3 h-3" />
                    {managerCount}
                  </Badge>
                </div>
              )}

              {/* Quick Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">快速操作</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>快速操作</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {createActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => handleQuickAction(action.section)}
                        className="cursor-pointer"
                      >
                        <ActionIcon className="w-4 h-4" />
                        {action.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2">
                {/* Refresh All */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleRefreshAll}
                      disabled={isRefreshingAll}
                      aria-label="刷新所有数据"
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>刷新所有数据</TooltipContent>
                </Tooltip>

                {/* Connection Status */}
                <Badge
                  className={`gap-1 text-xs ${
                    isConnected
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                  }`}
                  variant="outline"
                >
                  {isConnected ? (
                    <Wifi className="w-3 h-3" />
                  ) : (
                    <WifiOff className="w-3 h-3" />
                  )}
                  {isConnected ? '已连接' : '未连接'}
                </Badge>

                {versionData?.controller && (
                  <Badge variant="outline" className="text-xs hidden sm:flex">
                    v{versionData.controller}
                  </Badge>
                )}

                {/* Notifications */}
                <NotificationPopover />

                {/* Activity feed (R6-3) */}
                <ActivityFeed />

                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="h-9 w-9"
                  aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>

                {/* Settings */}
                <Button variant="ghost" size="icon" onClick={openSettings} className="h-9 w-9" aria-label="打开设置">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </header>

            {/* Connection Banner */}
            <ConnectionBanner />

            {/* Breadcrumb */}
            <div className="px-4 md:px-6 py-2 border-b border-border/50 bg-background/50">
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Home className="w-3.5 h-3.5" />
                <ChevronSep className="w-3 h-3" />
                <span className="font-medium text-foreground">HiClaw</span>
                <ChevronSep className="w-3 h-3" />
                <span>{activeLabel}</span>
              </nav>
            </div>

            {/* Section Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6" aria-label={`${activeLabel} 区域`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {modernChrome && (
                    <ModernSectionHeader
                      eyebrow={activeMeta?.id?.toUpperCase() ?? 'SECTION'}
                      title={activeLabel}
                      description={activeMeta?.description ?? ''}
                    />
                  )}
                  <SectionErrorBoundary sectionName={activeLabel}>
                    <Suspense fallback={<SectionSkeleton />}>
                      {modernChrome ? (
                        <ActiveSectionComponent />
                      ) : (
                        <ModernChromeFallback
                          reason={`${activeLabel} not migrated — using legacy chrome`}
                        >
                          <ActiveSectionComponent />
                        </ModernChromeFallback>
                      )}
                    </Suspense>
                  </SectionErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Bottom Status Bar */}
            <footer className="h-7 border-t border-border bg-card/80 backdrop-blur-sm flex items-center px-3 gap-3 text-[11px] text-muted-foreground flex-shrink-0">
              {/* Connection status + latency */}
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-amber-500" />
                )}
                <span>{isConnected ? '已连接' : '未连接'}</span>
                {isConnected && connectionLatency != null && (
                  <>
                    <Separator orientation="vertical" className="h-3" />
                    <span className={`flex items-center gap-0.5 ${latencyColor}`}>
                      <Activity className="w-3 h-3" />
                      {latencyText}
                    </span>
                  </>
                )}
              </div>

              <Separator orientation="vertical" className="h-3" />

              {/* Controller URL */}
              <div className="flex items-center gap-1 min-w-0 max-w-[200px]">
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{controllerUrl.replace(/^https?:\/\//, '')}</span>
              </div>

              <Separator orientation="vertical" className="h-3" />

              {/* Last data refresh */}
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>刷新: {lastRefreshText}</span>
              </div>

              <Separator orientation="vertical" className="h-3" />

              {/* Auto-refresh interval */}
              <div className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                <span>间隔: {reconnectInterval / 1000}s</span>
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Matrix status */}
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                <span>
                  {matrixLoggedIn
                    ? matrixSyncing
                      ? 'Matrix 同步中'
                      : 'Matrix 已连接'
                    : 'Matrix 未连接'}
                </span>
                {matrixLoggedIn && (
                  <span className={`w-1.5 h-1.5 rounded-full ${matrixSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                )}
              </div>
            </footer>
          </div>
        </div>

        {/* Settings Dialog */}
        <SettingsDialog />
      </div>
    </TooltipProvider>
  );
}
