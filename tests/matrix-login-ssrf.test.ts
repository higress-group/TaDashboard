import { describe, it, expect } from 'vitest';
import { isAllowedMatrixHost } from '@/app/api/matrix/proxy-helper';

describe('isAllowedMatrixHost', () => {
  it('accepts the default in-cluster service name', () => {
    expect(isAllowedMatrixHost('http://matrix.hiclaw-system:6167')).toEqual({ ok: true });
    expect(isAllowedMatrixHost('http://matrix.hiclaw-system.svc.cluster.local:6167')).toEqual({ ok: true });
  });

  it('accepts localhost for development', () => {
    expect(isAllowedMatrixHost('http://localhost:6167')).toEqual({ ok: true });
    expect(isAllowedMatrixHost('http://127.0.0.1:6167')).toEqual({ ok: true });
  });

  it('rejects the AWS IMDS metadata endpoint (SSRF)', () => {
    const r = isAllowedMatrixHost('http://169.254.169.254/latest/meta-data/');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not allowed/);
  });

  it('rejects private RFC1918 addresses via .svc.cluster.local bypass', () => {
    expect(isAllowedMatrixHost('http://10.0.0.5:8080/admin').ok).toBe(false);
    expect(isAllowedMatrixHost('http://192.168.1.1/').ok).toBe(false);
    expect(isAllowedMatrixHost('http://172.16.0.1/').ok).toBe(false);
  });

  it('rejects arbitrary public hosts', () => {
    expect(isAllowedMatrixHost('https://attacker.example.com/').ok).toBe(false);
    expect(isAllowedMatrixHost('https://example.com/').ok).toBe(false);
  });

  it('rejects .local hosts unless explicitly allow-listed (SSRF hardening)', () => {
    expect(isAllowedMatrixHost('http://matrix.local/').ok).toBe(false);
    expect(isAllowedMatrixHost('http://my-service.local:8080/').ok).toBe(false);
  });

  it('rejects non-http protocols', () => {
    expect(isAllowedMatrixHost('file:///etc/passwd').ok).toBe(false);
    expect(isAllowedMatrixHost('javascript:alert(1)').ok).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedMatrixHost('not-a-url').ok).toBe(false);
    expect(isAllowedMatrixHost('').ok).toBe(false);
  });

  it('honors the MATRIX_ALLOWED_HOSTS env override', () => {
    const prev = process.env.MATRIX_ALLOWED_HOSTS;
    process.env.MATRIX_ALLOWED_HOSTS = 'matrix.example.com,chat.example.org';
    try {
      expect(isAllowedMatrixHost('https://matrix.example.com/').ok).toBe(true);
      expect(isAllowedMatrixHost('https://chat.example.org/').ok).toBe(true);
      expect(isAllowedMatrixHost('https://not-listed.example.com/').ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.MATRIX_ALLOWED_HOSTS;
      else process.env.MATRIX_ALLOWED_HOSTS = prev;
    }
  });
});