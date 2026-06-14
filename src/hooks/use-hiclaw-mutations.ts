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

function useNotify() {
  const addNotification = useNotificationStore((s) => s.addNotification);
  return addNotification;
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
    },
    onError: (err, variables) => {
      toast.error(`Worker "${variables.name}" 创建失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 创建失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`Worker "${name}" 删除失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 删除失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`Worker "${variables.name}" 更新失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 更新失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`Worker "${name}" 唤醒失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 唤醒失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`Worker "${name}" 休眠失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 休眠失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`Worker "${name}" 就绪请求失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Worker 就绪请求失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`团队 "${variables.name}" 创建失败: ${err.message}`);
      addNotification({ type: 'error', title: '团队创建失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`团队 "${name}" 删除失败: ${err.message}`);
      addNotification({ type: 'error', title: '团队删除失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`团队 "${variables.name}" 更新失败: ${err.message}`);
      addNotification({ type: 'error', title: '团队更新失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`用户 "${variables.displayName}" 创建失败: ${err.message}`);
      addNotification({ type: 'error', title: '用户创建失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`用户 "${name}" 删除失败: ${err.message}`);
      addNotification({ type: 'error', title: '用户删除失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`Manager "${variables.name}" 创建失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Manager 创建失败', message: err.message });
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
    },
    onError: (err, name) => {
      toast.error(`Manager "${name}" 删除失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Manager 删除失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`Manager "${variables.name}" 更新失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Manager 更新失败', message: err.message });
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
    },
    onError: (err) => {
      toast.error(`Consumer 创建失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Consumer 创建失败', message: err.message });
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
    },
    onError: (err) => {
      toast.error(`Consumer 删除失败: ${err.message}`);
      addNotification({ type: 'error', title: 'Consumer 删除失败', message: err.message });
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
    },
    onError: (err, variables) => {
      toast.error(`用户 "${variables.name}" 更新失败: ${err.message}`);
      addNotification({ type: 'error', title: '用户更新失败', message: err.message });
    },
  });
}
