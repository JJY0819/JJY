// 금융위원회 주식시세정보 (공공데이터포털)
// https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService

const BASE =
  "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService";

export function datagoAvailable(): boolean {
  return !!process.env.DATA_GO_KR_KEY;
}

type DatagoItem = Record<string, string>;

async function datagoGet(
  endpoint: string,
  params: Record<string, string>
): Promise<DatagoItem[]> {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY 미설정");

  // serviceKey는 data.go.kr 제공 인코딩 키를 그대로 사용 (이중 인코딩 방지)
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

  const url = `${BASE}/${endpoint}?serviceKey=${key}&resultType=json&${qs}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`data.go.kr HTTP ${res.status}`);

  const data = await res.json();
  const rc = data?.response?.header?.resultCode;
  if (rc && rc !== "00") {
    throw new Error(`data.go.kr 오류 ${rc}: ${data?.response?.header?.resultMsg}`);
  }

  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function toYYYYMMDD(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// ── 최근 거래일 시세 (T+1, 최대 5일 전까지 시도) ──────────────────
export async function datagoQuote(code: string): Promise<DatagoItem | null> {
  for (let i = 0; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    try {
      const items = await datagoGet("getStockPriceInfo", {
        numOfRows: "1",
        pageNo: "1",
        basDt: toYYYYMMDD(d),
        likeSrtnCd: code,
      });
      if (items.length > 0) return items[0];
    } catch {
      // 해당 일자 데이터 없음, 다음 날로 재시도
    }
  }
  return null;
}

// ── OHLCV 차트 데이터 (페이지네이션 포함) ────────────────────────
export interface DatagoOHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseItem(item: DatagoItem): DatagoOHLCV {
  const d = item.basDt ?? "";
  return {
    time: Math.floor(
      new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).getTime() / 1000
    ),
    open: parseInt(item.mkp ?? item.clpr ?? "0"),
    high: parseInt(item.hipr ?? item.clpr ?? "0"),
    low: parseInt(item.lopr ?? item.clpr ?? "0"),
    close: parseInt(item.clpr ?? "0"),
    volume: parseInt(item.trqu ?? "0"),
  };
}

export async function datagoChart(
  code: string,
  startDate: string,
  endDate: string
): Promise<DatagoOHLCV[]> {
  const all: DatagoOHLCV[] = [];
  let page = 1;

  for (;;) {
    const items = await datagoGet("getStockPriceInfo", {
      numOfRows: "1000",
      pageNo: String(page),
      beginBasDt: startDate,
      endBasDt: endDate,
      likeSrtnCd: code,
    });

    if (items.length === 0) break;
    all.push(...items.map(parseItem));
    if (items.length < 1000) break;
    if (page >= 3) break; // 최대 3,000개 (5Y 일봉 ≈ 1,250개)
    page++;
  }

  return all.sort((a, b) => a.time - b.time);
}

// ── 시가총액 상위 N종목 (당일 전체 종목 덤프에서 정렬) ────────────────
export interface DatagoTopStock {
  code: string;
  name: string;
  market: string;
  marketCap: number;
}

export async function datagoTopByMarketCap(n: number): Promise<DatagoTopStock[]> {
  for (let i = 0; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    try {
      const items = await datagoGet("getStockPriceInfo", {
        numOfRows: "3000",
        pageNo: "1",
        basDt: toYYYYMMDD(d),
      });
      if (items.length === 0) continue;
      return items
        .map((it) => ({
          code: it.srtnCd ?? "",
          name: it.itmsNm ?? "",
          market: it.mrktCtg ?? "",
          marketCap: parseFloat(it.mrktTotAmt ?? "0") || 0,
        }))
        .filter((s) => s.code && s.marketCap > 0)
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, n);
    } catch {
      // 해당 일자 데이터 없음, 다음 날로 재시도
    }
  }
  return [];
}

// 기간 → 시작일 계산
export function getPeriodStart(period: string): string {
  const days: Record<string, number> = {
    "1W": 10, "1M": 35, "3M": 95, "6M": 190, "1Y": 380, "2Y": 760, "5Y": 1900,
  };
  const d = new Date();
  d.setDate(d.getDate() - (days[period] ?? 380));
  return toYYYYMMDD(d);
}

export function todayStr(): string {
  return toYYYYMMDD(new Date());
}
