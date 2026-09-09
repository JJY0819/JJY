import YahooFinance from "yahoo-finance2";
import { NextRequest } from "next/server";
import { getNaverCode } from "@/lib/naver";
import { datagoAvailable, datagoChart, getPeriodStart, todayStr } from "@/lib/datago";

const yf = new YahooFinance();

const YAHOO_DAYS: Record<string, number> = {
  "1W": 10, "1M": 35, "3M": 95, "6M": 190, "1Y": 380, "2Y": 760, "5Y": 1900,
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/history/[ticker]">
) {
  const { ticker } = await ctx.params;
  const period = request.nextUrl.searchParams.get("period") ?? "1Y";
  const code = getNaverCode(ticker);
  const yahooTicker = code ? `${code}.KS` : ticker;

  // ── 1일(인트라데이): 최근 거래일 5분봉 ─────────────────────────
  if (period === "1D") {
    try {
      const period1 = new Date();
      period1.setDate(period1.getDate() - 5); // 연휴/주말 대비 여유
      const result = await yf.chart(yahooTicker, { period1, interval: "5m" });
      const quotes = (result.quotes ?? []).filter((d) => d.open != null && d.close != null);
      if (quotes.length === 0) return Response.json({ data: [] });

      // 가장 최근 거래일의 봉만 추려낸다 (주말/휴장 포함 조회했으므로)
      const lastDateKey = quotes[quotes.length - 1].date.toISOString().slice(0, 10);
      const todays = quotes.filter((d) => d.date.toISOString().slice(0, 10) === lastDateKey);

      const data = todays.map((d) => ({
        time: Math.floor(d.date.getTime() / 1000),
        open: d.open!,
        high: d.high!,
        low: d.low!,
        close: d.close!,
        volume: d.volume ?? 0,
      }));
      return Response.json({ data });
    } catch (e) {
      console.error("[history] 1일봉 조회 실패:", e);
      return Response.json({ data: [] });
    }
  }

  // ── 한국 주식: 금융위원회 주식시세정보 API ────────────────────────
  if (code && datagoAvailable()) {
    try {
      const data = await datagoChart(code, getPeriodStart(period), todayStr());
      if (data.length > 0) return Response.json({ data });
    } catch (e) {
      console.error("[history] data.go.kr 실패, Yahoo로 전환:", e);
    }
  }

  // ── 미국 주식 (또는 fallback): Yahoo Finance chart() ─────────
  try {
    const days = YAHOO_DAYS[period] ?? 380;
    const period1 = new Date();
    period1.setDate(period1.getDate() - days);

    const result = await yf.chart(ticker, { period1, interval: "1d" });
    const data = (result.quotes ?? [])
      .filter((d) => d.open != null && d.close != null)
      .map((d) => ({
        time: Math.floor(d.date.getTime() / 1000),
        open: d.open!,
        high: d.high!,
        low: d.low!,
        close: d.close!,
        volume: d.volume ?? 0,
      }));
    return Response.json({ data });
  } catch {
    return Response.json({ data: [] }, { status: 500 });
  }
}
