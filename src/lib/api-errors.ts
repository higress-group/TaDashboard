// Shared error code catalogue for the Next.js proxy routes.
//
// Codes are stable, machine-readable identifiers that the front end can
// switch on. They are deliberately coarse-grained so that we can tighten
// them later without breaking consumers.

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_ERROR"
  | "INVALID_RESPONSE"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    upstream?: {
      status?: number;
      service: "hiclaw" | "matrix";
      path?: string;
    };
  };
}

export function statusToCode(status: number): ApiErrorCode {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502 || status === 503 || status === 504) return "UPSTREAM_UNAVAILABLE";
  if (status >= 500) return "UPSTREAM_ERROR";
  return "INTERNAL_ERROR";
}

export function jsonErrorBody(
  code: ApiErrorCode,
  message: string,
  init: {
    details?: unknown;
    upstream?: ApiErrorBody["error"]["upstream"];
  } = {}
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(init.details !== undefined ? { details: init.details } : {}),
      ...(init.upstream ? { upstream: init.upstream } : {}),
    },
  };
}

export function jsonErrorResponse(
  code: ApiErrorCode,
  message: string,
  init: {
    status?: number;
    details?: unknown;
    upstream?: ApiErrorBody["error"]["upstream"];
  } = {}
): Response {
  const body = jsonErrorBody(code, message, init);
  return Response.json(body, { status: init.status ?? statusToCodeToStatus(code) });
}

export { jsonErrorBody as jsonError };

function statusToCodeToStatus(code: ApiErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "UPSTREAM_TIMEOUT":
      return 504;
    case "UPSTREAM_UNAVAILABLE":
      return 502;
    case "INVALID_RESPONSE":
    case "UPSTREAM_ERROR":
      return 502;
    case "CONFIGURATION_ERROR":
      return 500;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") return false;
  const err = (value as { error?: unknown }).error;
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  return typeof code === "string" && typeof message === "string";
}

// ---------------------------------------------------------------------------
// Client-side error wrapper
// ---------------------------------------------------------------------------

export interface ApiClientErrorInit {
  status?: number;
  service: "hiclaw" | "matrix" | "client";
  path?: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;
  readonly service: "hiclaw" | "matrix" | "client";
  readonly path: string | undefined;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, init: ApiClientErrorInit = { service: "client" }) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = init.status;
    this.service = init.service;
    this.path = init.path;
    this.details = init.details;
  }

  static async fromResponse(
    res: Response,
    service: "hiclaw" | "matrix",
    path?: string,
  ): Promise<ApiClientError> {
    let payload: unknown = null;
    try {
      payload = await res.clone().json();
    } catch {
      try {
        payload = await res.text();
      } catch {
        payload = null;
      }
    }
    if (isApiErrorBody(payload)) {
      return new ApiClientError(payload.error.code, payload.error.message, {
        status: res.status,
        service,
        path,
        details: payload.error.details,
      });
    }
    const fallback = typeof payload === "string" && payload ? payload : res.statusText || `Request failed (${res.status})`;
    return new ApiClientError(statusToCode(res.status), fallback, {
      status: res.status,
      service,
      path,
    });
  }
}

// ---------------------------------------------------------------------------
// Friendly UI hints derived from an error code.
// ---------------------------------------------------------------------------

export interface ErrorHint {
  title: string;
  description: string;
  actionable: boolean;
}

export function describeApiError(code: ApiErrorCode | undefined): ErrorHint {
  switch (code) {
    case "UNAUTHORIZED":
      return {
        title: "未授权",
        description: "Token 缺失或已失效，请重新登录或检查 ServiceAccount 配置。",
        actionable: true,
      };
    case "FORBIDDEN":
      return {
        title: "权限不足",
        description: "当前账号无权执行此操作，请联系管理员调整 RBAC。",
        actionable: true,
      };
    case "NOT_FOUND":
      return {
        title: "资源不存在",
        description: "目标资源已被删除或命名错误，请刷新列表后重试。",
        actionable: false,
      };
    case "CONFLICT":
      return {
        title: "操作冲突",
        description: "资源已存在或状态不允许此操作，请刷新后重试。",
        actionable: false,
      };
    case "RATE_LIMITED":
      return {
        title: "请求过于频繁",
        description: "已触发后端限流，请稍候再试。",
        actionable: false,
      };
    case "UPSTREAM_TIMEOUT":
      return {
        title: "上游超时",
        description: "Controller / Matrix 响应超时，请检查后端连通性。",
        actionable: true,
      };
    case "UPSTREAM_UNAVAILABLE":
      return {
        title: "上游不可达",
        description: "无法连接 Controller / Matrix，请检查网络或服务状态。",
        actionable: true,
      };
    case "UPSTREAM_ERROR":
      return {
        title: "上游错误",
        description: "Controller / Matrix 返回了内部错误，请查看后端日志。",
        actionable: true,
      };
    case "INVALID_RESPONSE":
      return {
        title: "响应格式异常",
        description: "后端返回了非预期格式，请稍后重试或升级版本。",
        actionable: false,
      };
    case "CONFIGURATION_ERROR":
      return {
        title: "配置错误",
        description: "服务端配置缺失或非法，请联系管理员。",
        actionable: true,
      };
    case "BAD_REQUEST":
      return {
        title: "请求参数错误",
        description: "请检查表单字段值是否合法。",
        actionable: false,
      };
    case "INTERNAL_ERROR":
    default:
      return {
        title: "内部错误",
        description: "发生了未知错误，请稍后重试。",
        actionable: false,
      };
  }
}

export { describeApiError as describeErrorCode };