import YahooFinance from "yahoo-finance2";
import { getNaverCode } from "@/lib/naver";

const yf = new YahooFinance();

export async function GET(_req: Request, ctx: RouteContext<"/api/analyst/[ticker]">) {
  const { ticker } = await ctx.params;
  const code = getNaverCode(ticker);
  const yahooTicker = code ? `${code}.KS` : ticker.toUpperCase();

  try {
    // 일부 종목은 upgradeDowngradeHistory 항목이 yahoo-finance2 스키마와 안 맞아
    // 검증(validateResult) 단계에서 통째로 실패하는 경우가 있어 검증을 끄고 받는다.
    const summary = (await yf.quoteSummary(
      yahooTicker,
      { modules: ["financialData", "recommendationTrend", "calendarEvents", "upgradeDowngradeHistory"] },
      { validateResult: false }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;

    const fd = summary?.financialData ?? {};
    const trend = summary?.recommendationTrend?.trend?.[0]; // "0m" = 이번 달 집계
    const earningsDate = summary?.calendarEvents?.earnings?.earningsDate?.[0] ?? null;
    const history = summary?.upgradeDowngradeHistory?.history ?? [];
    const latestAction = history[0] ?? null;

    const numberOfAnalysts = fd?.numberOfAnalystOpinions ?? null;
    const buy = (trend?.strongBuy ?? 0) + (trend?.buy ?? 0);
    const hold = trend?.hold ?? 0;
    const sell = (trend?.sell ?? 0) + (trend?.strongSell ?? 0);

    if (numberOfAnalysts == null && buy + hold + sell === 0) {
      return Response.json({ available: false });
    }

    return Response.json({
      available: true,
      numberOfAnalysts,
      buy,
      hold,
      sell,
      earningsDate: earningsDate ? new Date(earningsDate).toISOString() : null,
      latestRatingDate: latestAction?.epochGradeDate ? new Date(latestAction.epochGradeDate).toISOString() : null,
    });
  } catch {
    return Response.json({ available: false });
  }
}
