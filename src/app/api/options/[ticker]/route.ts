import YahooFinance from "yahoo-finance2";
import { getNaverCode } from "@/lib/naver";

const yf = new YahooFinance();

interface Contract {
  strike: number;
  openInterest?: number | null;
}

// Max Pain: 만기일에 옵션 매도자(발행자)의 총 지급액이 최소가 되는 행사가.
// 후보 가격(=존재하는 모든 행사가)마다, 그 가격에서 콜/풋 매수자에게 지급해야 할
// 내재가치 총합(OI 가중)을 계산해서 가장 작은 지점을 찾는다.
function computeMaxPain(calls: Contract[], puts: Contract[]): number | null {
  const strikes = Array.from(new Set([...calls.map((c) => c.strike), ...puts.map((p) => p.strike)])).sort((a, b) => a - b);
  if (strikes.length === 0) return null;

  let bestStrike = strikes[0];
  let minLoss = Infinity;

  for (const s of strikes) {
    let loss = 0;
    for (const c of calls) if (c.strike < s) loss += (s - c.strike) * (c.openInterest ?? 0);
    for (const p of puts) if (p.strike > s) loss += (p.strike - s) * (p.openInterest ?? 0);
    if (loss < minLoss) {
      minLoss = loss;
      bestStrike = s;
    }
  }

  return bestStrike;
}

// 오래돼서 정리되지 않은 딥ITM/딥OTM 잔존 계약(현재가와 동떨어진 행사가에
// 비정상적으로 큰 미결제약정이 남아있는 경우)이 Max Pain 계산을 왜곡시키는 걸
// 막기 위해, 현재가의 ±50% 범위 밖 행사가는 아예 계산에서 제외한다.
function filterNearPrice<T extends Contract>(contracts: T[], price: number): T[] {
  if (price <= 0) return contracts;
  const low = price * 0.5;
  const high = price * 1.5;
  return contracts.filter((c) => c.strike >= low && c.strike <= high);
}

function topByOI(contracts: Contract[], n: number) {
  return [...contracts]
    .filter((c) => (c.openInterest ?? 0) > 0)
    .sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
    .slice(0, n)
    .map((c) => ({ strike: c.strike, oi: c.openInterest ?? 0 }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/options/[ticker]">) {
  const { ticker } = await ctx.params;

  // 국내 종목은 Yahoo에 옵션 체인이 없다.
  if (getNaverCode(ticker)) {
    return Response.json({ available: false });
  }

  const symbol = ticker.toUpperCase();

  try {
    const base = await yf.options(symbol);
    const price = base.quote?.regularMarketPrice ?? 0;
    const candidateDates = (base.expirationDates ?? []).slice(0, 10);

    const fetched = await Promise.all(
      candidateDates.map(async (date) => {
        try {
          const r = await yf.options(symbol, { date });
          const calls = filterNearPrice(r.options[0]?.calls ?? [], price);
          const puts = filterNearPrice(r.options[0]?.puts ?? [], price);
          const callOI = calls.reduce((s, c) => s + (c.openInterest ?? 0), 0);
          const putOI = puts.reduce((s, p) => s + (p.openInterest ?? 0), 0);
          return { date, calls, puts, callOI, putOI };
        } catch {
          return null;
        }
      })
    );

    // 상장 직후 등 미결제약정이 통째로 안 잡힌 만기(0에 가까움)는 Max Pain 계산이
    // 무의미해서 건너뛰고, 데이터가 어느 정도 쌓인 가장 가까운 만기 2개만 쓴다.
    const usable = fetched.filter((r): r is NonNullable<typeof r> => r != null && r.callOI + r.putOI >= 20).slice(0, 2);

    if (usable.length === 0) {
      return Response.json({ available: false });
    }

    const expiries = usable.map(({ date, calls, puts, callOI, putOI }) => {
      const maxPain = computeMaxPain(calls, puts);
      const upsidePercent = maxPain != null && price > 0 ? ((maxPain - price) / price) * 100 : null;
      // 콜·풋 어느 한쪽이라도 미결제약정이 0이면 비율 자체가 왜곡되므로 계산하지 않는다.
      const pcr = callOI > 0 && putOI > 0 ? putOI / callOI : null;
      const sentiment: "bullish" | "bearish" | "neutral" | "unknown" =
        pcr == null ? "unknown" : pcr < 0.7 ? "bullish" : pcr > 1.3 ? "bearish" : "neutral";

      return {
        expiration: date.toISOString(),
        maxPain,
        upsidePercent,
        pcr,
        sentiment,
        callOI,
        putOI,
        topCalls: topByOI(calls, 3),
        topPuts: topByOI(puts, 3),
      };
    });

    return Response.json({ available: true, price, expiries });
  } catch {
    return Response.json({ available: false });
  }
}
