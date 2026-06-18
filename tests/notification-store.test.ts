import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore, type Notification } from '@/lib/notification-store';

describe('notification store', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it('starts empty', () => {
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });

  it('addNotification sets id, timestamp, read=false', () => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: 'OK',
      message: 'done',
    });
    const list = useNotificationStore.getState().notifications;
    expect(list).toHaveLength(1);
    const n: Notification = list[0];
    expect(n.id).toMatch(/^[0-9a-f-]{36}$/); // uuid
    expect(n.timestamp).toBeGreaterThan(0);
    expect(n.read).toBe(false);
  });

  it('addNotification prepends (newest first)', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'A', message: 'a' });
    useNotificationStore.getState().addNotification({ type: 'info', title: 'B', message: 'b' });
    const list = useNotificationStore.getState().notifications;
    expect(list[0].title).toBe('B');
    expect(list[1].title).toBe('A');
  });

  it('caps to 50 newest, dropping oldest', () => {
    const add = useNotificationStore.getState().addNotification;
    for (let i = 0; i < 60; i++) {
      add({ type: 'info', title: `n${i}`, message: 'x' });
    }
    const list = useNotificationStore.getState().notifications;
    expect(list).toHaveLength(50);
    expect(list[0].title).toBe('n59');
    expect(list[49].title).toBe('n10');
  });

  it('markAsRead flips read on the matching id', () => {
    useNotificationStore.getState().addNotification({ type: 'info', title: 'X', message: 'x' });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markAsRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });

  it('markAllRead flips all to read', () => {
    const add = useNotificationStore.getState().addNotification;
    add({ type: 'info', title: 'A', message: 'a' });
    add({ type: 'info', title: 'B', message: 'b' });
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });

  it('clearAll empties the list', () => {
    const add = useNotificationStore.getState().addNotification;
    add({ type: 'info', title: 'A', message: 'a' });
    add({ type: 'info', title: 'B', message: 'b' });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });

  it('unreadCount counts only unread', () => {
    const add = useNotificationStore.getState().addNotification;
    add({ type: 'info', title: 'A', message: 'a' });
    add({ type: 'info', title: 'B', message: 'b' });
    add({ type: 'info', title: 'C', message: 'c' });
    expect(useNotificationStore.getState().unreadCount()).toBe(3);
    const idB = useNotificationStore.getState().notifications[1].id;
    useNotificationStore.getState().markAsRead(idB);
    expect(useNotificationStore.getState().unreadCount()).toBe(2);
  });
});
