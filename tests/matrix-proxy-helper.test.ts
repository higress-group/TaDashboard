import { describe, expect, it, beforeEach } from "vitest";
import { getMatrixHomeserver } from "@/app/api/matrix/proxy-helper";
import type { NextRequest } from "next/server";

function fakeRequest(url: string): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
  } as unknown as NextRequest;
}

describe("getMatrixHomeserver", () => {
  const originalEnv = process.env.MATRIX_ALLOWED_HOSTS;

  beforeEach(() => {
    delete process.env.MATRIX_ALLOWED_HOSTS;
  });

  it("returns the URL when the host is in the default allow-list", () => {
    const req = fakeRequest("https://example.com/?homeserver=http://localhost:6167");
    expect(getMatrixHomeserver(req)).toBe("http://localhost:6167");
  });

  it("returns the URL for in-cluster Matrix services", () => {
    const req = fakeRequest(
      "https://example.com/?homeserver=https://matrix.hiclaw-system.svc.cluster.local:8448",
    );
    expect(getMatrixHomeserver(req)).toBe(
      "https://matrix.hiclaw-system.svc.cluster.local:8448",
    );
  });

  it("allows hosts in MATRIX_ALLOWED_HOSTS env var", () => {
    process.env.MATRIX_ALLOWED_HOSTS = "matrix.example.internal";
    const req = fakeRequest("https://example.com/?homeserver=https://matrix.example.internal");
    expect(getMatrixHomeserver(req)).toBe("https://matrix.example.internal");
  });

  it("throws when the homeserver query parameter is missing", () => {
    const req = fakeRequest("https://example.com/");
    expect(() => getMatrixHomeserver(req)).toThrow(/Missing homeserver URL/);
  });

  it("throws when the URL is malformed", () => {
    const req = fakeRequest("https://example.com/?homeserver=not%20a%20url");
    expect(() => getMatrixHomeserver(req)).toThrow(/Invalid homeserver URL format/);
  });

  it("throws when the protocol is not http(s)", () => {
    const req = fakeRequest("https://example.com/?homeserver=file:///etc/passwd");
    expect(() => getMatrixHomeserver(req)).toThrow(/Invalid homeserver protocol/);
  });

  it("throws when the host is not on the allow-list", () => {
    const req = fakeRequest("https://example.com/?homeserver=https://evil.example.org");
    expect(() => getMatrixHomeserver(req)).toThrow(/Homeserver host not allowed/);
  });
});