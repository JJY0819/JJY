"use client";

import { useState, useEffect } from "react";

interface TrendItem {
  date: string;
  foreign: number;
  institute: number;
  individual: number;
}

interface InvestorData {
  available: boolean;
  trend?: TrendItem[];
  total?: { foreign: number; institute: number; individual: number };
  message?: string;
}

type Category = "foreign" | "institute" | "individual";

const CATS: { key: Category; label: string }[] = [
  { key: "foreign",    label: "외국인" },
  { key: "institute",  label: "기관"   },
  { key: "individual", label: "개인"   },
];

const PERIODS = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
const PERIOD_LABEL: Record<(typeof PERIODS)[number], string> = {
  "1D": "1일", "1W": "1주일", "1M": "1개월", "3M": "3개월", "6M": "6개월", "1Y": "1년",
};

function fmtShares(n: number): string {
  return Math.abs(n).toLocaleString();
}

function SummaryBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.abs(value) / max * 100, 100) : 0;
  const isUp = value >= 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={`font-semibold tabular-nums ${isUp ? "text-red-600" : "text-blue-600"}`}>
          {isUp ? "+" : "-"}{fmtShares(value)}주
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${isUp ? "bg-red-300" : "bg-blue-300"} rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function InvestorChart({ ticker }: { ticker: string }) {
  const [data, setData] = useState<InvestorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "summary">("chart");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1M");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/investor/${encodeURIComponent(ticker)}?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, period]);

  const trend = data?.trend ?? [];
  const total = data?.total;

  // 최대 절대값 (바 비율 계산용)
  const maxVal = trend.reduce((m, r) =>
    Math.max(m, Math.abs(r.foreign), Math.abs(r.institute), Math.abs(r.individual)), 1);

  const maxTotal = total
    ? Math.max(Math.abs(total.foreign), Math.abs(total.institute), Math.abs(total.individual), 1)
    : 1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-gray-900 font-semibold">투자자 현황 ({PERIOD_LABEL[period]})</h3>
        {data?.available && (
          <div className="flex gap-1">
            {(["chart", "summary"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  activeTab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t === "chart" ? "일별 추이" : "누적 합계"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              period === p ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        개인 순매매량은 거래소가 별도 제공하지 않아 -(외국인+기관)으로 추정한 값입니다.
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.available ? (
        <p className="text-gray-400 text-sm text-center py-8">{data?.message}</p>
      ) : activeTab === "chart" ? (
        /* ── 일별 추이 (날짜별 막대) ── */
        <div className="max-h-[480px] overflow-y-auto pr-1 space-y-5">
          {[...trend].reverse().map((row) => (
            <div key={row.date} className="space-y-3 pb-3 border-b border-gray-100 last:border-0">
              <p className="text-xs text-gray-400">{row.date}</p>
              {CATS.map((cat) => (
                <SummaryBar key={cat.key} label={cat.label} value={row[cat.key]} max={maxVal} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* ── 누적 합계 ── */
        <div className="space-y-4 pt-1">
          {total && CATS.map((cat) => (
            <SummaryBar
              key={cat.key}
              label={cat.label}
              value={total[cat.key]}
              max={maxTotal}
            />
          ))}
          <p className="text-xs text-gray-400 pt-1">{PERIOD_LABEL[period]} 누적 순매수 수량</p>
        </div>
      )}
    </div>
  );
}
