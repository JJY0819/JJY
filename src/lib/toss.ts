// 토스증권 Open API (https://developers.tossinvest.com/docs)
// OAuth2 Client Credentials Grant → Bearer 토큰으로 시세 조회

const BASE = "https://openapi.tossinvest.com";

export function tossAvailable(): boolean {
  return !!process.env.TOSS_API_KEY && !!process.env.TOSS_SECRET_KEY;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let pendingToken: Promise<string> | null = null;

// client 당 유효 토큰은 1개뿐이라(재발급 시 이전 토큰 즉시 무효화) 동시 호출이
// 토큰을 중복 발급하지 않도록 진행 중인 발급 요청을 공유한다
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (pendingToken) return pendingToken;

  pendingToken = (async () => {
    const res = await fetch(`${BASE}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.TOSS_API_KEY!,
        client_secret: process.env.TOSS_SECRET_KEY!,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`토스증권 토큰 발급 실패 ${res.status}`);

    const data = await res.json();
    cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cachedToken.value;
  })();

  try {
    return await pendingToken;
  } finally {
    pendingToken = null;
  }
}

async function tossGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`토스증권 API ${res.status}: ${path}`);
  const data = await res.json();
  return data.result as T;
}

interface PriceItem {
  symbol: string;
  timestamp: string | null;
  lastPrice: string;
  currency: "KRW" | "USD";
}

interface StockItem {
  symbol: string;
  name: string;
  market: string;
  sharesOutstanding: string;
}

interface Candle {
  closePrice: string;
  volume: string;
}

export interface TossQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  sharesOutstanding: number | null;
  volume: number | null;
  currency: string;
  market: string;
  timestamp: string | null;
}

// 현재가(prices) + 종목정보(stocks) + 전일종가(candles)를 합쳐 등락률까지 계산한다
export async function tossQuote(symbol: string): Promise<TossQuote | null> {
  const [prices, stocks, candles] = await Promise.all([
    tossGet<PriceItem[]>("/api/v1/prices", { symbols: symbol }),
    tossGet<StockItem[]>("/api/v1/stocks", { symbols: symbol }),
    tossGet<{ candles: Candle[] }>("/api/v1/candles", { symbol, interval: "1d", count: "2" }),
  ]);

  const p = prices[0];
  const s = stocks[0];
  if (!p || !s) return null;

  const price = parseFloat(p.lastPrice);
  const candleList = candles?.candles ?? [];
  const prevClose = candleList.length > 1 ? parseFloat(candleList[1].closePrice) : null;
  const change = prevClose != null ? price - prevClose : 0;
  const changePercent = prevClose ? (change / prevClose) * 100 : 0;
  const shares = parseFloat(s.sharesOutstanding) || null;

  return {
    symbol: p.symbol,
    name: s.name,
    price,
    change,
    changePercent,
    marketCap: shares ? price * shares : null,
    sharesOutstanding: shares,
    volume: candleList.length > 0 ? parseFloat(candleList[0].volume) : null,
    currency: p.currency,
    market: s.market,
    timestamp: p.timestamp,
  };
}
