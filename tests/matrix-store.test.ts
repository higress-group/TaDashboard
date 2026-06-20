import { describe, expect, it, beforeEach, afterEach } from "vitest";

type MatrixTokenPersist = "session" | "local" | "none";

const ORIGINAL_ENV = { ...process.env };

function resolvePersistModeForTest(mode: MatrixTokenPersist | undefined) {
  if (mode === undefined) {
    delete process.env.NEXT_PUBLIC_MATRIX_TOKEN_PERSIST;
  } else {
    process.env.NEXT_PUBLIC_MATRIX_TOKEN_PERSIST = mode;
  }
  const raw = (process.env.NEXT_PUBLIC_MATRIX_TOKEN_PERSIST || "none").toLowerCase();
  const valid: MatrixTokenPersist[] = ["session", "local", "none"];
  return (valid.includes(raw as MatrixTokenPersist) ? raw : "none") as MatrixTokenPersist;
}

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function makeMemoryStorage(): Storage {
  const stores = new Map<string, string>();
  return {
    get length() {
      return stores.size;
    },
    clear: () => stores.clear(),
    getItem: (k) => (stores.has(k) ? (stores.get(k) as string) : null),
    key: (i) => Array.from(stores.keys())[i] ?? null,
    removeItem: (k) => {
      stores.delete(k);
    },
    setItem: (k, v) => {
      stores.set(k, v);
    },
  };
}

describe("matrix-store / token persistence mode resolver", () => {
  beforeEach(() => {
    resetEnv();
  });
  afterEach(() => {
    resetEnv();
  });

  it("defaults to none (no persistence) when env var is unset", () => {
    expect(resolvePersistModeForTest(undefined)).toBe("none");
  });

  it("uses session storage when explicitly configured", () => {
    expect(resolvePersistModeForTest("session")).toBe("session");
  });

  it("uses local storage when explicitly configured", () => {
    expect(resolvePersistModeForTest("local")).toBe("local");
  });

  it("uses none when configured to skip persistence", () => {
    expect(resolvePersistModeForTest("none")).toBe("none");
  });

  it("falls back to none for unknown values", () => {
    expect(resolvePersistModeForTest("garbage")).toBe("none");
  });
});

describe("matrix-store / __testing_createMatrixStorage", () => {
  beforeEach(() => {
    resetEnv();
    // @ts-expect-error test shim
    delete globalThis.window;
  });
  afterEach(() => {
    // @ts-expect-error test shim
    delete globalThis.window;
  });

  it("returns a no-op storage when mode is 'none'", async () => {
    const { __testing_createMatrixStorage } = await import("@/lib/matrix-store");
    const storage = __testing_createMatrixStorage("none");
    expect(await storage.getItem("matrix-store")).toBeNull();
    expect(storage.setItem("matrix-store", "value")).toBeUndefined();
  });

  it("binds to sessionStorage when mode is 'session'", async () => {
    const session = makeMemoryStorage();
    // @ts-expect-error test shim
    globalThis.window = { sessionStorage: session, localStorage: makeMemoryStorage() };
    const { __testing_createMatrixStorage } = await import("@/lib/matrix-store");
    const storage = __testing_createMatrixStorage("session");
    await storage.setItem("matrix-store", JSON.stringify({ state: { accessToken: "abc" }, version: 2 }));
    expect(session.getItem("matrix-store")).toBeTruthy();
  });

  it("binds to localStorage when mode is 'local'", async () => {
    const local = makeMemoryStorage();
    // @ts-expect-error test shim
    globalThis.window = { sessionStorage: makeMemoryStorage(), localStorage: local };
    const { __testing_createMatrixStorage } = await import("@/lib/matrix-store");
    const storage = __testing_createMatrixStorage("local");
    await storage.setItem("matrix-store", JSON.stringify({ state: { accessToken: "xyz" }, version: 2 }));
    expect(local.getItem("matrix-store")).toBeTruthy();
  });
});