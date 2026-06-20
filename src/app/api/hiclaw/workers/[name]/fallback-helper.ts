import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken, proxyToHiClaw } from '../../proxy-helper';

export async function proxyWorkerSubresourceOrFallback<T>(
  request: NextRequest,
  controllerUrl: string,
  name: string,
  subresource: 'metrics' | 'events',
  synthesize: (worker: unknown) => T | null,
  wrap: (value: T) => unknown = (value) => value,
): Promise<NextResponse> {
  const native = await proxyToHiClaw(
    request,
    controllerUrl,
    `/api/v1/workers/${encodeURIComponent(name)}/${subresource}`,
    { forwardBody: false },
  );

  if (native.status !== 404) {
    return native;
  }

  const workerResult = await fetchWorkerForFallback(controllerUrl, request, name);
  if (workerResult instanceof NextResponse) {
    return workerResult;
  }

  const fallback = synthesize(workerResult);
  if (!fallback) {
    return NextResponse.json(
      { message: `worker ${name} payload not recognized` },
      { status: 502 },
    );
  }

  return NextResponse.json(wrap(fallback), { status: 200 });
}

async function fetchWorkerForFallback(
  controllerUrl: string,
  request: NextRequest,
  name: string,
): Promise<unknown | NextResponse> {
  const res = await fetch(
    new URL(`/api/v1/workers/${encodeURIComponent(name)}`, controllerUrl).toString(),
    {
      headers: getWorkerFetchHeaders(request),
      cache: 'no-store',
    },
  );

  if (res.status === 404) {
    return NextResponse.json({ message: `worker ${name} not found` }, { status: 404 });
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { message: text || `failed to fetch worker ${name}` },
      { status: res.status },
    );
  }

  try {
    return await res.json();
  } catch {
    return NextResponse.json(
      { message: `worker ${name} returned invalid json` },
      { status: 502 },
    );
  }
}

function getWorkerFetchHeaders(request: NextRequest): Record<string, string> {
  const saToken = getAuthToken();
  const incomingAuth = request.headers.get('authorization');
  const authToken = saToken || (incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, '') : undefined);
  return authToken ? { authorization: `Bearer ${authToken}` } : {};
}
