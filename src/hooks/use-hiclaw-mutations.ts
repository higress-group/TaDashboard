import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type {
  CreateWorkerRequest,
  UpdateWorkerRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  CreateHumanRequest,
  UpdateHumanRequest,
  CreateManagerRequest,
  UpdateManagerRequest,
  CreateConsumerRequest,
} from '@/lib/hiclaw-api';
import { toast } from 'sonner';
import { useNotificationStore } from '@/lib/notification-store';
import { ApiClientError, describeApiError } from '@/lib/api-errors';
import { recordAudit } from '@/lib/audit';

function useNotify() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  return addNotification;
}

function formatError(err: unknown): { title: string; description: string; code: string } {
  if (err instanceof ApiClientError) {
    const hint = describeApiError(err.code);
    return { title: hint.title, description: `${err.message}`, code: err.code };
  }
  const message = err instanceof Error ? err.message : '未知错误';
  return { title: '请求失败', description: message, code: 'INTERNAL_ERROR' };
}

function recordFailure(
  action: Parameters<typeof recordAudit>[0]['action'],
  resource: string,
  resourceId: string | undefined,
  code: string,
  description: string,
): void {
  recordAudit({
    action,
    resource,
    resourceId,
    metadata: { outcome: 'failure', code, error: description.slice(0, 200) },
  });
}

// Worker Mutations
export function useCreateWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (data: CreateWorkerRequest) => hiclawApi.createWorker(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`Worker "${variables.name}" 创建成功`);
      addNotification({ type: 'success', title: 'Worker 创建成功', message: `Worker "${variables.name}" 已创建` });
      recordAudit({
        action: 'worker.create',
        resource: 'worker',
        resourceId: variables.name,
        metadata: { runtime: variables.runtime, model: variables.model },
      });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${variables.name}" 创建失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 创建失败`, message: description });
      recordFailure('worker.create', 'worker', variables.name, code, description);
    },
  });
}

export function useDeleteWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.deleteWorker(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`Worker "${name}" 已删除`);
      addNotification({ type: 'success', title: 'Worker 已删除', message: `Worker "${name}" 已删除` });
      recordAudit({ action: 'worker.delete', resource: 'worker', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${name}" 删除失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 删除失败`, message: description });
      recordFailure('worker.delete', 'worker', name, code, description);
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateWorkerRequest }) =>
      hiclawApi.updateWorker(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-worker-detail', variables.name] });
      toast.success(`Worker "${variables.name}" 更新成功`);
      addNotification({ type: 'success', title: 'Worker 更新成功', message: `Worker "${variables.name}" 已更新` });
      recordAudit({ action: 'worker.update', resource: 'worker', resourceId: variables.name });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${variables.name}" 更新失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 更新失败`, message: description });
      recordFailure('worker.update', 'worker', variables.name, code, description);
    },
  });
}

export function useWakeWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.wakeWorker(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      toast.success(`Worker "${name}" 已唤醒`);
      addNotification({ type: 'success', title: 'Worker 已唤醒', message: `Worker "${name}" 已唤醒` });
      recordAudit({ action: 'worker.wake', resource: 'worker', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${name}" 唤醒失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 唤醒失败`, message: description });
      recordFailure('worker.wake', 'worker', name, code, description);
    },
  });
}

export function useSleepWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.sleepWorker(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      toast.success(`Worker "${name}" 已休眠`);
      addNotification({ type: 'success', title: 'Worker 已休眠', message: `Worker "${name}" 已休眠` });
      recordAudit({ action: 'worker.sleep', resource: 'worker', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${name}" 休眠失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 休眠失败`, message: description });
      recordFailure('worker.sleep', 'worker', name, code, description);
    },
  });
}

export function useEnsureReadyWorker() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.ensureReadyWorker(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-workers'] });
      toast.success(`Worker "${name}" 已请求就绪`);
      addNotification({ type: 'success', title: 'Worker 就绪请求已发送', message: `Worker "${name}" 已请求就绪` });
      recordAudit({ action: 'worker.ensure-ready', resource: 'worker', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`Worker "${name}" 就绪请求失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Worker 就绪失败`, message: description });
      recordFailure('worker.ensure-ready', 'worker', name, code, description);
    },
  });
}

// Team Mutations
export function useCreateTeam() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (data: CreateTeamRequest) => hiclawApi.createTeam(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-teams'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`团队 "${variables.name}" 创建成功`);
      addNotification({ type: 'success', title: '团队创建成功', message: `团队 "${variables.name}" 已创建` });
      recordAudit({
        action: 'team.create',
        resource: 'team',
        resourceId: variables.name,
        metadata: { leader: variables.leader?.name, workers: variables.workerNames?.length ?? 0 },
      });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`团队 "${variables.name}" 创建失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 团队创建失败`, message: description });
      recordFailure('team.create', 'team', variables.name, code, description);
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.deleteTeam(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-teams'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`团队 "${name}" 已删除`);
      addNotification({ type: 'success', title: '团队已删除', message: `团队 "${name}" 已删除` });
      recordAudit({ action: 'team.delete', resource: 'team', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`团队 "${name}" 删除失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 团队删除失败`, message: description });
      recordFailure('team.delete', 'team', name, code, description);
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateTeamRequest }) =>
      hiclawApi.updateTeam(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-teams'] });
      toast.success(`团队 "${variables.name}" 更新成功`);
      addNotification({ type: 'success', title: '团队更新成功', message: `团队 "${variables.name}" 已更新` });
      recordAudit({ action: 'team.update', resource: 'team', resourceId: variables.name });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`团队 "${variables.name}" 更新失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 团队更新失败`, message: description });
      recordFailure('team.update', 'team', variables.name, code, description);
    },
  });
}

// Human Mutations
export function useCreateHuman() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (data: CreateHumanRequest) => hiclawApi.createHuman(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-humans'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`人类用户 "${variables.displayName}" 创建成功`);
      addNotification({ type: 'success', title: '用户创建成功', message: `用户 "${variables.displayName}" 已创建` });
      recordAudit({
        action: 'human.create',
        resource: 'human',
        resourceId: variables.name,
        metadata: { permissionLevel: variables.permissionLevel ?? 1 },
      });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`用户 "${variables.displayName}" 创建失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 用户创建失败`, message: description });
      recordFailure('human.create', 'human', variables.name, code, description);
    },
  });
}

export function useDeleteHuman() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.deleteHuman(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-humans'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`用户 "${name}" 已删除`);
      addNotification({ type: 'success', title: '用户已删除', message: `用户 "${name}" 已删除` });
      recordAudit({ action: 'human.delete', resource: 'human', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`用户 "${name}" 删除失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 用户删除失败`, message: description });
      recordFailure('human.delete', 'human', name, code, description);
    },
  });
}

// Manager Mutations
export function useCreateManager() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (data: CreateManagerRequest) => hiclawApi.createManager(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-managers'] });
      toast.success(`Manager "${variables.name}" 创建成功`);
      addNotification({ type: 'success', title: 'Manager 创建成功', message: `Manager "${variables.name}" 已创建` });
      recordAudit({
        action: 'manager.create',
        resource: 'manager',
        resourceId: variables.name,
        metadata: { model: variables.model, runtime: variables.runtime },
      });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`Manager "${variables.name}" 创建失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Manager 创建失败`, message: description });
      recordFailure('manager.create', 'manager', variables.name, code, description);
    },
  });
}

export function useDeleteManager() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (name: string) => hiclawApi.deleteManager(name),
    onSuccess: (_, name) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-managers'] });
      toast.success(`Manager "${name}" 已删除`);
      addNotification({ type: 'success', title: 'Manager 已删除', message: `Manager "${name}" 已删除` });
      recordAudit({ action: 'manager.delete', resource: 'manager', resourceId: name });
    },
    onError: (err, name) => {
      const { title, description, code } = formatError(err);
      toast.error(`Manager "${name}" 删除失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Manager 删除失败`, message: description });
      recordFailure('manager.delete', 'manager', name, code, description);
    },
  });
}

export function useUpdateManager() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateManagerRequest }) =>
      hiclawApi.updateManager(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-managers'] });
      toast.success(`Manager "${variables.name}" 更新成功`);
      addNotification({ type: 'success', title: 'Manager 更新成功', message: `Manager "${variables.name}" 已更新` });
      recordAudit({ action: 'manager.update', resource: 'manager', resourceId: variables.name });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`Manager "${variables.name}" 更新失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Manager 更新失败`, message: description });
      recordFailure('manager.update', 'manager', variables.name, code, description);
    },
  });
}

// Gateway Mutations
export function useCreateConsumer() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (data: CreateConsumerRequest) => hiclawApi.createConsumer(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-consumers'] });
      toast.success(`Consumer "${variables.name}" 创建成功`);
      addNotification({ type: 'success', title: 'Consumer 创建成功', message: `Consumer "${variables.name}" 已创建` });
      recordAudit({ action: 'consumer.create', resource: 'consumer', resourceId: variables.name });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`Consumer "${variables.name}" 创建失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Consumer 创建失败`, message: description });
      recordFailure('consumer.create', 'consumer', variables.name, code, description);
    },
  });
}

export function useDeleteConsumer() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: (id: string) => hiclawApi.deleteConsumer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-consumers'] });
      toast.success(`Consumer 已删除`);
      addNotification({ type: 'success', title: 'Consumer 已删除', message: `Consumer ${id} 已删除` });
      recordAudit({ action: 'consumer.delete', resource: 'consumer', resourceId: id });
    },
    onError: (err, id) => {
      const { title, description, code } = formatError(err);
      toast.error(`Consumer "${id}" 删除失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · Consumer 删除失败`, message: description });
      recordFailure('consumer.delete', 'consumer', id, code, description);
    },
  });
}

// Human Update Mutation
export function useUpdateHuman() {
  const queryClient = useQueryClient();
  const addNotification = useNotify();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateHumanRequest }) =>
      hiclawApi.updateHuman(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hiclaw-humans'] });
      queryClient.invalidateQueries({ queryKey: ['hiclaw-cluster-status'] });
      toast.success(`用户 "${variables.name}" 更新成功`);
      addNotification({ type: 'success', title: '用户更新成功', message: `用户 "${variables.name}" 已更新` });
      recordAudit({ action: 'human.update', resource: 'human', resourceId: variables.name });
    },
    onError: (err, variables) => {
      const { title, description, code } = formatError(err);
      toast.error(`用户 "${variables.name}" 更新失败: ${description}`);
      addNotification({ type: 'error', title: `${title} · 用户更新失败`, message: description });
      recordFailure('human.update', 'human', variables.name, code, description);
    },
  });
}
