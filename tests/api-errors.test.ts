import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  ApiClientError,
  describeApiError,
  isApiErrorBody,
  jsonErrorBody,
  statusToCode,
  type ApiErrorBody,
} from "@/lib/api-errors";

function jsonResponse(body: unknown, status = 200, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

describe("api-errors / statusToCode", () => {
  it("maps common HTTP statuses to error codes", () => {
    expect(statusToCode(400)).toBe("BAD_REQUEST");
    expect(statusToCode(401)).toBe("UNAUTHORIZED");
    expect(statusToCode(403)).toBe("FORBIDDEN");
    expect(statusToCode(404)).toBe("NOT_FOUND");
    expect(statusToCode(409)).toBe("CONFLICT");
    expect(statusToCode(429)).toBe("RATE_LIMITED");
    expect(statusToCode(503)).toBe("UPSTREAM_UNAVAILABLE");
    expect(statusToCode(504)).toBe("UPSTREAM_UNAVAILABLE");
    expect(statusToCode(500)).toBe("UPSTREAM_ERROR");
  });
});

describe("api-errors / jsonErrorBody", () => {
  it("builds a standard error envelope with optional details and upstream", () => {
    const body = jsonErrorBody("FORBIDDEN", "nope", {
      details: { reason: "policy" },
      upstream: { service: "hiclaw", status: 403, path: "/workers" },
    });
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "nope",
        details: { reason: "policy" },
        upstream: { service: "hiclaw", status: 403, path: "/workers" },
      },
    });
  });

  it("omits details and upstream when not provided", () => {
    const body = jsonErrorBody("INTERNAL_ERROR", "boom");
    expect(body.error).toEqual({ code: "INTERNAL_ERROR", message: "boom" });
  });
});

describe("api-errors / isApiErrorBody", () => {
  it("accepts well-formed envelopes", () => {
    expect(isApiErrorBody({ error: { code: "NOT_FOUND", message: "missing" } })).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody({})).toBe(false);
    expect(isApiErrorBody({ error: { code: 1, message: "x" } })).toBe(false);
    expect(isApiErrorBody({ error: { code: "X" } })).toBe(false);
  });
});

describe("api-errors / ApiClientError.fromResponse", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates from a structured proxy error body", async () => {
    const body: ApiErrorBody = {
      error: {
        code: "UNAUTHORIZED",
        message: "token expired",
        upstream: { service: "matrix", status: 401, path: "/sync" },
      },
    };
    const err = await ApiClientError.fromResponse(jsonResponse(body, 401), "matrix", "/sync");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.status).toBe(401);
    expect(err.service).toBe("matrix");
    expect(err.path).toBe("/sync");
    expect(err.message).toBe("token expired");
  });

  it("falls back to status mapping when the body is not JSON", async () => {
    const res = new Response("forbidden", { status: 403 });
    const err = await ApiClientError.fromResponse(res, "hiclaw", "/workers");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.status).toBe(403);
    expect(err.message).toContain("forbidden");
  });

  it("falls back to statusText when the body is empty", async () => {
    const res = new Response(null, { status: 502, statusText: "Bad Gateway" });
    const err = await ApiClientError.fromResponse(res, "hiclaw", "/workers");
    expect(err.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(err.status).toBe(502);
    expect(err.message).toBe("Bad Gateway");
  });
});

describe("api-errors / describeApiError", () => {
  it("returns friendly titles for upstream failures", () => {
    const hint = describeApiError("UPSTREAM_TIMEOUT");
    expect(hint.title).toMatch(/超时/);
    expect(hint.actionable).toBe(true);
  });

  it("returns a hint for unknown codes", () => {
    const hint = describeApiError(undefined);
    expect(hint.title).toBeTruthy();
    expect(hint.description).toBeTruthy();
  });
});