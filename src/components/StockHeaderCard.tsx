"use client";

import { useEffect, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import FavoriteButton from "@/components/FavoriteButton";
import CurrencyToggle from "@/components/CurrencyToggle";

export interface HeaderQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  marketState: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number | null;
  volume: number | null;
  marketCap: number | null;
  week52High: number | null;
  week52Low: number | null;
  forwardPer?: number | string | null;
  dividendYield?: number | null;
  targetMeanPrice?: number | null;
  preMarketPrice?: number | null;
  preMarketChangePercent?: number | null;
  postMarketPrice?: number | null;
  postMarketChangePercent?: number | null;
  regularMarketTime?: string | null;
  industry?: string | null;
  sectorKo?: string | null;
}

const MARKET_STATE_KO: Record<string, string> = {
  REGULAR: "거래중",
  PRE: "프리마켓",
  POST: "애프터마켓",
  POSTPOST: "애프터마켓",
  CLOSED: "마감",
};

function fmtRatio(val: number | string | null | undefined): string {
  if (val == null) return "-";
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isFinite(n) ? n.toFixed(2) : "-";
}

function fmtVolume(v: number | null): string {
  if (v == null) return "-";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return v.toLocaleString();
}

export default function StockHeaderCard({ quote: initialQuote }: { quote: HeaderQuote }) {
  const { fmt, fmtPrice, selected, rate } = useCurrency();
  const [now, setNow] = useState<string>("");
  const [quote, setQuote] = useState(initialQuote);

  useEffect(() => {
    const update = () =>
      setNow(new Date().toLocaleTimeString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" }) + " KST");
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  // 종목을 옮겨다닐 때(티커 변경) 최신 서버 렌더 값으로 초기화
  useEffect(() => {
    setQuote(initialQuote);
  }, [initialQuote]);

  // 가격·거래량 등 실시간성 값만 주기적으로 다시 받아온다 (이름/섹터 등 정적 정보는 유지)
  useEffect(() => {
    const symbol = initialQuote.symbol;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const d = await res.json();
        setQuote((prev) => ({
          ...prev,
          price: d.price ?? prev.price,
          change: d.change ?? prev.change,
          changePercent: d.changePercent ?? prev.changePercent,
          marketState: d.marketState ?? prev.marketState,
          previousClose: d.previousClose ?? prev.previousClose,
          volume: d.volume ?? prev.volume,
          marketCap: d.marketCap ?? prev.marketCap,
          preMarketPrice: d.preMarketPrice ?? null,
          preMarketChangePercent: d.preMarketChangePercent ?? null,
          postMarketPrice: d.postMarketPrice ?? null,
          postMarketChangePercent: d.postMarketChangePercent ?? null,
          regularMarketTime: d.regularMarketTime ?? prev.regularMarketTime,
        }));
      } catch {
        // 실패하면 다음 주기에 다시 시도
      }
    };

    const t = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [initialQuote.symbol]);

  const isUsd = quote.currency === "USD";
  const isUp = quote.changePercent >= 0;

  const hasPost = quote.marketState !== "REGULAR" && quote.postMarketPrice != null;
  const hasPre = quote.marketState === "PRE" && quote.preMarketPrice != null;
  const bigPrice = hasPost ? quote.postMarketPrice! : hasPre ? quote.preMarketPrice! : quote.price;
  const bigChangePercent = hasPost
    ? quote.postMarketChangePercent ?? quote.changePercent
    : hasPre
    ? quote.preMarketChangePercent ?? quote.changePercent
    : quote.changePercent;
  const bigIsUp = bigChangePercent >= 0;
  const showSubline = hasPost || hasPre;

  const krwEquivalent = isUsd && selected === "USD" ? Math.round(quote.price * rate) : null;

  const week52Pct =
    quote.week52High != null && quote.week52Low != null && quote.week52High > quote.week52Low
      ? Math.min(100, Math.max(0, ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100))
      : null;

  const upside =
    quote.targetMeanPrice != null && quote.price > 0
      ? ((quote.targetMeanPrice - quote.price) / quote.price) * 100
      : null;

  const stateLabel = MARKET_STATE_KO[quote.marketState] ?? quote.marketState;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 mb-6 shadow-sm">
      {/* 이름 행 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {quote.symbol.slice(0, 1)}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">{quote.name} 주가·정보</h1>
            <FavoriteButton stock={{ symbol: quote.symbol, name: quote.name, market: quote.exchange }} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{quote.symbol}</span>
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{quote.exchange}</span>
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{isUsd ? "US" : "KR"}</span>
          </div>
          {(quote.sectorKo || quote.industry) && (
            <p className="text-slate-400 text-xs mt-2">
              {[quote.sectorKo, quote.industry].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <CurrencyToggle />
      </div>

      {/* 큰 가격 */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-4xl font-bold tabular-nums">{fmtPrice(bigPrice, isUsd ? "USD" : "KRW")}</span>
        <span
          className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded ${
            bigIsUp ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {bigIsUp ? "▲" : "▼"} {Math.abs(bigChangePercent).toFixed(2)}%
        </span>
        <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2 py-1 rounded">{stateLabel}</span>
        {now && <span className="text-slate-500 text-xs ml-auto">{now}</span>}
      </div>

      {showSubline && (
        <p className="text-slate-400 text-sm mt-1">
          정규 종가 {fmtPrice(quote.price, isUsd ? "USD" : "KRW")}{" "}
          <span className={isUp ? "text-red-400" : "text-blue-400"}>
            {isUp ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}%
          </span>
        </p>
      )}

      {krwEquivalent != null && <p className="text-slate-500 text-sm mt-1">≈ ₩{krwEquivalent.toLocaleString("ko-KR")}</p>}

      {/* 정규/프리/애프터 박스 */}
      {isUsd && (
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className={`rounded-lg p-3 ${quote.marketState === "REGULAR" ? "bg-slate-800 ring-1 ring-slate-600" : "bg-slate-800/50"}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">정규장</span>
              {quote.marketState === "REGULAR" && (
                <span className="text-[10px] font-semibold bg-slate-600 text-slate-200 px-1.5 py-0.5 rounded">표시중</span>
              )}
            </div>
            <p className="font-bold mt-1 tabular-nums">{fmtPrice(quote.price, "USD")}</p>
            <p className={`text-xs font-medium mt-0.5 ${isUp ? "text-red-400" : "text-blue-400"}`}>
              {isUp ? "+" : ""}
              {quote.changePercent.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-lg p-3 bg-slate-800/50">
            <span className="text-xs text-slate-400">프리</span>
            {quote.preMarketPrice != null ? (
              <>
                <p className="font-bold mt-1 tabular-nums">{fmtPrice(quote.preMarketPrice, "USD")}</p>
                <p className={`text-xs font-medium mt-0.5 ${(quote.preMarketChangePercent ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {(quote.preMarketChangePercent ?? 0) >= 0 ? "+" : ""}
                  {(quote.preMarketChangePercent ?? 0).toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm mt-1">거래없음</p>
            )}
          </div>
          <div className="rounded-lg p-3 bg-slate-800/50">
            <span className="text-xs text-slate-400">애프터</span>
            {quote.postMarketPrice != null ? (
              <>
                <p className="font-bold mt-1 tabular-nums">{fmtPrice(quote.postMarketPrice, "USD")}</p>
                <p className={`text-xs font-medium mt-0.5 ${(quote.postMarketChangePercent ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {(quote.postMarketChangePercent ?? 0) >= 0 ? "+" : ""}
                  {(quote.postMarketChangePercent ?? 0).toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm mt-1">거래없음</p>
            )}
          </div>
        </div>
      )}

      {/* 실시간 세션 시세 */}
      <div className="flex flex-wrap items-center gap-2 mt-4 bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
        <span className="text-slate-400 text-xs">실시간 세션 시세</span>
        <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">{stateLabel}</span>
        <span className="font-bold tabular-nums">{fmtPrice(bigPrice, isUsd ? "USD" : "KRW")}</span>
        <span className={`font-medium tabular-nums ${bigIsUp ? "text-red-400" : "text-blue-400"}`}>
          {bigIsUp ? "+" : ""}
          {Math.abs(quote.change).toFixed(2)} ({bigIsUp ? "+" : "-"}
          {Math.abs(bigChangePercent).toFixed(2)}%)
        </span>
        {now && <span className="text-slate-500 text-xs">{now}</span>}
        <span className="text-emerald-400 text-xs font-semibold ml-auto">실시간</span>
      </div>

      {/* 요약 문장 */}
      <p className="text-slate-400 text-sm mt-4">
        {quote.name} 주가는 현재 {fmtPrice(bigPrice, isUsd ? "USD" : "KRW")}, 전일 대비 {isUp ? "+" : ""}
        {quote.changePercent.toFixed(2)}%. PER/PBR/시총/52주 범위와 최신 뉴스를 함께 확인하세요.
      </p>

      {/* 지표 타일 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">컨센서스 목표가</p>
          <p className="font-bold mt-1 tabular-nums">{quote.targetMeanPrice != null ? fmtPrice(quote.targetMeanPrice, "USD") : "-"}</p>
          {upside != null && (
            <p className={`text-xs font-medium mt-0.5 ${upside >= 0 ? "text-red-400" : "text-blue-400"}`}>
              상승여력 {upside >= 0 ? "+" : ""}
              {upside.toFixed(1)}%
            </p>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">포워드 PER</p>
          <p className="font-bold mt-1 tabular-nums">{fmtRatio(quote.forwardPer)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">52주 위치</p>
          <p className="font-bold mt-1 tabular-nums">{week52Pct != null ? `${week52Pct.toFixed(0)}%` : "-"}</p>
          {week52Pct != null && (
            <div className="h-1 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${week52Pct}%` }} />
            </div>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">시가총액</p>
          <p className="font-bold mt-1 tabular-nums">{fmt(quote.marketCap, isUsd ? "USD" : "KRW")}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">거래량</p>
          <p className="font-bold mt-1 tabular-nums">{fmtVolume(quote.volume)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-slate-400 text-xs">배당수익률</p>
          <p className="font-bold mt-1 tabular-nums">{quote.dividendYield != null ? `${quote.dividendYield.toFixed(2)}%` : "0.00%"}</p>
        </div>
      </div>
    </div>
  );
}
