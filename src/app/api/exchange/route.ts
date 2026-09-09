import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

const PAIRS = [
  { symbol: "USDKRW=X", label: "달러/원", unit: 1, decimals: 0 },
  { symbol: "EURKRW=X", label: "유로/원", unit: 1, decimals: 0 },
  { symbol: "JPYKRW=X", label: "100엔/원", unit: 100, decimals: 2 },
  { symbol: "CNYKRW=X", label: "위안/원", unit: 1, decimals: 2 },
  { symbol: "GBPKRW=X", label: "파운드/원", unit: 1, decimals: 0 },
  { symbol: "NQ=F", label: "나스닥선물", unit: 1, decimals: 2 },
  { symbol: "^SOX", label: "필라델피아반도체", unit: 1, decimals: 2 },
  { symbol: "^VIX", label: "VIX", unit: 1, decimals: 2 },
  { symbol: "^TNX", label: "미10년물", unit: 1, decimals: 3 },
  { symbol: "DX-Y.NYB", label: "달러인덱스", unit: 1, decimals: 2 },
  { symbol: "JPY=X", label: "엔/달러", unit: 1, decimals: 2, prefix: "¥" },
];

interface RateItem {
  label: string;
  rate: number;
  changePercent: number;
  decimals: number;
  prefix?: string;
}

export async function GET() {
  const results = await Promise.allSettled(
    PAIRS.map(async ({ symbol, label, unit, decimals, prefix }): Promise<RateItem> => {
      const q = await yf.quote(symbol);
      return {
        label,
        rate: (q.regularMarketPrice ?? 0) * unit,
        changePercent: q.regularMarketChangePercent ?? 0,
        decimals,
        prefix,
      };
    })
  );

  const data = results
    .filter((r): r is PromiseFulfilledResult<RateItem> => r.status === "fulfilled")
    .map((r) => r.value);

  return NextResponse.json({ data });
}
