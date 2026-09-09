import YahooFinance from "yahoo-finance2";
import { getNaverCode } from "@/lib/naver";

const yf = new YahooFinance();

export async function GET(req: Request, ctx: RouteContext<"/api/snapshot/[ticker]">) {
  const { ticker } = await ctx.params;
  const code = getNaverCode(ticker);
  const yahooTicker = code ? `${code}.KS` : ticker.toUpperCase();

  // 헤더·사이드바에 이미 표시된 가격과 다른 값으로 PER 등이 계산되지 않도록,
  // 페이지가 이미 확보한 canonical 가격이 있으면 그걸 우선 쓴다.
  const priceParam = new URL(req.url).searchParams.get("price");
  const canonicalPrice = priceParam ? parseFloat(priceParam) : null;

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

    const price = canonicalPrice && canonicalPrice > 0 ? canonicalPrice : q.regularMarketPrice;

    // Yahoo가 trailingEps를 안 주는 종목은 순이익·발행주식수로 직접 계산한다.
    // 적자(EPS<=0) 종목은 PER을 표기하지 않는 관례를 따른다.
    // PER·포워드PER·PBR은 Yahoo가 이미 계산해둔 비율(자기네 가격 스냅샷 기준) 대신
    // "canonical 가격 ÷ 가격과 무관한 원 데이터(EPS 등)"로 다시 계산해, 화면에 실제
    // 보이는 가격과 항상 정확히 들어맞게 한다. 원 데이터가 없으면 Yahoo 비율로 대체한다.
    const eps: number | null =
      ks.trailingEps ?? (ks.netIncomeToCommon != null && ks.sharesOutstanding ? ks.netIncomeToCommon / ks.sharesOutstanding : null);
    const per: number | null = eps != null && eps > 0 && price ? price / eps : sd.trailingPE ?? null;

    const forwardEps: number | null = ks.forwardEps ?? null;
    const forwardPer: number | null = forwardEps != null && forwardEps > 0 && price ? price / forwardEps : ks.forwardPE ?? null;

    const bookValue: number | null = ks.bookValue ?? null;
    const pbr: number | null = bookValue != null && bookValue > 0 && price ? price / bookValue : ks.priceToBook ?? null;

    const dividendYield: number =
      (sd.dividendYield ?? sd.trailingAnnualDividendYield ?? 0) * 100;

    return Response.json({
      available: true,
      currency: q.currency ?? "USD",
      // 밸류에이션
      per,
      forwardPer,
      pbr,
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
