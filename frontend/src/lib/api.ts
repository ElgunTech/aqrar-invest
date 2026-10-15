export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

/** CSRF: the server sets the XSRF-TOKEN cookie; every state-changing request echoes it in a header. */
export function csrfHeaders(method = "POST"): Record<string, string> {
  if (method === "GET" || method === "HEAD") return {};
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
  return m ? { "X-XSRF-TOKEN": decodeURIComponent(m[1]) } : {};
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const init: RequestInit = { method, credentials: "same-origin", signal: opts.signal, headers: csrfHeaders(method) };
  if (opts.form) {
    init.body = opts.form;
  } else if (opts.body !== undefined) {
    init.headers = { ...csrfHeaders(method), "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const d = data as { message?: string; fields?: Record<string, string> };
    throw new ApiError(d?.message ?? `Xəta baş verdi (${res.status})`, res.status, d?.fields);
  }
  return data as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? "?" + s : "";
}
