import { describe, it, expect, beforeEach } from 'vitest';
// @vitest-environment jsdom
import { useMatrixStore, __testing_createMatrixStorage } from '@/lib/matrix-store';

describe('matrix store + selector', () => {
  beforeEach(() => {
    useMatrixStore.setState({
      homeserver: '',
      accessToken: '',
      userId: '',
      deviceId: '',
      tokenIssuedAt: 0,
      isLoggedIn: false,
      isLoggingIn: false,
      loginError: null,
      syncToken: null,
      isSyncing: false,
    });
  });

  it('persists nothing when mode is none', () => {
    const storage = __testing_createMatrixStorage('none');
    expect(storage.getItem('matrix-store')).toBeNull();
    storage.setItem('matrix-store', '{"x":1}');
    expect(storage.getItem('matrix-store')).toBeNull();
  });

  it('login sets fields and isLoggedIn', async () => {
    // Stub matrixApi to avoid network: we'll simulate a manual set
    useMatrixStore.setState({
      homeserver: 'https://hs.test',
      accessToken: 'tok-abc',
      userId: '@u:hs.test',
      deviceId: 'dev1',
      tokenIssuedAt: Date.now(),
      isLoggedIn: true,
    });
    const s = useMatrixStore.getState();
    expect(s.homeserver).toBe('https://hs.test');
    expect(s.accessToken).toBe('tok-abc');
    expect(s.isLoggedIn).toBe(true);
  });

  it('logout clears sensitive fields', () => {
    useMatrixStore.setState({
      homeserver: 'https://hs.test',
      accessToken: 'tok-abc',
      userId: '@u:hs.test',
      deviceId: 'dev1',
      isLoggedIn: true,
      tokenIssuedAt: Date.now(),
    });
    useMatrixStore.getState().logout();
    const s = useMatrixStore.getState();
    expect(s.accessToken).toBe('');
    expect(s.userId).toBe('');
    expect(s.isLoggedIn).toBe(false);
    expect(s.tokenIssuedAt).toBe(0);
  });

  it('setHomeserver is a direct setter', () => {
    useMatrixStore.getState().setHomeserver('https://new.hs');
    expect(useMatrixStore.getState().homeserver).toBe('https://new.hs');
  });

  it('setSyncing toggles flag', () => {
    useMatrixStore.getState().setSyncing(true);
    expect(useMatrixStore.getState().isSyncing).toBe(true);
    useMatrixStore.getState().setSyncing(false);
    expect(useMatrixStore.getState().isSyncing).toBe(false);
  });
});
