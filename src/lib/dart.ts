// DART(전자공시시스템) Open API — https://opendart.fss.or.kr
// 한국 상장사의 분기별 재무제표(손익계산서/재무상태표)를 다년치 제공한다.

import AdmZip from "adm-zip";

const BASE = "https://opendart.fss.or.kr/api";

export function dartAvailable(): boolean {
  return !!process.env.DART_API_KEY;
}

// ── 종목코드 → corp_code 매핑 (전체 목록을 한 번 받아 메모리에 캐시) ──────────
let corpCodeMap: Map<string, string> | null = null;
let corpCodeLoading: Promise<Map<string, string>> | null = null;

async function loadCorpCodeMap(): Promise<Map<string, string>> {
  if (corpCodeMap) return corpCodeMap;
  if (corpCodeLoading) return corpCodeLoading;

  corpCodeLoading = (async () => {
    const key = process.env.DART_API_KEY!;
    const res = await fetch(`${BASE}/corpCode.xml?crtfc_key=${key}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`DART corpCode HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    const zip = new AdmZip(buf);
    const xml = zip.readAsText("CORPCODE.xml");

    const map = new Map<string, string>();
    for (const block of xml.split("</list>")) {
      const corp = block.match(/<corp_code>(\d+)<\/corp_code>/)?.[1];
      const stock = block.match(/<stock_code>\s*(\d{6})\s*<\/stock_code>/)?.[1];
      if (corp && stock) map.set(stock, corp);
    }
    corpCodeMap = map;
    return map;
  })();

  try {
    return await corpCodeLoading;
  } finally {
    corpCodeLoading = null;
  }
}

export async function dartCorpCode(stockCode: string): Promise<string | null> {
  const map = await loadCorpCodeMap();
  return map.get(stockCode) ?? null;
}

// ── 재무제표 조회 ───────────────────────────────────────────────────
const REPRT = { Q1: "11013", HALF: "11012", Q3: "11014", ANNUAL: "11011" } as const;

interface AcntRow {
  sj_div: string;
  account_id: string;
  thstrm_amount: string;
  thstrm_add_amount: string;
}

async function fetchReport(
  corpCode: string,
  year: number,
  reprtCode: string,
  fsDiv: "CFS" | "OFS"
): Promise<AcntRow[] | null> {
  const key = process.env.DART_API_KEY!;
  const url =
    `${BASE}/fnlttSinglAcntAll.json?crtfc_key=${key}&corp_code=${corpCode}` +
    `&bsns_year=${year}&reprt_code=${reprtCode}&fs_div=${fsDiv}`;
  const res = await fetch(url, { next: { revalidate: 21600 } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== "000") return null;
  return json.list as AcntRow[];
}

function pick(
  rows: AcntRow[] | null,
  accountId: string,
  sjDiv: string,
  field: "thstrm_amount" | "thstrm_add_amount"
): number | null {
  if (!rows) return null;
  const row = rows.find((r) => r.sj_div === sjDiv && r.account_id === accountId);
  if (!row?.[field]) return null;
  const n = parseInt(row[field], 10);
  return isFinite(n) ? n : null;
}

function sub(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : a - b;
}

const ACC = {
  revenue: "ifrs-full_Revenue",
  operatingIncome: "dart_OperatingIncomeLoss",
  netIncome: "ifrs-full_ProfitLoss",
  assets: "ifrs-full_Assets",
  equity: "ifrs-full_Equity",
  liabilities: "ifrs-full_Liabilities",
};

function incomeOf(rows: AcntRow[] | null, field: "thstrm_amount" | "thstrm_add_amount") {
  return {
    revenue: pick(rows, ACC.revenue, "IS", field),
    operatingIncome: pick(rows, ACC.operatingIncome, "IS", field),
    netIncome: pick(rows, ACC.netIncome, "IS", field),
  };
}

function balanceOf(rows: AcntRow[] | null) {
  return {
    totalAssets: pick(rows, ACC.assets, "BS", "thstrm_amount"),
    totalEquity: pick(rows, ACC.equity, "BS", "thstrm_amount"),
    totalDebt: pick(rows, ACC.liabilities, "BS", "thstrm_amount"),
  };
}

export interface DartIncome {
  date: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}

export interface DartBalance {
  date: string;
  totalAssets: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
}

// 분/반기보고서의 thstrm_amount는 "해당 3개월 단독" 값, thstrm_add_amount는 "연초 누적" 값이다.
// 4분기는 별도 보고서가 없어 사업보고서(연간) - 3분기보고서 누적으로 역산한다.
async function fetchYear(corpCode: string, year: number, fsDiv: "CFS" | "OFS") {
  const [q1, half, q3, annual] = await Promise.all([
    fetchReport(corpCode, year, REPRT.Q1, fsDiv),
    fetchReport(corpCode, year, REPRT.HALF, fsDiv),
    fetchReport(corpCode, year, REPRT.Q3, fsDiv),
    fetchReport(corpCode, year, REPRT.ANNUAL, fsDiv),
  ]);
  return { q1, half, q3, annual };
}

export async function dartFinancials(
  stockCode: string,
  yearsBack = 6
): Promise<{ income: DartIncome[]; balance: DartBalance[] } | null> {
  const corpCode = await dartCorpCode(stockCode);
  if (!corpCode) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack }, (_, i) => currentYear - i);

  const perYear = await Promise.all(
    years.map(async (year) => {
      let reports = await fetchYear(corpCode, year, "CFS");
      if (!reports.q1 && !reports.half && !reports.q3 && !reports.annual) {
        reports = await fetchYear(corpCode, year, "OFS"); // 연결재무제표 미제공 시 별도재무제표로 재시도
      }
      return { year, ...reports };
    })
  );

  const income: DartIncome[] = [];
  const balance: DartBalance[] = [];

  for (const { year, q1, half, q3, annual } of perYear) {
    const q1v = incomeOf(q1, "thstrm_amount");
    const q2v = incomeOf(half, "thstrm_amount");
    const q3v = incomeOf(q3, "thstrm_amount");
    const annualV = incomeOf(annual, "thstrm_amount");
    const q3CumV = incomeOf(q3, "thstrm_add_amount");
    const q4v = {
      revenue: sub(annualV.revenue, q3CumV.revenue),
      operatingIncome: sub(annualV.operatingIncome, q3CumV.operatingIncome),
      netIncome: sub(annualV.netIncome, q3CumV.netIncome),
    };

    if (q1v.revenue != null) income.push({ date: `${year}-03-31`, ...q1v });
    if (q2v.revenue != null) income.push({ date: `${year}-06-30`, ...q2v });
    if (q3v.revenue != null) income.push({ date: `${year}-09-30`, ...q3v });
    if (q4v.revenue != null) income.push({ date: `${year}-12-31`, ...q4v });

    const b1 = balanceOf(q1);
    const b2 = balanceOf(half);
    const b3 = balanceOf(q3);
    const b4 = balanceOf(annual);
    if (b1.totalAssets != null) balance.push({ date: `${year}-03-31`, ...b1 });
    if (b2.totalAssets != null) balance.push({ date: `${year}-06-30`, ...b2 });
    if (b3.totalAssets != null) balance.push({ date: `${year}-09-30`, ...b3 });
    if (b4.totalAssets != null) balance.push({ date: `${year}-12-31`, ...b4 });
  }

  income.sort((a, b) => b.date.localeCompare(a.date));
  balance.sort((a, b) => b.date.localeCompare(a.date));
  return { income, balance };
}
