import YahooFinance from "yahoo-finance2";
import { getNaverCode } from "@/lib/naver";

const yf = new YahooFinance();

export async function GET(_req: Request, ctx: RouteContext<"/api/snapshot/[ticker]">) {
  const { ticker } = await ctx.params;
  const code = getNaverCode(ticker);
  const yahooTicker = code ? `${code}.KS` : ticker.toUpperCase();

  try {
    const [q, summary] = await Promise.all([
      yf.quote(yahooTicker),
      yf.quoteSummary(
        yahooTicker,
        { modules: ["defaultKeyStatistics", "summaryDetail", "financialData", "assetProfile"] },
        { validateResult: false }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as Promise<any>,
    ]);

    const ks = summary?.defaultKeyStatistics ?? {};
    const sd = summary?.summaryDetail ?? {};
    const fd = summary?.financialData ?? {};
    const ap = summary?.assetProfile ?? {};

    // Yahoo가 trailingEps/trailingPE를 안 주는 종목은 순이익·발행주식수로 직접 계산한다.
    // 적자(EPS<=0) 종목은 PER을 표기하지 않는 관례를 따른다.
    const eps: number | null =
      ks.trailingEps ?? (ks.netIncomeToCommon != null && ks.sharesOutstanding ? ks.netIncomeToCommon / ks.sharesOutstanding : null);
    const per: number | null = sd.trailingPE ?? (eps != null && eps > 0 && q.regularMarketPrice ? q.regularMarketPrice / eps : null);

    const dividendYield: number =
      (sd.dividendYield ?? sd.trailingAnnualDividendYield ?? 0) * 100;

    return Response.json({
      available: true,
      currency: q.currency ?? "USD",
      // 밸류에이션
      per,
      forwardPer: ks.forwardPE ?? null,
      pbr: ks.priceToBook ?? null,
      psr: ks.priceToSalesTrailing12Months ?? sd.priceToSalesTrailing12Months ?? null,
      evEbitda: ks.enterpriseToEbitda ?? null,
      // 수익성
      roe: fd.returnOnEquity != null ? fd.returnOnEquity * 100 : null,
      roa: fd.returnOnAssets != null ? fd.returnOnAssets * 100 : null,
      netMargin: fd.profitMargins != null ? fd.profitMargins * 100 : null,
      operatingMargin: fd.operatingMargins != null ? fd.operatingMargins * 100 : null,
      // 성장 & 안정성
      revenueGrowth: fd.revenueGrowth != null ? fd.revenueGrowth * 100 : null,
      earningsGrowth: fd.earningsGrowth != null ? fd.earningsGrowth * 100 : null,
      debtToEquity: fd.debtToEquity ?? null,
      currentRatio: fd.currentRatio ?? null,
      beta: ks.beta ?? sd.beta ?? null,
      // 배당
      dividendYield,
      payoutRatio: sd.payoutRatio != null ? sd.payoutRatio * 100 : null,
      // 원시 재무
      eps,
      bps: ks.bookValue ?? null,
      operatingCashflow: fd.operatingCashflow ?? null,
      freeCashflow: fd.freeCashflow ?? null,
      totalDebt: fd.totalDebt ?? null,
      totalCash: fd.totalCash ?? null,
      ebitda: fd.ebitda ?? null,
      // 거래 정보
      previousClose: sd.previousClose ?? q.regularMarketPreviousClose ?? null,
      volume: q.regularMarketVolume ?? sd.regularMarketVolume ?? null,
      averageVolume: sd.averageVolume ?? null,
      marketCap: q.marketCap ?? sd.marketCap ?? null,
      employees: ap.fullTimeEmployees ?? null,
      asOf: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[snapshot] 조회 실패:", e);
    return Response.json({ available: false });
  }
}
