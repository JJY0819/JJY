"use client";

import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  per: number | string | null | undefined;
  forwardPer: number | string | null | undefined;
  pbr: number | string | null | undefined;
  roe: number | null | undefined;
  netMargin: number | null | undefined;
  operatingMargin: number | null | undefined;
  dividendYield: number | null | undefined;
  marketCap: number | null;
  revenueGrowth: number | null | undefined;
  isUsd: boolean;
}

function fmtRatio(val: number | string | null | undefined): string {
  if (val == null) return "—";
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isFinite(n) ? n.toFixed(2) : "—";
}

function fmtPercent(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${val.toFixed(2)}%`;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800 last:border-b-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span
        className={`font-semibold text-sm tabular-nums ${
          tone === "up" ? "text-red-400" : tone === "down" ? "text-blue-400" : "text-slate-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function KeyMetricsCard(props: Props) {
  const { fmt } = useCurrency();
  const tone = (v: number | null | undefined): "up" | "down" | undefined => (v == null ? undefined : v >= 0 ? "up" : "down");

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-5 bg-amber-400 rounded-full" />
        <h3 className="font-bold text-lg">핵심 지표</h3>
      </div>

      <div>
        <Row label="PER" value={fmtRatio(props.per)} />
        <Row label="포워드 PER" value={fmtRatio(props.forwardPer)} />
        <Row label="PBR" value={fmtRatio(props.pbr)} />
        <Row label="ROE" value={fmtPercent(props.roe)} tone={tone(props.roe)} />
        <Row label="순이익률" value={fmtPercent(props.netMargin)} tone={tone(props.netMargin)} />
        <Row label="영업이익률" value={fmtPercent(props.operatingMargin)} tone={tone(props.operatingMargin)} />
        <Row label="배당률" value={fmtPercent(props.dividendYield ?? 0)} />
        <Row label="시가총액" value={props.marketCap != null ? fmt(props.marketCap, props.isUsd ? "USD" : "KRW") : "—"} />
        <Row label="매출 성장" value={fmtPercent(props.revenueGrowth)} tone={tone(props.revenueGrowth)} />
      </div>
    </div>
  );
}
