import { tossAvailable, tossQuote } from "@/lib/toss";

// 임시 진단용 엔드포인트 — 배포 환경에서 토스 API가 왜 실패하는지 확인하고 지운다.
// 시크릿 값 자체는 절대 노출하지 않고, 환경변수 존재 여부와 실제 호출 에러 메시지만 보여준다.
export async function GET() {
  const hasKey = !!process.env.TOSS_API_KEY;
  const hasSecret = !!process.env.TOSS_SECRET_KEY;
  const keyLength = process.env.TOSS_API_KEY?.length ?? 0;
  const secretLength = process.env.TOSS_SECRET_KEY?.length ?? 0;

  let tokenError: string | null = null;
  let quoteResult: unknown = null;
  let quoteError: string | null = null;

  try {
    const res = await fetch("https://openapi.tossinvest.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.TOSS_API_KEY ?? "",
        client_secret: process.env.TOSS_SECRET_KEY ?? "",
      }),
      cache: "no-store",
    });
    const body = await res.text();
    if (!res.ok) {
      tokenError = `HTTP ${res.status}: ${body.slice(0, 300)}`;
    }
  } catch (e) {
    tokenError = e instanceof Error ? e.message : String(e);
  }

  try {
    quoteResult = await tossQuote("005930");
  } catch (e) {
    quoteError = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    tossAvailable: tossAvailable(),
    hasKey,
    hasSecret,
    keyLength,
    secretLength,
    tokenError,
    quoteResult,
    quoteError,
  });
}
