// 백엔드와 약속한 응답 형식
//   성공: { success: true, data: ... }
//   실패: { success: false, error: { code, message } }
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include", // 세션 쿠키 전송
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => null);

  if (res.status === 401) {
    // 로그인 만료: 앱 어디서든 로그인 화면으로 보낼 수 있게 이벤트만 알린다.
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  if (!res.ok || json?.success === false) {
    const err = json?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "요청에 실패했습니다.");
  }
  return (json && "data" in json ? json.data : json) as T;
}
