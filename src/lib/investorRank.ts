// 투자자별(외국인/기관) 순매수 상위 종목 랭킹
// Naver에는 전체 종목 랭킹 페이지가 없어(빈 표), 시가총액 상위 종목군을 만든 뒤
// 종목별 페이지(naverFrgnTrend)를 모아서 직접 집계한다.

import { datagoAvailable, datagoTopByMarketCap } from "./datago";
import { naverFrgnTrend } from "./naver";

export interface RankedStock {
  code: string;
  name: string;
  market: string;
  netBuy: number;
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const UNIVERSE_SIZE = 100; // 집계 대상: 시가총액 상위 100종목
const TOP_N = 50;
const CACHE_MS = 15 * 60 * 1000;
const MAX_RANGE_DAYS = 60; // 종목당 호출 비용 보호용 상한

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// 요청 범위를 [과거 제한, 오늘] 안으로 정리한다
export function clampRange(range?: DateRange): DateRange {
  const today = todayStr();
  let end = range?.end && range.end <= today ? range.end : today;
  let start = range?.start ?? end;
  if (start > end) [start, end] = [end, start];

  const minStart = new Date(end);
  minStart.setDate(minStart.getDate() - (MAX_RANGE_DAYS - 1));
  const minStartStr = minStart.toISOString().slice(0, 10);
  if (start < minStartStr) start = minStartStr;

  return { start, end };
}

interface CacheEntry {
  data: { foreign: RankedStock[]; institute: RankedStock[] };
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

export function investorRankAvailable(): boolean {
  return datagoAvailable();
}

export async function investorRankTop50(range: DateRange): Promise<{ foreign: RankedStock[]; institute: RankedStock[] }> {
  const { start, end } = clampRange(range);
  const cacheKey = `${start}_${end}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const universe = await datagoTopByMarketCap(UNIVERSE_SIZE);

  // 영업일 기준 필요한 일수를 넉넉히 추정해 페이지를 가져온 뒤 [start, end]만 합산
  const calendarSpan =
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  const daysToFetch = Math.ceil(calendarSpan * 1.5) + 10;

  const rows = await Promise.all(
    universe.map(async (s) => {
      try {
        const trend = await naverFrgnTrend(s.code, daysToFetch);
        const inRange = trend.filter((r) => r.date >= start && r.date <= end);
        if (inRange.length === 0) return null;
        const foreign = inRange.reduce((sum, r) => sum + r.foreign, 0);
        const institute = inRange.reduce((sum, r) => sum + r.institute, 0);
        return { code: s.code, name: s.name, market: s.market, foreign, institute };
      } catch {
        return null;
      }
    })
  );

  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);

  const toRanked = (key: "foreign" | "institute"): RankedStock[] =>
    [...valid]
      .sort((a, b) => b[key] - a[key])
      .slice(0, TOP_N)
      .map((r) => ({ code: r.code, name: r.name, market: r.market, netBuy: r[key] }));

  const data = { foreign: toRanked("foreign"), institute: toRanked("institute") };
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_MS });
  return data;
}
