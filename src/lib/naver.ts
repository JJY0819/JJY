export function getNaverCode(ticker: string): string | null {
  const m = ticker.match(/^(\d{6})(\.(KS|KQ))?$/);
  return m ? m[1] : null;
}

export function isKoreanStock(ticker: string): boolean {
  return getNaverCode(ticker) !== null;
}

const NAV_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://m.stock.naver.com/",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
};

export async function naverFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: NAV_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Naver ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export function toNaverDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export interface FrgnRow {
  date: string; // YYYY-MM-DD
  close: number;
  institute: number; // 기관 순매매량
  foreign: number;   // 외국인 순매매량
}

const FRGN_HEADERS = {
  "User-Agent": NAV_HEADERS["User-Agent"],
  Referer: "https://finance.naver.com/",
};

const FRGN_ROWS_PER_PAGE = 20;

// 네이버금융 "외국인·기관 순매매 거래량" (EUC-KR HTML, 페이지당 20거래일)
// 개인 데이터는 제공하지 않으므로 호출부에서 -(외국인+기관)으로 추정해 사용한다.
export async function naverFrgnTrend(code: string, days: number): Promise<FrgnRow[]> {
  const rows: FrgnRow[] = [];
  const maxPages = Math.ceil(days / FRGN_ROWS_PER_PAGE) + 1;

  for (let page = 1; page <= maxPages && rows.length < days; page++) {
    const res = await fetch(
      `https://finance.naver.com/item/frgn.naver?code=${code}&page=${page}`,
      { headers: FRGN_HEADERS, cache: "no-store" }
    );
    if (!res.ok) break;

    const html = new TextDecoder("euc-kr").decode(await res.arrayBuffer());
    const table = html.match(/외국인 기관 순매매 거래량[\s\S]*?<\/table>/)?.[0];
    if (!table) break;

    const trs = table.match(/<tr onMouseOver[\s\S]*?<\/tr>/g) ?? [];
    if (trs.length === 0) break;

    for (const tr of trs) {
      const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
      const date = tds[0]?.replace(/\./g, "-");
      if (!date) continue;
      rows.push({
        date,
        close: parseInt(tds[1]?.replace(/,/g, "") || "0"),
        institute: parseInt(tds[5]?.replace(/,/g, "") || "0"),
        foreign: parseInt(tds[6]?.replace(/,/g, "") || "0"),
      });
    }

    if (trs.length < FRGN_ROWS_PER_PAGE) break; // 마지막 페이지
  }

  return rows.slice(0, days);
}
