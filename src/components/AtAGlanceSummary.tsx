"use client";

import { useEffect, useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  ticker: string;
  price: number;
  week52High: number | null;
  week52Low: number | null;
  targetMeanPrice: number | null;
  regularMarketTime: string | null;
  isUsd: boolean;
}

interface AnalystData {
  available: boolean;
  numberOfAnalysts: number | null;
  buy: number;
  hold: number;
  sell: number;
  earningsDate: string | null;
  latestRatingDate: string | null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const time = d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}. ${time}`;
}

export default function AtAGlanceSummary({ ticker, price, week52High, week52Low, targetMeanPrice, regularMarketTime, isUsd }: Props) {
  const { fmtPrice } = useCurrency();
  const [data, setData] = useState<AnalystData | null>(null);

  useEffect(() => {
    fetch(`/api/analyst/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [ticker]);

  const week52Pct =
    week52High != null && week52Low != null && week52High > week52Low
      ? Math.min(100, Math.max(0, ((price - week52Low) / (week52High - week52Low)) * 100))
      : null;

  const upside = targetMeanPrice != null && price > 0 ? ((targetMeanPrice - price) / price) * 100 : null;

  const total = data ? data.buy + data.hold + data.sell : 0;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-6 mb-6 shadow-sm">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="font-bold text-lg">한눈에 요약</h3>
        </div>
        <span className="text-slate-500 text-xs">공개 데이터 집계 · 투자 권유 아님</span>
      </div>

      {/* 4열 지표 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <p className="text-slate-400 text-xs mb-1">52주 위치</p>
          <p className="text-2xl font-bold tabular-nums">{week52Pct != null ? `${week52Pct.toFixed(0)}%` : "-"}</p>
          {week52Pct != null && (
            <div className="relative h-1 bg-slate-700 rounded-full mt-3 mb-2">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400 ring-2 ring-slate-900"
                style={{ left: `calc(${week52Pct}% - 5px)` }}
              />
            </div>
          )}
          {week52Low != null && week52High != null && (
            <p className="text-slate-500 text-xs tabular-nums">
              {fmtPrice(week52Low, isUsd ? "USD" : "KRW")} ~ {fmtPrice(week52High, isUsd ? "USD" : "KRW")}
            </p>
          )}
        </div>

        <div>
          <p className="text-slate-400 text-xs mb-1">애널 컨센서스</p>
          <p className="text-2xl font-bold tabular-nums">
            {targetMeanPrice != null ? fmtPrice(targetMeanPrice, isUsd ? "USD" : "KRW") : "-"}
          </p>
          {upside != null && (
            <p className={`text-sm font-semibold mt-1 ${upside >= 0 ? "text-red-400" : "text-blue-400"}`}>
              {upside >= 0 ? "+" : ""}
              {upside.toFixed(1)}% 괴리
            </p>
          )}
        </div>

        <div>
          <p className="text-slate-400 text-xs mb-1">다음 실적</p>
          <p className="text-2xl font-bold">{data?.earningsDate ? fmtDate(data.earningsDate) : "미정"}</p>
        </div>

        <div>
          <p className="text-slate-400 text-xs mb-1">근거·신선도</p>
          <p className="font-semibold">{data?.numberOfAnalysts != null ? `애널리스트 ${data.numberOfAnalysts}명` : "-"}</p>
          {regularMarketTime && <p className="text-slate-500 text-xs mt-1">가격 {fmtDateTime(regularMarketTime)}</p>}
        </div>
      </div>

      {/* 매수/중립/매도 */}
      {data?.available && total > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-red-400 font-bold">매수 {data.buy}</span>
              <span className="text-slate-400 font-bold">중립 {data.hold}</span>
              <span className="text-blue-400 font-bold">매도 {data.sell}</span>
            </div>
            {data.latestRatingDate && <span className="text-slate-500 text-xs">최근 관련 {fmtDate(data.latestRatingDate)}</span>}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
            <div className="bg-red-500" style={{ width: `${(data.buy / total) * 100}%` }} />
            <div className="bg-slate-500" style={{ width: `${(data.hold / total) * 100}%` }} />
            <div className="bg-blue-500" style={{ width: `${(data.sell / total) * 100}%` }} />
          </div>
        </div>
      )}

      <p className="text-slate-600 text-[11px] mt-4 leading-relaxed">
        * 정보 제공 목적이며 투자 권유가 아닙니다. 수치는 공개 데이터·애널리스트 컨센서스 집계값(기준일 표기).
      </p>
    </div>
  );
}
