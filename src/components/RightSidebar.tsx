"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWatchlist, StockRef } from "@/contexts/WatchlistContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "recent" | "favorites" | "rank";

interface RankedStock {
  code: string;
  name: string;
  market: string;
  netBuy: number;
}

interface QuoteInfo {
  price: number;
  changePercent: number;
  currency: string;
}

function fmtShares(n: number): string {
  const abs = Math.abs(n);
  return abs.toLocaleString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function QuoteBadge({ q }: { q?: QuoteInfo }) {
  if (!q) return <div className="w-16 h-8 flex-shrink-0" />;
  const isUp = q.changePercent >= 0;
  const priceStr =
    q.currency === "USD"
      ? `$${q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${Math.round(q.price).toLocaleString("ko-KR")}원`;
  return (
    <div className="text-right flex-shrink-0">
      <p className="text-sm font-semibold text-gray-900 tabular-nums">{priceStr}</p>
      <p className={`text-xs font-medium tabular-nums ${isUp ? "text-emerald-600" : "text-red-600"}`}>
        {isUp ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%
      </p>
    </div>
  );
}

function StockRow({
  stock,
  onNavigate,
  right,
}: {
  stock: StockRef;
  onNavigate: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center justify-between gap-2 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{stock.name}</p>
        <p className="text-xs text-gray-400">{stock.symbol}{stock.market ? ` · ${stock.market}` : ""}</p>
      </div>
      {right}
    </button>
  );
}

export default function RightSidebar({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("recent");
  const [rankType, setRankType] = useState<"foreign" | "institute">("foreign");
  const [rangeInput, setRangeInput] = useState({ start: todayStr(), end: todayStr() });
  const [appliedRange, setAppliedRange] = useState({ start: todayStr(), end: todayStr() });
  const [serverRange, setServerRange] = useState<{ start: string; end: string } | null>(null);
  const [rankData, setRankData] = useState<{ foreign: RankedStock[]; institute: RankedStock[] } | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const rankFetchedKeyRef = useRef<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, QuoteInfo>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  const router = useRouter();
  const { recent, favorites, toggleFavorite } = useWatchlist();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // 최근 본/관심종목에 현재가·등락률 표시 (한 번 불러온 종목은 다시 요청하지 않음)
  useEffect(() => {
    if (tab !== "recent" && tab !== "favorites") return;
    const list = tab === "recent" ? recent : favorites;
    list.forEach((s) => {
      if (requestedRef.current.has(s.symbol)) return;
      requestedRef.current.add(s.symbol);
      fetch(`/api/quote/${encodeURIComponent(s.symbol)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.price == null) return;
          setQuotes((prev) => ({
            ...prev,
            [s.symbol]: { price: d.price, changePercent: d.changePercent, currency: d.currency },
          }));
        })
        .catch(() => {});
    });
  }, [tab, recent, favorites]);

  useEffect(() => {
    if (tab !== "rank") return;
    const key = `${appliedRange.start}_${appliedRange.end}`;
    if (rankFetchedKeyRef.current === key) return;
    rankFetchedKeyRef.current = key;
    setRankLoading(true);
    fetch(`/api/rank/investor?start=${appliedRange.start}&end=${appliedRange.end}`)
      .then((r) => r.json())
      .then((d) => {
        setRankData({ foreign: d.foreign ?? [], institute: d.institute ?? [] });
        setServerRange(d.range ?? null);
      })
      .catch(() => {})
      .finally(() => setRankLoading(false));
  }, [tab, appliedRange]);

  const goTo = (symbol: string) => {
    onClose();
    router.push(`/stock/${encodeURIComponent(symbol)}`);
  };

  const rankList = rankData?.[rankType] ?? [];

  return (
    <>
      {/* 오버레이 */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 사이드바 패널 */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-250 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-slate-900">
          <span className="text-white font-bold text-sm tracking-wide">MY</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none" aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {([
            { key: "recent", label: "최근 본" },
            { key: "favorites", label: "관심종목" },
            { key: "rank", label: "매매동향 상위" },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t.key ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1">
          {tab === "recent" && (
            recent.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">최근 본 종목이 없어요</p>
            ) : (
              recent.map((s) => (
                <StockRow
                  key={s.symbol}
                  stock={s}
                  onNavigate={() => goTo(s.symbol)}
                  right={<QuoteBadge q={quotes[s.symbol]} />}
                />
              ))
            )
          )}

          {tab === "favorites" && (
            favorites.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">별을 눌러 관심종목에 담아보세요</p>
            ) : (
              favorites.map((s) => (
                <StockRow
                  key={s.symbol}
                  stock={s}
                  onNavigate={() => goTo(s.symbol)}
                  right={
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <QuoteBadge q={quotes[s.symbol]} />
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(s); }}
                        className="text-amber-400 text-lg px-1"
                        role="button"
                        aria-label="관심종목 삭제"
                      >
                        ★
                      </span>
                    </div>
                  }
                />
              ))
            )
          )}

          {tab === "rank" && (
            <div>
              {/* 기간 선택 */}
              <div className="px-5 py-3 border-b border-gray-100 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={rangeInput.start}
                    max={rangeInput.end}
                    onChange={(e) => setRangeInput((p) => ({ ...p, start: e.target.value }))}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1.5 text-gray-700"
                  />
                  <span className="text-gray-400 text-xs flex-shrink-0">~</span>
                  <input
                    type="date"
                    value={rangeInput.end}
                    max={todayStr()}
                    onChange={(e) => setRangeInput((p) => ({ ...p, end: e.target.value }))}
                    className="flex-1 min-w-0 text-xs border border-gray-200 rounded px-1.5 py-1.5 text-gray-700"
                  />
                  <button
                    onClick={() => setAppliedRange(rangeInput)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-gray-700 flex-shrink-0"
                  >
                    조회
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {serverRange ? `${serverRange.start} ~ ${serverRange.end} 누적 순매수 기준` : "최대 60일 범위까지 조회돼요"}
                </p>
              </div>

              <div className="flex gap-1 px-5 py-3">
                {([
                  { key: "foreign", label: "외국인" },
                  { key: "institute", label: "기관" },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setRankType(t.key)}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                      rankType === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t.label} 순매수
                  </button>
                ))}
              </div>

              {rankLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rankList.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">데이터를 불러올 수 없어요</p>
              ) : (
                rankList.map((s, i) => (
                  <button
                    key={s.code}
                    onClick={() => goTo(s.code)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xs text-gray-400 w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.code} · {s.market}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-600 tabular-nums flex-shrink-0">
                      +{fmtShares(s.netBuy)}주
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
