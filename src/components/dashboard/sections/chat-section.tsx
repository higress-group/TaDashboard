'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  ExternalLink,
  Users,
  Bot,
  Crown,
  UserCheck,
  Copy,
  Check,
  Send,
  LogIn,
  LogOut,
  Hash,
  ArrowDown,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useWorkers } from '@/hooks/use-hiclaw-workers';
import { useTeams } from '@/hooks/use-hiclaw-teams';
import { useManagers } from '@/hooks/use-hiclaw-managers';
import { useHumans } from '@/hooks/use-hiclaw-humans';
import { useInfrastructure } from '@/hooks/use-hiclaw-infrastructure';
import {
  useMatrixRoomMessages,
  useMatrixRoomMembers,
  useMatrixRoomState,
  useMatrixSendMessage,
  useMatrixLogin,
  formatMatrixEvent,
  getRoomNameFromState,
  getRoomTopicFromState,
  DisplayMessage,
} from '@/hooks/use-matrix';
import { useMatrixStore } from '@/lib/matrix-store';
import { useHiClawStore } from '@/lib/hiclaw-store';
import { sanitizeHtml } from '@/lib/utils';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { SectionHeader } from '@/components/dashboard/section-header';

// ============ Helpers ============

// Deterministic avatar color based on user ID
const AVATAR_COLORS = [
  'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  'bg-violet-500/20 text-violet-600 dark:text-violet-400',
  'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  'bg-rose-500/20 text-rose-600 dark:text-rose-400',
  'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  'bg-pink-500/20 text-pink-600 dark:text-pink-400',
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Format timestamp for display
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

// Check if two timestamps are on different days
function isDifferentDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate();
}

// ============ Copy Button ============

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

// ============ Login Form ============

function MatrixLoginForm({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [homeserverUrl, setHomeserverUrl] = useState('');
  const loginMutation = useMatrixLogin();
  const { data: infrastructure } = useInfrastructure();

  // Auto-fill homeserver from infrastructure (compute initial value, no effect needed)
  const effectiveHomeserverUrl = homeserverUrl || infrastructure?.matrix?.homeserver || '';

  const handleLogin = () => {
    if (!username || !password || !effectiveHomeserverUrl) return;
    loginMutation.mutate({ homeserver: effectiveHomeserverUrl, username, password }, {
      onSuccess: () => onLoginSuccess?.(),
    });
  };

  return (
    <Card className="glass-card border-cyan-500/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="font-semibold">登录 Matrix</h3>
            <p className="text-xs text-muted-foreground">连接到 Matrix 服务器以收发消息</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Homeserver 地址</label>
            <Input
              placeholder="http://localhost:6167"
              value={effectiveHomeserverUrl}
              onChange={(e) => setHomeserverUrl(e.target.value)}
              className="h-9 text-sm bg-background/50"
            />
            {infrastructure?.matrix?.homeserver && (
              <p className="text-[10px] text-muted-foreground mt-1">
                从基础设施自动获取: {infrastructure.matrix.homeserver}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">用户名</label>
            <Input
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 text-sm bg-background/50"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">密码</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-sm bg-background/50"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {loginMutation.isError && (
            <div className="flex items-center gap-2 text-red-500 text-xs">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{loginMutation.error?.message || '登录失败'}</span>
            </div>
          )}
          <Button
            onClick={handleLogin}
            disabled={loginMutation.isPending || !username || !password || !effectiveHomeserverUrl}
            className="w-full h-9"
          >
            {loginMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                登录
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <p className="text-[10px] text-muted-foreground">
            提示: HiClaw 的 Human 用户可以作为 Matrix 账号登录。用户名即 Human 名称，初始密码由 Controller 创建时生成。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Room List Item ============

interface RoomInfo {
  id: string;
  name: string;
  type: 'worker' | 'team' | 'manager' | 'human' | 'unknown';
  members: string[];
  parentTeam?: string;
  matrixUserId?: string;
  phase?: string;
}

function RoomListItem({
  room,
  isSelected,
  onClick,
}: {
  room: RoomInfo;
  isSelected: boolean;
  onClick: () => void;
}) {
  const phaseColor: Record<string, string> = {
    Running: 'text-emerald-500',
    Active: 'text-emerald-500',
    Ready: 'text-emerald-500',
    Sleeping: 'text-amber-500',
    Pending: 'text-amber-500',
    Failed: 'text-red-500',
    Stopped: 'text-gray-500',
  };

  const getIcon = () => {
    switch (room.type) {
      case 'team': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'worker': return <Bot className="w-4 h-4 text-orange-500" />;
      case 'manager': return <Crown className="w-4 h-4 text-violet-500" />;
      case 'human': return <UserCheck className="w-4 h-4 text-cyan-500" />;
      default: return <Hash className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <motion.button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
        isSelected
          ? 'bg-orange-500/10 border border-orange-500/30'
          : 'hover:bg-accent border border-transparent'
      }`}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative">
          {getIcon()}
          {room.phase && phaseColor[room.phase] && (
            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${
              room.phase === 'Running' || room.phase === 'Active' || room.phase === 'Ready'
                ? 'bg-emerald-500'
                : room.phase === 'Sleeping' || room.phase === 'Pending'
                  ? 'bg-amber-500'
                  : room.phase === 'Failed'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
            }`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{room.name}</p>
            {room.phase && (
              <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${phaseColor[room.phase] || ''}`}>
                {room.phase}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">{room.id}</p>
            <CopyButton text={room.id} />
          </div>
        </div>
        {room.members && room.members.length > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {room.members.length}
          </Badge>
        )}
      </div>
    </motion.button>
  );
}

// ============ Date Separator ============

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] text-muted-foreground font-medium shrink-0">{date}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ============ Message Bubble ============

function MessageBubble({ message, showSender }: { message: DisplayMessage; showSender: boolean }) {
  const time = formatTime(message.timestamp);
  const isNotice = message.type === 'm.notice';
  const avatarColor = getAvatarColor(message.sender);

  return (
    <div className={`flex gap-2 ${message.isMe ? 'flex-row-reverse' : 'flex-row'} ${showSender ? 'mt-3' : 'mt-0.5'}`}>
      {showSender ? (
        <Avatar className="w-7 h-7 shrink-0">
          <AvatarFallback className={`text-[10px] ${avatarColor}`}>
            {message.senderShort.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-7 shrink-0" />
      )}
      <div className={`max-w-[75%] min-w-0 ${message.isMe ? 'items-end' : 'items-start'}`}>
        {showSender && (
          <div className={`flex items-center gap-2 mb-1 ${message.isMe ? 'justify-end' : ''}`}>
            <span className="text-[10px] font-medium text-muted-foreground">{message.senderShort}</span>
            <span className="text-[10px] text-muted-foreground/50">{time}</span>
            {isNotice && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-violet-500/30 text-violet-500">
                Bot
              </Badge>
            )}
          </div>
        )}
        <div
          className={`rounded-xl px-3 py-2 text-sm break-words inline-block ${
            message.isMe
              ? 'bg-orange-500/15 text-foreground rounded-tr-sm'
              : isNotice
                ? 'bg-violet-500/10 text-foreground rounded-tl-sm border border-violet-500/10'
                : 'bg-muted/80 text-foreground rounded-tl-sm'
          }`}
        >
          {message.formattedContent ? (
            <div
              className="matrix-html-content [&>p]:mb-1 [&>br]:block [&>pre]:bg-muted/50 [&>pre]:rounded [&>pre]:p-2 [&>code]:bg-muted/50 [&>code]:px-1 [&>code]:rounded text-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.formattedContent) }}
            />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Chat Panel ============

function ChatPanel({ room }: { room: RoomInfo }) {
  const { userId, isLoggedIn } = useMatrixStore();
  const messagesQuery = useMatrixRoomMessages(room.id);
  const membersQuery = useMatrixRoomMembers(room.id);
  const stateQuery = useMatrixRoomState(room.id);
  const sendMessage = useMatrixSendMessage();
  const [inputValue, setInputValue] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Flatten all pages of messages
  const allMessages = useMemo(() => {
    const pages = messagesQuery.data?.pages || [];
    const events = pages.flatMap((page) => page.chunk || []);
    const reversed = [...events].reverse();
    return reversed
      .map((e) => formatMatrixEvent(e, userId))
      .filter((m): m is DisplayMessage => m !== null);
  }, [messagesQuery.data, userId]);

  // Compute display messages with sender grouping and day separators
  const displayItems = useMemo(() => {
    const items: Array<
      | { type: 'date'; date: string; key: string }
      | { type: 'message'; message: DisplayMessage; showSender: boolean; key: string }
    > = [];

    allMessages.forEach((msg, i) => {
      const prevMsg = i > 0 ? allMessages[i - 1] : null;
      const showDateSeparator = !prevMsg || isDifferentDay(msg.timestamp, prevMsg.timestamp);
      const showSender = !prevMsg || prevMsg.sender !== msg.sender || prevMsg.timestamp - msg.timestamp > 300000 || showDateSeparator;

      if (showDateSeparator) {
        items.push({ type: 'date', date: formatDate(msg.timestamp), key: `date-${msg.timestamp}` });
      }

      items.push({
        type: 'message',
        message: msg,
        showSender,
        key: msg.id,
      });
    });

    return items;
  }, [allMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [displayItems, autoScroll]);

  // Detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ roomId: room.id, body: inputValue.trim() }, {
      onSuccess: () => {
        setInputValue('');
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      },
    });
  }, [inputValue, room.id, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Room members info
  const memberList = useMemo(() => {
    const members = membersQuery.data?.chunk || [];
    return members
      .filter((e) => e.type === 'm.room.member' && e.content?.membership === 'join')
      .map((e) => ({
        userId: e.state_key || '',
        displayName: e.content?.displayname || e.state_key?.split(':')[0]?.slice(1) || '',
        avatarUrl: e.content?.avatar_url,
      }));
  }, [membersQuery.data]);

  // Room name & topic from state
  const roomName = useMemo(() => {
    const stateEvents = stateQuery.data || [];
    return getRoomNameFromState(stateEvents) || room.name;
  }, [stateQuery.data, room.name]);

  const roomTopic = useMemo(() => {
    const stateEvents = stateQuery.data || [];
    return getRoomTopicFromState(stateEvents);
  }, [stateQuery.data]);

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center h-full text-center p-8">
        <div>
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">需要登录 Matrix</h3>
          <p className="text-sm text-muted-foreground">请先登录 Matrix 账号以查看和发送消息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 bg-card/30">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{roomName}</h3>
              {roomTopic && (
                <p className="text-[10px] text-muted-foreground truncate">{roomTopic}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {memberList.length} 成员
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowMembers(!showMembers)}
              title={showMembers ? '隐藏成员列表' : '显示成员列表'}
            >
              <Users className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px]" asChild>
              <a
                href={`https://app.element.io/#/room/${room.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="在 Element Web 中打开"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Element
              </a>
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        >
          {messagesQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-3/4 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">暂无消息</p>
                <p className="text-xs text-muted-foreground mt-1">发送第一条消息开始对话</p>
              </div>
            </div>
          ) : (
            <>
              {messagesQuery.hasNextPage && (
                <div className="flex justify-center mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => messagesQuery.fetchNextPage()}
                    disabled={messagesQuery.isFetchingNextPage}
                  >
                    {messagesQuery.isFetchingNextPage ? (
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <ArrowDown className="w-3 h-3 mr-1" />
                    )}
                    加载更早消息
                  </Button>
                </div>
              )}
              {displayItems.map((item) =>
                item.type === 'date' ? (
                  <DateSeparator key={item.key} date={item.date} />
                ) : (
                  <MessageBubble key={item.key} message={item.message} showSender={item.showSender} />
                )
              )}
            </>
          )}
          {!autoScroll && displayItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky bottom-2 flex justify-center"
            >
              <Button
                variant="secondary"
                size="sm"
                className="text-xs rounded-full shadow-lg"
                onClick={() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    setAutoScroll(true);
                  }
                }}
              >
                <ArrowDown className="w-3 h-3 mr-1" />
                回到最新
              </Button>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-3 shrink-0 bg-card/30">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`发送消息到 ${roomName}... (Enter 发送, Shift+Enter 换行)`}
                className="w-full resize-none rounded-lg border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 min-h-[36px] max-h-[120px] placeholder:text-muted-foreground/50"
                rows={1}
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <Button
              size="sm"
              className="h-9 w-9 p-0 shrink-0"
              onClick={handleSend}
              disabled={!inputValue.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {sendMessage.isError && (
            <p className="text-red-500 text-[10px] mt-1">发送失败: {sendMessage.error?.message}</p>
          )}
        </div>
      </div>

      {/* Members Sidebar */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border overflow-hidden shrink-0"
          >
            <div className="w-[240px] h-full flex flex-col">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <h4 className="font-semibold text-xs">房间成员 ({memberList.length})</h4>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowMembers(false)}>
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                {membersQuery.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))
                ) : (
                  memberList.map((member) => {
                    const color = getAvatarColor(member.userId);
                    return (
                      <div key={member.userId} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className={`text-[8px] ${color}`}>
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{member.displayName}</p>
                          <p className="text-[9px] text-muted-foreground font-mono truncate">{member.userId}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ Human-in-the-Loop Panel ============

function HumanPanel() {
  const { data: humans, isLoading } = useHumans();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-cyan-500" />
        Human-in-the-Loop
      </h3>
      {isLoading ? (
        <Card className="glass-card">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ) : humans && humans.length > 0 ? (
        humans.map((human) => {
          const color = getAvatarColor(human.matrixUserID || human.name);
          return (
            <Card key={human.name} className="glass-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className={`text-[8px] ${color}`}>
                      {(human.displayName || human.name).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{human.displayName}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">@{human.name}</p>
                  </div>
                  <Badge
                    variant={human.phase === 'Active' ? 'default' : 'secondary'}
                    className="text-[9px]"
                  >
                    {human.phase}
                  </Badge>
                </div>
                {human.matrixUserID && (
                  <div className="flex items-center gap-1 mt-2">
                    <p className="text-[9px] text-muted-foreground font-mono truncate flex-1">
                      {human.matrixUserID}
                    </p>
                    <CopyButton text={human.matrixUserID} />
                  </div>
                )}
                {human.initialPassword && (
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <p className="text-[9px] text-amber-600 dark:text-amber-400">初始密码已生成</p>
                    <CopyButton text={human.initialPassword} />
                  </div>
                )}
                {human.rooms && human.rooms.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-muted-foreground mb-1">所在房间 ({human.rooms.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {human.rooms.slice(0, 2).map((roomId) => (
                        <Badge key={roomId} variant="outline" className="text-[8px]">
                          {roomId.slice(0, 15)}...
                        </Badge>
                      ))}
                      {human.rooms.length > 2 && (
                        <Badge variant="outline" className="text-[8px]">+{human.rooms.length - 2}</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card className="glass-card">
          <CardContent className="p-6 text-center">
            <UserCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">暂无人类用户</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Room Topology ============

function RoomTopology({ rooms }: { rooms: RoomInfo[] }) {
  const teamRooms = rooms.filter((r) => r.type === 'team');
  const workerRooms = rooms.filter((r) => r.type === 'worker');
  const managerRooms = rooms.filter((r) => r.type === 'manager');

  const topology = useMemo(() => {
    return teamRooms.map((teamRoom) => {
      const teamWorkers = workerRooms.filter((w) => w.parentTeam === teamRoom.parentTeam);
      return { team: teamRoom, workers: teamWorkers, managers: managerRooms };
    });
  }, [teamRooms, workerRooms, managerRooms]);

  if (topology.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4 text-emerald-500" />
        房间拓扑
      </h3>
      {topology.map(({ team, workers: teamWorkers, managers: teamManagers }) => (
        <Card key={team.id} className="glass-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3 h-3 text-emerald-500" />
              <span className="font-medium text-xs">{team.parentTeam}</span>
              <Badge variant="outline" className="text-[8px] ml-auto">
                {teamWorkers.length + teamManagers.length}
              </Badge>
            </div>
            <div className="space-y-1.5 ml-5">
              {teamManagers.map((mgr) => (
                <div key={mgr.id} className="flex items-center gap-1.5 text-[10px]">
                  <Crown className="w-3 h-3 text-violet-500" />
                  <span className="font-medium">{mgr.name}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="text-muted-foreground">团队</span>
                </div>
              ))}
              {teamWorkers.map((wr) => (
                <div key={wr.id} className="flex items-center gap-1.5 text-[10px]">
                  <Bot className="w-3 h-3 text-orange-500" />
                  <span className="font-medium">{wr.name}</span>
                  <span className="text-muted-foreground">↔</span>
                  <span className="text-muted-foreground">团队</span>
                </div>
              ))}
              {teamWorkers.length === 0 && teamManagers.length === 0 && (
                <p className="text-[10px] text-muted-foreground">暂无成员</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ Matrix Connection Status Banner ============

function MatrixStatusBanner({ isLoggedIn, onLoginClick }: { isLoggedIn: boolean; onLoginClick: () => void }) {
  if (isLoggedIn) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2"
    >
      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="text-xs text-amber-600 dark:text-amber-400 flex-1">
        未登录 Matrix - 可以查看房间列表，但无法查看消息和发送消息
      </p>
      <Button variant="outline" size="sm" className="h-6 text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400" onClick={onLoginClick}>
        <LogIn className="w-3 h-3 mr-1" />
        登录
      </Button>
    </motion.div>
  );
}

// ============ Main Chat Section ============

export function ChatSection() {
  const { data: workers, isLoading: workersLoading, refetch: refetchWorkers } = useWorkers();
  const { data: teams, isLoading: teamsLoading, refetch: refetchTeams } = useTeams();
  const { data: managers, isLoading: managersLoading, refetch: refetchManagers } = useManagers();
  const { data: humans, isLoading: humansLoading, refetch: refetchHumans } = useHumans();
  const { isConnected } = useHiClawStore();
  const { isLoggedIn, userId, logout, homeserver } = useMatrixStore();

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState('');
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const isLoading = workersLoading || teamsLoading || managersLoading || humansLoading;
  const hasError = !isConnected;

  const handleRefresh = useCallback(() => {
    refetchWorkers();
    refetchTeams();
    refetchManagers();
    refetchHumans();
  }, [refetchWorkers, refetchTeams, refetchManagers, refetchHumans]);

  // Build room list from HiClaw data
  const rooms: RoomInfo[] = useMemo(() => {
    const roomList: RoomInfo[] = [];

    teams?.forEach((team) => {
      if (team.teamRoomID) {
        roomList.push({
          id: team.teamRoomID,
          name: `${team.name} 团队房间`,
          type: 'team',
          members: team.workerNames || [],
          parentTeam: team.name,
          phase: team.phase,
        });
      }
    });

    workers?.forEach((worker) => {
      if (worker.roomID) {
        roomList.push({
          id: worker.roomID,
          name: `${worker.name} 房间`,
          type: 'worker',
          members: [worker.matrixUserID].filter(Boolean),
          parentTeam: worker.team,
          matrixUserId: worker.matrixUserID,
          phase: worker.phase,
        });
      }
    });

    managers?.forEach((manager) => {
      if (manager.roomID) {
        roomList.push({
          id: manager.roomID,
          name: `${manager.name} 房间`,
          type: 'manager',
          members: [manager.matrixUserID].filter(Boolean),
          matrixUserId: manager.matrixUserID,
          phase: manager.phase,
        });
      }
    });

    return roomList;
  }, [workers, teams, managers]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (!roomFilter) return rooms;
    const q = roomFilter.toLowerCase();
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.members.some((m) => m.toLowerCase().includes(q))
    );
  }, [rooms, roomFilter]);

  // Selected room info
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  if (hasError) {
    return <ApiErrorState />;
  }

  return (
    <div className="space-y-0 h-[calc(100vh-10rem)] flex flex-col">
      <div className="shrink-0 mb-3">
        <SectionHeader
          title="Matrix 聊天"
          description="实时通信与人机协同"
          isLive={isConnected}
          onRefresh={handleRefresh}
          actions={
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <Unlock className="w-3 h-3" />
                    Matrix 已连接
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono max-w-[120px] truncate">
                    {userId?.split(':')[0].slice(1)}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={logout}>
                    <LogOut className="w-3 h-3 mr-1" />
                    登出
                  </Button>
                </>
              ) : (
                <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <LogIn className="w-3 h-3" />
                      登录 Matrix
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>登录 Matrix 服务器</DialogTitle>
                    </DialogHeader>
                    <MatrixLoginForm onLoginSuccess={() => setShowLoginDialog(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />
      </div>

      {/* Matrix Status Banner */}
      <MatrixStatusBanner isLoggedIn={isLoggedIn} onLoginClick={() => setShowLoginDialog(true)} />

      {/* Main Layout: Room List + Chat + Sidebar */}
      <div className="flex-1 flex gap-3 min-h-0 mt-3">
        {/* Left: Room List */}
        <div className="w-72 shrink-0 flex flex-col border border-border rounded-xl bg-card/30 backdrop-blur-sm overflow-hidden">
          {/* Room Search */}
          <div className="p-2.5 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="搜索房间..."
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="h-7 pl-7 text-xs bg-background/50"
              />
            </div>
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">暂无聊天房间</p>
                <p className="text-[10px] text-muted-foreground mt-1">创建 Worker 或 Team 后会自动生成 Matrix 房间</p>
              </div>
            ) : (
              filteredRooms.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <RoomListItem
                    room={room}
                    isSelected={selectedRoomId === room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                  />
                </motion.div>
              ))
            )}
          </div>

          {/* Matrix Status */}
          <div className="p-2.5 border-t border-border shrink-0">
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-muted-foreground truncate">
                  已登录: {userId?.split(':')[0].slice(1)}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-[10px] text-muted-foreground">未登录 - 仅可查看房间列表</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: Chat Panel */}
        <div className="flex-1 border border-border rounded-xl bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col min-w-0">
          {selectedRoom ? (
            <ChatPanel room={selectedRoom} />
          ) : (
            <div className="flex items-center justify-center h-full text-center p-8">
              <div>
                <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">选择房间开始聊天</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  从左侧房间列表中选择一个 Matrix 房间，即可查看消息记录和发送消息。
                  {isLoggedIn ? '' : ' 请先登录 Matrix 账号以发送消息。'}
                </p>
                {!isLoggedIn && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowLoginDialog(true)}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    登录 Matrix
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Info Panel */}
        <div className="w-60 shrink-0 space-y-4 overflow-y-auto custom-scrollbar hidden xl:block">
          <RoomTopology rooms={rooms} />
          <HumanPanel />
        </div>
      </div>
    </div>
  );
}
