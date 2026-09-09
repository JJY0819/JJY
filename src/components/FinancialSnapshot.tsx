"use client";

import { useEffect, useState } from "react";

interface SnapshotData {
  available: boolean;
  currency: string;
  per: number | null;
  forwardPer: number | null;
  pbr: number | null;
  psr: number | null;
  evEbitda: number | null;
  roe: number | null;
  roa: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  beta: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  eps: number | null;
  bps: number | null;
  operatingCashflow: number | null;
  freeCashflow: number | null;
  totalDebt: number | null;
  totalCash: number | null;
  ebitda: number | null;
  previousClose: number | null;
  volume: number | null;
  averageVolume: number | null;
  marketCap: number | null;
  employees: number | null;
  asOf: string;
}

function fmtRatio(v: number | null, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(digits);
}

function fmtPercent(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}

function fmtMoney(v: number | null, currency: string): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (currency === "USD") {
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}조`;
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(0)}억`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}백만`;
  return `${sign}${Math.round(abs).toLocaleString()}원`;
}

function fmtVolume(v: number | null, currency: string): string {
  if (v == null) return "—";
  if (currency === "USD") {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toLocaleString();
  }
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}억`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return v.toLocaleString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
}

function tone(v: number | null): "up" | "down" | undefined {
  if (v == null) return undefined;
  return v >= 0 ? "up" : "down";
}

function ValueText({ value, tone: t }: { value: string; tone?: "up" | "down" }) {
  return (
    <span className={`font-bold tabular-nums ${t === "up" ? "text-red-400" : t === "down" ? "text-blue-400" : "text-slate-100"}`}>
      {value}
    </span>
  );
}

function CardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1 h-4 bg-amber-400 rounded-full" />
      <h4 className="font-bold">{title}</h4>
    </div>
  );
}

function DetailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-2 border-t border-slate-800 mt-1 transition-colors"
    >
      <span>상세보기</span>
      <span>{open ? "▲" : "▼"}</span>
    </button>
  );
}

function DetailRow({ label, value, tone: t }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <ValueText value={value} tone={t} />
    </div>
  );
}

interface Props {
  ticker: string;
  // 헤더/사이드바와 같은 화면에 동시에 보이는 값들이라, 소스가 갈려서 서로 다른
  // 숫자가 찍히는 일이 없도록 페이지가 이미 확보한 값(canonical)을 우선 사용한다.
  canonicalPreviousClose?: number | null;
  canonicalVolume?: number | null;
  canonicalMarketCap?: number | null;
  canonicalPrice?: number | null;
}

export default function FinancialSnapshot({
  ticker,
  canonicalPreviousClose,
  canonicalVolume,
  canonicalMarketCap,
  canonicalPrice,
}: Props) {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [openValuation, setOpenValuation] = useState(true);
  const [openProfitability, setOpenProfitability] = useState(true);
  const [openGrowth, setOpenGrowth] = useState(true);
  const [openTrading, setOpenTrading] = useState(true);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = canonicalPrice ? `?price=${canonicalPrice}` : "";
    fetch(`/api/snapshot/${encodeURIComponent(ticker)}${qs}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker, canonicalPrice]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-900 rounded-xl p-5 shadow-sm h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.available) return null;
  const cur = data.currency;
  const previousClose = canonicalPreviousClose ?? data.previousClose;
  const volume = canonicalVolume ?? data.volume;
  const marketCap = canonicalMarketCap ?? data.marketCap;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* 밸류에이션 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="밸류에이션" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-slate-400 text-xs mb-1">PER</p>
            <ValueText value={fmtRatio(data.per)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">포워드 PER</p>
            <ValueText value={fmtRatio(data.forwardPer)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">PBR</p>
            <ValueText value={fmtRatio(data.pbr)} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-slate-400 text-xs mb-1">EV/EBITDA</p>
          <ValueText value={fmtRatio(data.evEbitda)} />
        </div>
        <DetailToggle open={openValuation} onToggle={() => setOpenValuation((v) => !v)} />
        {openValuation && (
          <div>
            <DetailRow label="PER (TTM)" value={fmtRatio(data.per)} />
            <DetailRow label="포워드 PER" value={fmtRatio(data.forwardPer)} />
            <DetailRow label="PBR" value={fmtRatio(data.pbr)} />
            <DetailRow label="PSR" value={fmtRatio(data.psr)} />
            <DetailRow label="EV/EBITDA" value={fmtRatio(data.evEbitda)} />
          </div>
        )}
      </div>

      {/* 수익성 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="수익성" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-slate-400 text-xs mb-1">ROE</p>
            <ValueText value={fmtPercent(data.roe)} tone={tone(data.roe)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">ROA</p>
            <ValueText value={fmtPercent(data.roa)} tone={tone(data.roa)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">순이익률</p>
            <ValueText value={fmtPercent(data.netMargin)} tone={tone(data.netMargin)} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-slate-400 text-xs mb-1">영업이익률</p>
          <ValueText value={fmtPercent(data.operatingMargin)} tone={tone(data.operatingMargin)} />
        </div>
        <DetailToggle open={openProfitability} onToggle={() => setOpenProfitability((v) => !v)} />
        {openProfitability && (
          <div>
            <DetailRow label="ROE" value={fmtPercent(data.roe)} tone={tone(data.roe)} />
            <DetailRow label="ROA" value={fmtPercent(data.roa)} tone={tone(data.roa)} />
            <DetailRow label="순이익률" value={fmtPercent(data.netMargin)} tone={tone(data.netMargin)} />
            <DetailRow label="영업이익률" value={fmtPercent(data.operatingMargin)} tone={tone(data.operatingMargin)} />
          </div>
        )}
      </div>

      {/* 성장 & 안정성 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="성장 & 안정성" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-slate-400 text-xs mb-1">매출 성장</p>
            <ValueText value={fmtPercent(data.revenueGrowth)} tone={tone(data.revenueGrowth)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">이익성장률</p>
            <ValueText value={fmtPercent(data.earningsGrowth)} tone={tone(data.earningsGrowth)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">부채비율</p>
            <ValueText value={fmtRatio(data.debtToEquity, 1)} />
          </div>
        </div>
        <DetailToggle open={openGrowth} onToggle={() => setOpenGrowth((v) => !v)} />
        {openGrowth && (
          <div>
            <DetailRow label="매출 성장률" value={fmtPercent(data.revenueGrowth)} tone={tone(data.revenueGrowth)} />
            <DetailRow label="이익 성장률" value={fmtPercent(data.earningsGrowth)} tone={tone(data.earningsGrowth)} />
            <DetailRow label="부채비율" value={fmtRatio(data.debtToEquity, 1)} />
            <DetailRow label="유동비율" value={fmtRatio(data.currentRatio, 2)} />
            <DetailRow label="베타" value={fmtRatio(data.beta)} />
          </div>
        )}
      </div>

      {/* 배당 내역 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="배당 내역" />
        <DetailRow label="배당수익률" value={fmtPercent(data.dividendYield)} />
        <DetailRow label="배당성향" value={fmtPercent(data.payoutRatio)} />
      </div>

      {/* 원시 재무 스냅샷 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="원시 재무 스냅샷" />
        <DetailRow label="EPS" value={data.eps != null ? fmtMoney(data.eps, cur) : "—"} />
        <DetailRow label="BPS" value={data.bps != null ? fmtMoney(data.bps, cur) : "—"} />
        <DetailRow label="영업현금흐름" value={fmtMoney(data.operatingCashflow, cur)} tone={tone(data.operatingCashflow)} />
        <DetailRow label="잉여현금흐름" value={fmtMoney(data.freeCashflow, cur)} tone={tone(data.freeCashflow)} />
        <DetailRow label="총부채" value={fmtMoney(data.totalDebt, cur)} />
        <DetailRow label="현금" value={fmtMoney(data.totalCash, cur)} />
        <DetailRow label="EBITDA" value={fmtMoney(data.ebitda, cur)} />
        <DetailRow label="기준기간" value="TTM" />
        <p className="text-slate-600 text-[11px] mt-2 pt-2 border-t border-slate-800">
          출처: yfinance · {fmtDate(data.asOf)}. 업데이트
        </p>
      </div>

      {/* 거래 정보 */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
        <CardHeader title="거래 정보" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-slate-400 text-xs mb-1">전일종가</p>
            <ValueText value={previousClose != null ? fmtMoney(previousClose, cur) : "—"} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">거래량</p>
            <ValueText value={fmtVolume(volume, cur)} />
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">시가총액</p>
            <ValueText value={fmtMoney(marketCap, cur)} />
          </div>
        </div>
        <DetailToggle open={openTrading} onToggle={() => setOpenTrading((v) => !v)} />
        {openTrading && (
          <div>
            <DetailRow label="전일 종가" value={previousClose != null ? fmtMoney(previousClose, cur) : "—"} />
            <DetailRow label="거래량" value={fmtVolume(volume, cur)} />
            <DetailRow label="평균 거래량" value={fmtVolume(data.averageVolume, cur)} />
            <DetailRow label="시가총액" value={fmtMoney(marketCap, cur)} />
            <DetailRow label="외국인 지분율" value="—" />
            <DetailRow label="직원 수" value={data.employees != null ? data.employees.toLocaleString() : "—"} />
          </div>
        )}
      </div>
    </div>
  );
}
