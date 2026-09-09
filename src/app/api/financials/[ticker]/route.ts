import { getNaverCode } from "@/lib/naver";
import { dartAvailable, dartFinancials } from "@/lib/dart";

// ── Yahoo Finance 공개 timeseries API (period 파라미터 지원) ──────────────
// quoteSummary의 fundamentalsTimeSeries 모듈은 이 버전에서 미지원
// ws/fundamentals-timeseries 엔드포인트는 period1/period2 지원 → 5년치 가능
const TS_URL = "https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries";

const INCOME_TYPES = [
  "quarterlyTotalRevenue",
  "quarterlyOperatingIncome",
  "quarterlyNetIncome",
];
const BALANCE_TYPES = [
  "quarterlyTotalAssets",
  "quarterlyStockholdersEquity",
  "quarterlyTotalLiabilitiesNetMinorityInterest",
];

async function fetchTimeSeries(symbol: string, types: string[]) {
  const p1 = Math.floor(new Date("2019-01-01").getTime() / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const url =
    `${TS_URL}/${encodeURIComponent(symbol)}` +
    `?type=${types.join(",")}&period1=${p1}&period2=${p2}&lang=en-US&region=US`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json, */*",
      Referer: "https://finance.yahoo.com/",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`Yahoo timeseries HTTP ${res.status}`);
  return res.json();
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTimeSeries(data: any) {
  const results: any[] = data?.timeseries?.result ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: Record<string, Record<string, number | null>> = {};

  results.forEach((item) => {
    // 각 result 아이템에는 quarterly로 시작하는 배열 키가 하나씩 있음
    const typeKey = Object.keys(item).find(
      (k) => k.startsWith("quarterly") && Array.isArray(item[k])
    );
    if (!typeKey) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item[typeKey] as any[]).forEach((entry) => {
      const date: string = entry.asOfDate;
      if (!date) return;
      if (!map[date]) map[date] = {};
      map[date][typeKey] = toNum(entry.reportedValue?.raw ?? entry.reportedValue);
    });
  });

  return map;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/financials/[ticker]">) {
  const { ticker } = await ctx.params;
  const code = getNaverCode(ticker);

  // ── 한국 종목: DART(전자공시시스템) — 다년치 분기 재무제표 제공 ──────────
  if (code && dartAvailable()) {
    try {
      const result = await dartFinancials(code);
      if (result && (result.income.length > 0 || result.balance.length > 0)) {
        return Response.json({
          incomeStatements: result.income,
          balanceSheets: result.balance,
          quarterly: true,
        });
      }
    } catch (e) {
      console.error("[financials] DART 실패, Yahoo로 전환:", e);
    }
  }

  const yahooTicker = code ? `${code}.KS` : ticker;

  // 손익 + 재무상태 병렬 요청
  const [incRes, balRes] = await Promise.allSettled([
    fetchTimeSeries(yahooTicker, INCOME_TYPES),
    fetchTimeSeries(yahooTicker, BALANCE_TYPES),
  ]);

  const incMap = incRes.status === "fulfilled" ? parseTimeSeries(incRes.value) : {};
  const balMap = balRes.status === "fulfilled" ? parseTimeSeries(balRes.value) : {};

  // 공통 날짜 집합 생성 후 정렬
  const allDates = Array.from(
    new Set([...Object.keys(incMap), ...Object.keys(balMap)])
  )
    .filter((d) => d >= "2019-01-01")
    .sort((a, b) => b.localeCompare(a)); // 최신 순

  const incomeStatements = allDates
    .filter((d) => incMap[d])
    .map((d) => ({
      date: d,
      revenue: incMap[d]?.quarterlyTotalRevenue ?? null,
      operatingIncome: incMap[d]?.quarterlyOperatingIncome ?? null,
      netIncome: incMap[d]?.quarterlyNetIncome ?? null,
    }));

  const balanceSheets = allDates
    .filter((d) => balMap[d])
    .map((d) => ({
      date: d,
      totalAssets: balMap[d]?.quarterlyTotalAssets ?? null,
      totalEquity: balMap[d]?.quarterlyStockholdersEquity ?? null,
      totalDebt: balMap[d]?.quarterlyTotalLiabilitiesNetMinorityInterest ?? null,
    }));

  if (incomeStatements.length === 0 && balanceSheets.length === 0) {
    console.error("[financials] 데이터 없음:", yahooTicker);
  }

  return Response.json({ incomeStatements, balanceSheets, quarterly: true });
}
