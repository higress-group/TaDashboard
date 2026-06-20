import { describe, expect, it, beforeEach, vi } from "vitest";
import { hiclawApi } from "@/lib/hiclaw-api";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function textResponse(body: string, status = 200, contentType = "text/plain"): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

describe("hiclawApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards GET requests through the /api/hiclaw proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ kubeMode: true, totalWorkers: 3 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await hiclawApi.getStatus();

    expect(result).toEqual({ kubeMode: true, totalWorkers: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hiclaw/cluster-status");
    // Default to GET when no method is supplied
    expect((init as RequestInit).method ?? "GET").toBe("GET");
  });

  it("normalizes workers wrapped in { workers } responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ workers: [{ name: "a" }, { name: "b" }], total: 2 })),
    );
    expect(await hiclawApi.listWorkers()).toEqual([{ name: "a" }, { name: "b" }]);
  });

  it("returns an empty array when the controller responds with a non-object payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    expect(await hiclawApi.listTeams()).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));
    expect(await hiclawApi.listHumans()).toEqual([]);
  });

  it("translates admin to leader when creating a team", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: "t1" }));
    vi.stubGlobal("fetch", fetchMock);

    await hiclawApi.createTeam({
      name: "t1",
      admin: { name: "manager-a" },
    } as Parameters<typeof hiclawApi.createTeam>[0]);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.leader).toEqual({ name: "manager-a" });
    expect(body.admin).toBeUndefined();
  });

  it("returns undefined on 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(hiclawApi.deleteWorker("a")).resolves.toBeUndefined();
  });

  it("raises an error when the controller returns a non-JSON body with a 2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("<html>nope</html>", 200, "text/html")));
    await expect(hiclawApi.getVersion()).rejects.toThrow(/non-JSON/);
  });

  it("raises an error when JSON parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })),
    );
    await expect(hiclawApi.getInfrastructure()).rejects.toThrow(/Failed to parse/);
  });

  it("raises an ApiClientError with code FORBIDDEN when the controller rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("forbidden", 403)));
    await expect(hiclawApi.listManagers()).rejects.toMatchObject({
      name: "ApiClientError",
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("sends FormData for package uploads and parses JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ packageUri: "minio://pkg/x" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["payload"], "pkg.zip", { type: "application/zip" });
    const result = await hiclawApi.uploadPackage(file);

    expect(result).toEqual({ packageUri: "minio://pkg/x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hiclaw/packages");
    expect((init as RequestInit).method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // Content-Type is intentionally omitted so the browser sets the multipart boundary.
    expect(init.headers).toBeUndefined();
  });

  it("encodes special characters in resource names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ name: "team/a" }));
    vi.stubGlobal("fetch", fetchMock);

    await hiclawApi.getTeam("team/a");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/hiclaw/teams/team%2Fa");
  });
});