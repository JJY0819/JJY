"use client";

import { useState, useEffect } from "react";
import CategorySidebar from "./CategorySidebar";
import RightSidebar from "./RightSidebar";

interface RateItem {
  label: string;
  rate: number;
  changePercent: number;
  decimals: number;
  prefix?: string;
}

export default function ExchangeRateBar() {
  const [rates, setRates] = useState<RateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/exchange")
        .then((r) => r.json())
        .then((d) => setRates(d.data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));

    load();
    const t = setInterval(load, 15_000); // 실시간성 반영을 위한 주기적 재조회
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <CategorySidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <RightSidebar open={rightSidebarOpen} onClose={() => setRightSidebarOpen(false)} />

      <div className="bg-slate-900 border-b border-slate-800 text-xs py-2 px-4 flex items-center">

        {/* 햄버거 버튼 — 화면 맨 왼쪽 */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-shrink-0 flex flex-col justify-center gap-1 p-1.5 rounded hover:bg-slate-700 transition-colors"
          aria-label="카테고리 열기"
        >
          <span className="block w-4 h-0.5 bg-slate-300" />
          <span className="block w-4 h-0.5 bg-slate-300" />
          <span className="block w-4 h-0.5 bg-slate-300" />
        </button>

        {/* 환율 — 중앙 */}
        <div className="flex-1 flex items-center justify-center gap-6 overflow-x-auto scrollbar-none">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-3 w-24 bg-slate-700 rounded animate-pulse flex-shrink-0" />
              ))
            : rates.map((r) => {
                const isUp = r.changePercent >= 0;
                return (
                  <div key={r.label} className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="text-white font-semibold tabular-nums">
                      {r.prefix}
                      {r.rate.toLocaleString("ko-KR", {
                        minimumFractionDigits: r.decimals,
                        maximumFractionDigits: r.decimals,
                      })}
                    </span>
                    <span className={`font-medium tabular-nums ${isUp ? "text-red-400" : "text-blue-400"}`}>
                      {isUp ? "▲" : "▼"} {Math.abs(r.changePercent ?? 0).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
        </div>

        {/* 햄버거 버튼 — 화면 맨 오른쪽 */}
        <button
          onClick={() => setRightSidebarOpen(true)}
          className="flex-shrink-0 flex flex-col justify-center gap-1 p-1.5 rounded hover:bg-slate-700 transition-colors"
          aria-label="MY 메뉴 열기"
        >
          <span className="block w-4 h-0.5 bg-slate-300" />
          <span className="block w-4 h-0.5 bg-slate-300" />
          <span className="block w-4 h-0.5 bg-slate-300" />
        </button>
      </div>
    </>
  );
}
