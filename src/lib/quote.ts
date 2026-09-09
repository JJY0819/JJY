import YahooFinance from "yahoo-finance2";
import { getNaverCode } from "@/lib/naver";
import { datagoAvailable, datagoQuote } from "@/lib/datago";
import { tossAvailable, tossQuote } from "@/lib/toss";

const yf = new YahooFinance();

export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose?: number | null;
  marketCap: number | null;
  sharesOutstanding: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  currency: string;
  exchange: string;
  marketState: string;
  regularMarketTime?: string | null;
  preMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketPrice?: number | null;
  postMarketChangePercent?: number | null;
  per?: number | null;
  forwardPer?: number | null;
  pbr?: number | null;
  eps?: number | null;
  dividendYield?: number | null;
  targetMeanPrice?: number | null;
  roe?: number | null;
  netMargin?: number | null;
  operatingMargin?: number | null;
  revenueGrowth?: number | null;
  baseDate?: string | null;
}

interface YahooFundamentals {
  week52High: number | null;
  week52Low: number | null;
  per: number | null;
  forwardPer: number | null;
  pbr: number | null;
  eps: number | null;
  dividendYield: number | null;
  targetMeanPrice: number | null;
  preMarketPrice: number | null;
  preMarketChangePercent: number | null;
  postMarketPrice: number | null;
  postMarketChangePercent: number | null;
  regularMarketTime: number | null;
  roe: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
}

// 토스/공공데이터 API는 시세만 제공하고 PER·목표주가 등 펀더멘털 지표가 없어
// Yahoo Finance에서 보강한다. 실패해도 시세 자체는 이미 확보했으므로 null로 채운다.
async function getYahooFundamentals(yahooTicker: string): Promise<YahooFundamentals | null> {
  try {
    const [q, summary] = await Promise.all([
      yf.quote(yahooTicker),
      yf
        .quoteSummary(yahooTicker, { modules: ["defaultKeyStatistics", "summaryDetail", "financialData"] })
        .catch(() => null),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ks = (summary as any)?.defaultKeyStatistics ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sd = (summary as any)?.summaryDetail ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = (summary as any)?.financialData ?? {};

    // 일부 종목(특히 국내 상장사)은 Yahoo가 trailingEps/trailingPE를 아예 안 주는 경우가 있어
    // 순이익(netIncomeToCommon)·발행주식수로 직접 계산해 채운다.
    // 단, 적자(EPS<=0) 종목은 PER 자체를 표기하지 않는 관례를 따른다 (음수 PER은 의미가 없음).
    const eps =
      ks.trailingEps ?? (ks.netIncomeToCommon != null && ks.sharesOutstanding ? ks.netIncomeToCommon / ks.sharesOutstanding : null);
    const per = sd.trailingPE ?? (eps != null && eps > 0 && q.regularMarketPrice ? q.regularMarketPrice / eps : null);

    return {
      week52High: q.fiftyTwoWeekHigh ?? null,
      week52Low: q.fiftyTwoWeekLow ?? null,
      per: per ?? null,
      forwardPer: ks.forwardPE ?? null,
      pbr: ks.priceToBook ?? null,
      eps: eps ?? null,
      dividendYield: sd.dividendYield != null ? sd.dividendYield * 100 : null,
      targetMeanPrice: fd.targetMeanPrice ?? null,
      preMarketPrice: q.preMarketPrice ?? null,
      preMarketChangePercent: q.preMarketChangePercent ?? null,
      postMarketPrice: q.postMarketPrice ?? null,
      postMarketChangePercent: q.postMarketChangePercent ?? null,
      regularMarketTime: q.regularMarketTime ?? null,
      roe: fd.returnOnEquity != null ? fd.returnOnEquity * 100 : null,
      netMargin: fd.profitMargins != null ? fd.profitMargins * 100 : null,
      operatingMargin: fd.operatingMargins != null ? fd.operatingMargins * 100 : null,
      revenueGrowth: fd.revenueGrowth != null ? fd.revenueGrowth * 100 : null,
    };
  } catch {
    return null;
  }
}

// 종목 시세 + 펀더멘털을 한 번에 가져온다. API 라우트와 서버 컴포넌트 양쪽에서
// 이 함수를 직접 호출한다 (서버 컴포넌트가 자기 자신의 API를 HTTP로 다시 호출하면
// 배포 환경에서 내부 주소 문제로 실패할 수 있어, 함수 호출로 통일).
export async function getQuoteData(ticker: string): Promise<QuoteData | null> {
  const code = getNaverCode(ticker);
  const yahooTicker = code ? `${code}.KS` : ticker.toUpperCase();

  // ── 실시간 현재가: 토스증권 Open API (한국·미국 공통) ──────────────
  if (tossAvailable()) {
    try {
      const q = await tossQuote(code ?? ticker.toUpperCase());
      if (q) {
        const extra = await getYahooFundamentals(yahooTicker);
        return {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          marketCap: q.marketCap,
          sharesOutstanding: q.sharesOutstanding,
          week52High: extra?.week52High ?? null,
          week52Low: extra?.week52Low ?? null,
          volume: q.volume,
          currency: q.currency,
          exchange: q.market,
          marketState: "REGULAR",
          baseDate: null,
          per: extra?.per ?? null,
          forwardPer: extra?.forwardPer ?? null,
          pbr: extra?.pbr ?? null,
          eps: extra?.eps ?? null,
          dividendYield: extra?.dividendYield ?? null,
          targetMeanPrice: extra?.targetMeanPrice ?? null,
          preMarketPrice: extra?.preMarketPrice ?? null,
          preMarketChangePercent: extra?.preMarketChangePercent ?? null,
          postMarketPrice: extra?.postMarketPrice ?? null,
          postMarketChangePercent: extra?.postMarketChangePercent ?? null,
          regularMarketTime: extra?.regularMarketTime != null ? new Date(extra.regularMarketTime).toISOString() : null,
          roe: extra?.roe ?? null,
          netMargin: extra?.netMargin ?? null,
          operatingMargin: extra?.operatingMargin ?? null,
          revenueGrowth: extra?.revenueGrowth ?? null,
        };
      }
    } catch (e) {
      console.error("[quote] 토스증권 실패, 다음 소스로 전환:", e);
    }
  }

  // ── 한국 주식: 금융위원회 주식시세정보 API (T+1) ─────────────────
  if (code && datagoAvailable()) {
    try {
      const item = await datagoQuote(code);
      if (item) {
        const extra = await getYahooFundamentals(yahooTicker);
        return {
          symbol: ticker.toUpperCase(),
          name: item.itmsNm ?? ticker,
          price: parseInt(item.clpr ?? "0"),
          change: parseInt(item.vs ?? "0"),
          changePercent: parseFloat(item.fltRt ?? "0"),
          marketCap: parseFloat(item.mrktTotAmt ?? "0") || null,
          sharesOutstanding: parseFloat(item.lstgStCnt ?? "0") || null,
          week52High: extra?.week52High ?? null,
          week52Low: extra?.week52Low ?? null,
          volume: parseInt(item.trqu ?? "0"),
          currency: "KRW",
          exchange: item.mrktCtg ?? (ticker.includes(".KQ") ? "KOSDAQ" : "KOSPI"),
          marketState: "REGULAR",
          baseDate: item.basDt ?? null, // 기준일자 표시용
          per: extra?.per ?? null,
          forwardPer: extra?.forwardPer ?? null,
          pbr: extra?.pbr ?? null,
          eps: extra?.eps ?? null,
          dividendYield: extra?.dividendYield ?? null,
          targetMeanPrice: extra?.targetMeanPrice ?? null,
          regularMarketTime: extra?.regularMarketTime != null ? new Date(extra.regularMarketTime).toISOString() : null,
          roe: extra?.roe ?? null,
          netMargin: extra?.netMargin ?? null,
          operatingMargin: extra?.operatingMargin ?? null,
          revenueGrowth: extra?.revenueGrowth ?? null,
        };
      }
    } catch (e) {
      console.error("[quote] data.go.kr 실패, Yahoo로 전환:", e);
    }
  }

  // ── 미국 주식 (또는 fallback): Yahoo Finance ──────────────────
  try {
    const [q, extra] = await Promise.all([yf.quote(ticker), getYahooFundamentals(ticker)]);

    return {
      symbol: q.symbol,
      name: q.longName || q.shortName || ticker,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      previousClose: q.regularMarketPreviousClose ?? null,
      marketCap: q.marketCap ?? null,
      sharesOutstanding: q.sharesOutstanding ?? null,
      week52High: q.fiftyTwoWeekHigh ?? null,
      week52Low: q.fiftyTwoWeekLow ?? null,
      volume: q.regularMarketVolume ?? null,
      currency: q.currency ?? "USD",
      exchange: q.fullExchangeName ?? "",
      marketState: q.marketState ?? "REGULAR",
      regularMarketTime: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : null,
      preMarketPrice: extra?.preMarketPrice ?? null,
      preMarketChangePercent: extra?.preMarketChangePercent ?? null,
      postMarketPrice: extra?.postMarketPrice ?? null,
      postMarketChangePercent: extra?.postMarketChangePercent ?? null,
      per: extra?.per ?? null,
      forwardPer: extra?.forwardPer ?? null,
      pbr: extra?.pbr ?? null,
      eps: extra?.eps ?? null,
      dividendYield: extra?.dividendYield ?? null,
      targetMeanPrice: extra?.targetMeanPrice ?? null,
      roe: extra?.roe ?? null,
      netMargin: extra?.netMargin ?? null,
      operatingMargin: extra?.operatingMargin ?? null,
      revenueGrowth: extra?.revenueGrowth ?? null,
    };
  } catch {
    return null;
  }
}
