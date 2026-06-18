'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, ExternalLink, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import { timeAgo } from '@/lib/format';

export interface ActivityFeedItem {
  id: string;
  kind: 'audit' | 'matrix' | 'infrastructure';
  ts: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  resourceId: string | null;
  preview: string | null;
  link: string | null;
}

async function fetchActivity(): Promise<ActivityFeedItem[]> {
  const res = await fetch('/api/activity', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load activity feed');
  const body = await res.json() as { items?: ActivityFeedItem[] };
  return Array.isArray(body.items) ? body.items : [];
}

const KIND_BADGE: Record<ActivityFeedItem['kind'], string> = {
  audit: 'border-orange-500/30 text-orange-600 dark:text-orange-400',
  matrix: 'border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
  infrastructure: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
};

export function ActivityFeed() {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['activity-feed'],
    queryFn: fetchActivity,
    enabled: open,
    refetchInterval: open ? 5_000 : false,
    ...DEFAULT_QUERY_CONFIG,
    staleTime: 0, // Always refetch when opened
  });

  const items = query.data ?? [];
  const last = items[0]?.ts;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setOpen(!open)}
        title="活动"
        aria-label="活动 feed"
        aria-expanded={open}
      >
        <Activity className="w-3 h-3" />
        活动
        {last && (
          <span className="ml-1 text-[9px] text-muted-foreground">
            {timeAgo(last)}
          </span>
        )}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-[480px] overflow-y-auto rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl z-50"
            role="dialog"
            aria-label="活动 feed"
          >
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold text-xs">活动 feed</h4>
              <span className="text-[10px] text-muted-foreground">{items.length} / 20</span>
            </div>
            {query.isError ? (
              <div className="p-3 flex items-center gap-2 text-[10px] text-red-500" role="status">
                <AlertCircle className="w-3 h-3" />
                <span>活动加载失败；显示最近缓存。</span>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-[10px] text-muted-foreground">
                暂无活动。
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.link ? (
                      <a
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 hover:bg-accent transition-colors"
                      >
                        <FeedRow item={item} />
                      </a>
                    ) : (
                      <div className="block px-3 py-2">
                        <FeedRow item={item} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedRow({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="flex items-start gap-2">
      <Badge
        variant="outline"
        className={`text-[8px] px-1 py-0 h-3.5 shrink-0 ${KIND_BADGE[item.kind]}`}
      >
        {item.kind}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-foreground truncate">
          <span className="font-mono text-muted-foreground">{item.action ?? 'event'}</span>
          {item.resourceId && (
            <span className="ml-1 text-muted-foreground">· {item.resourceId}</span>
          )}
          {item.actor && (
            <span className="ml-1 text-muted-foreground">· @{item.actor}</span>
          )}
        </p>
        {item.preview && (
          <p className="text-[10px] text-muted-foreground line-clamp-2">{item.preview}</p>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(item.ts)}</span>
      {item.link && <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />}
    </div>
  );
}