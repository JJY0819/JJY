"use client";

import { useEffect, useState } from "react";

interface StrikeOI {
  strike: number;
  oi: number;
}

interface Expiry {
  expiration: string;
  maxPain: number | null;
  upsidePercent: number | null;
  pcr: number | null;
  sentiment: "bullish" | "bearish" | "neutral" | "unknown";
  callOI: number;
  putOI: number;
  topCalls: StrikeOI[];
  topPuts: StrikeOI[];
}

interface OptionsData {
  available: boolean;
  price: number;
  expiries: Expiry[];
}

const SENTIMENT_LABEL: Record<Expiry["sentiment"], string> = {
  bullish: "강세 편향",
  bearish: "약세 편향",
  neutral: "중립",
  unknown: "데이터 부족",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtOI(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtPrice(v: number): string {
  return `$${v.toFixed(2)}`;
}

export default function MaxPainCard({ ticker }: { ticker: string }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExplain, setShowExplain] = useState(false);

  useEffect(() => {
    fetch(`/api/options/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) {
    return <div className="bg-slate-900 rounded-xl p-5 shadow-sm h-40 animate-pulse mb-6" />;
  }

  if (!data?.available || data.expiries.length === 0) return null;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-amber-400 rounded-full" />
          <h3 className="font-bold text-lg">옵션 / Max Pain</h3>
        </div>
        <button
          onClick={() => setShowExplain((v) => !v)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            showExplain ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {showExplain ? "설명 닫기" : "Max Pain이 뭔가요?"}
        </button>
      </div>

      {showExplain && (
        <div className="mt-3 mb-4 bg-slate-800/95 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 leading-relaxed">
          <p className="font-semibold text-amber-400 mb-1.5">Max Pain(맥스 페인)이란?</p>
          <p className="mb-1.5">
            옵션은 만기일에 &ldquo;정산&rdquo;되는데, 그날 주가가 어디에 있느냐에 따라 콜(살 권리)·풋(팔 권리) 보유자들이
            받는 돈이 달라집니다. Max Pain은 그 만기에 옵션 매도자(발행 증권사 등)가 지급해야 할 총액이
            <b> 가장 적어지는 가격</b>을 미결제약정(OI) 기준으로 역산한 값입니다.
          </p>
          <p className="mb-1.5">
            일부 투자자들은 &ldquo;대형 옵션 매도자들이 유리한 이 가격 근처로 주가가 수렴하는 경향이 있다&rdquo;고 보고
            참고 지표로 삼습니다. PCR(풋/콜 비율)은 낮을수록(콜이 많을수록) 강세, 높을수록(풋이 많을수록) 약세로 해석합니다.
          </p>
          <p className="text-slate-500">※ 확정된 미래가 아니라 옵션시장 포지션을 보여주는 참고 지표일 뿐입니다.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        {data.expiries.map((e) => {
          const isUp = (e.upsidePercent ?? 0) >= 0;
          return (
            <div key={e.expiration} className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm mb-2">
                <span className="text-slate-400">만기 {fmtDate(e.expiration)}</span>
                <span className="font-bold">Max Pain {e.maxPain != null ? fmtPrice(e.maxPain) : "—"}</span>
                {e.upsidePercent != null && (
                  <span className={`font-semibold text-xs ${isUp ? "text-red-400" : "text-blue-400"}`}>
                    ({isUp ? "▲" : "▼"} {isUp ? "+" : ""}
                    {e.upsidePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 mb-3">
                <span>
                  PCR {e.pcr != null ? e.pcr.toFixed(2) : "—"}{" "}
                  <span
                    className={
                      e.sentiment === "bullish" ? "text-red-400" : e.sentiment === "bearish" ? "text-blue-400" : "text-slate-400"
                    }
                  >
                    {SENTIMENT_LABEL[e.sentiment]}
                  </span>
                </span>
                <span>·</span>
                <span>
                  Call OI {fmtOI(e.callOI)} · Put OI {fmtOI(e.putOI)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-red-400 text-[11px] font-semibold mb-1">상위 콜 OI</p>
                  {e.topCalls.length > 0 ? (
                    <div className="space-y-1">
                      {e.topCalls.map((c) => (
                        <div key={c.strike} className="flex items-center justify-between text-xs tabular-nums">
                          <span className="text-slate-300">{fmtPrice(c.strike)}</span>
                          <span className="text-slate-500">OI {fmtOI(c.oi)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">데이터 없음</p>
                  )}
                </div>
                <div>
                  <p className="text-blue-400 text-[11px] font-semibold mb-1">상위 풋 OI</p>
                  {e.topPuts.length > 0 ? (
                    <div className="space-y-1">
                      {e.topPuts.map((p) => (
                        <div key={p.strike} className="flex items-center justify-between text-xs tabular-nums">
                          <span className="text-slate-300">{fmtPrice(p.strike)}</span>
                          <span className="text-slate-500">OI {fmtOI(p.oi)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs">데이터 없음</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-slate-600 text-[11px] mt-3">
        Yahoo Finance 옵션 체인 기준, 현재가 {fmtPrice(data.price)} · 페이지를 새로 열 때마다 갱신됩니다.
      </p>
    </div>
  );
}
