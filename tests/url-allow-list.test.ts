import { describe, it, expect, afterEach } from 'vitest';
import { buildAllowList, isAllowedMatrixUrl, isAllowedHiclawUrl } from '@/lib/url-allow-list';

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe('buildAllowList', () => {
  const al = buildAllowList('TEST_EXTRA', 'extra.example.com');

  it('allows relative paths starting with /', () => {
    expect(al.isAllowed('/api/test')).toBe(true);
    expect(al.isAllowed('/')).toBe(true);
  });

  it('rejects non-http(s) protocols', () => {
    expect(al.isAllowed('ftp://example.com')).toBe(false);
    expect(al.isAllowed('file:///etc/passwd')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(al.isAllowed('not-a-url')).toBe(false);
    expect(al.isAllowed('')).toBe(false);
  });

  it('allows localhost loopback', () => {
    expect(al.isAllowed('http://localhost:3000')).toBe(true);
    expect(al.isAllowed('https://127.0.0.1:8080')).toBe(true);
  });

  it('allows extra defaults passed to buildAllowList', () => {
    expect(al.isAllowed('https://extra.example.com/api')).toBe(true);
  });

  it('allows cluster-local suffixes', () => {
    expect(al.isAllowed('http://foo.svc')).toBe(true);
    expect(al.isAllowed('https://bar.svc.cluster.local')).toBe(true);
    expect(al.isAllowed('http://baz.cluster.local')).toBe(true);
  });

  it('rejects unrelated public hosts', () => {
    expect(al.isAllowed('https://evil.com')).toBe(false);
    expect(al.isAllowed('http://192.168.1.1')).toBe(false);
  });

  it('respects environment variable extension', () => {
    process.env.TEST_EXTRA = 'env.example.com,10.0.0.1';
    const envAl = buildAllowList('TEST_EXTRA');
    expect(envAl.isAllowed('https://env.example.com')).toBe(true);
    expect(envAl.isAllowed('http://10.0.0.1/path')).toBe(true);
  });
});

describe('isAllowedMatrixUrl', () => {
  it('allows Matrix service hosts', () => {
    expect(isAllowedMatrixUrl('http://matrix:8008/_matrix/client/v3/login')).toBe(true);
    expect(isAllowedMatrixUrl('https://matrix.hiclaw-system.svc.cluster.local')).toBe(true);
  });
});

describe('isAllowedHiclawUrl', () => {
  it('allows HiClaw controller hosts', () => {
    expect(isAllowedHiclawUrl('http://hiclaw-controller:8090/api/v1/status')).toBe(true);
    expect(isAllowedHiclawUrl('https://hiclaw-controller.hiclaw-system.svc/api/v1/workers')).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(isAllowedHiclawUrl('https://evil.com')).toBe(false);
  });
});
