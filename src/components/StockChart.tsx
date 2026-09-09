"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  CandlestickData,
  LineData,
  HistogramData,
} from "lightweight-charts";
import { OHLCV, bollingerBands, sma, rsi } from "@/lib/indicators";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Props {
  ticker: string;
}

const PERIODS: { value: string; label: string }[] = [
  { value: "1D", label: "1일" },
  { value: "1W", label: "1주" },
  { value: "1M", label: "1개월" },
  { value: "3M", label: "3개월" },
  { value: "6M", label: "6개월" },
  { value: "1Y", label: "1년" },
  { value: "2Y", label: "2년" },
  { value: "5Y", label: "5년" },
];

const MA_COLORS: Record<number, string> = { 5: "#f59e0b", 20: "#ec4899", 60: "#a855f7", 120: "#22c55e" };

const CANDLE_UP = "#ef4444";
const CANDLE_DOWN = "#3b82f6";

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS: Record<number, string> = {
  0: "#94a3b8",
  0.236: "#38bdf8",
  0.382: "#34d399",
  0.5: "#a3e635",
  0.618: "#eab308",
  0.786: "#fb7185",
  1: "#94a3b8",
};

interface PeriodChange {
  amount: number;
  pct: number;
}

// 조회 구간의 스윙 고점/저점 사이 되돌림 레벨을 계산한다.
// 고점이 저점보다 먼저 나왔으면(하락 스윙) 고점=0%, 저점=100%로,
// 반대(상승 스윙)면 저점=0%, 고점=100%로 잡는다.
function computeFibLevels(data: OHLCV[]): { level: number; price: number }[] {
  let hiIdx = 0;
  let loIdx = 0;
  data.forEach((d, i) => {
    if (d.high > data[hiIdx].high) hiIdx = i;
    if (d.low < data[loIdx].low) loIdx = i;
  });
  const high = data[hiIdx].high;
  const low = data[loIdx].low;
  const downSwing = hiIdx <= loIdx;
  return FIB_LEVELS.map((level) => ({
    level,
    price: downSwing ? high - (high - low) * level : low + (high - low) * level,
  }));
}

export default function StockChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesListRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Histogram">[]>([]);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastDataRef = useRef<OHLCV[]>([]);
  const fibLinesRef = useRef<IPriceLine[]>([]);
  const [activePeriod, setActivePeriod] = useState<string>("1Y");
  const [loading, setLoading] = useState(true);
  const [periodChange, setPeriodChange] = useState<PeriodChange | null>(null);
  const [showFib, setShowFib] = useState(false);

  const { fmt, baseCurrency } = useCurrency();

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0f172a" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true },
      height: 680,
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    let cancelled = false;
    setLoading(true);
    setPeriodChange(null);

    async function loadData(c: IChartApi) {
      const res = await fetch(`/api/history/${ticker}?period=${activePeriod}`);
      const json = await res.json();
      if (cancelled || !json.data?.length) { setLoading(false); return; }

      const data: OHLCV[] = json.data;

      seriesListRef.current.forEach((s) => { try { c.removeSeries(s); } catch { /* ignore */ } });
      seriesListRef.current = [];
      fibLinesRef.current = []; // 기존 캔들 시리즈가 삭제되며 그 위 가격선도 함께 사라짐

      // ── 메인 패널(0): 캔들 + MA + BB ──
      const candle = c.addSeries(CandlestickSeries, {
        upColor: CANDLE_UP, downColor: CANDLE_DOWN,
        borderVisible: false, wickUpColor: CANDLE_UP, wickDownColor: CANDLE_DOWN,
      }, 0);
      candle.setData(data.map((d) => ({
        time: d.time as CandlestickData["time"],
        open: d.open, high: d.high, low: d.low, close: d.close,
      })));
      seriesListRef.current.push(candle);
      candleRef.current = candle;
      lastDataRef.current = data;

      if (showFib) {
        computeFibLevels(data).forEach(({ level, price }) => {
          const line = candle.createPriceLine({
            price,
            color: FIB_COLORS[level] ?? "#94a3b8",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${(level * 100).toFixed(1)}%`,
          });
          fibLinesRef.current.push(line);
        });
      }

      // Bollinger Bands
      const bb = bollingerBands(data);
      if (bb.length > 0) {
        const opts = { lineWidth: 1 as const, priceLineVisible: false, lastValueVisible: false };
        const bbU = c.addSeries(LineSeries, { ...opts, color: "rgba(148,163,184,0.5)" }, 0);
        bbU.setData(bb.map((d) => ({ time: d.time as LineData["time"], value: d.upper })));
        const bbM = c.addSeries(LineSeries, { ...opts, color: "rgba(148,163,184,0.4)", lineStyle: 2 }, 0);
        bbM.setData(bb.map((d) => ({ time: d.time as LineData["time"], value: d.middle })));
        const bbL = c.addSeries(LineSeries, { ...opts, color: "rgba(148,163,184,0.5)" }, 0);
        bbL.setData(bb.map((d) => ({ time: d.time as LineData["time"], value: d.lower })));
        seriesListRef.current.push(bbU, bbM, bbL);
      }

      // 이동평균선 5/20/60/120일
      (Object.entries(MA_COLORS) as unknown as [string, string][]).forEach(([period, color]) => {
        const maData = sma(data, Number(period));
        if (maData.length < 1) return;
        const s = c.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
        s.setData(maData.map((d) => ({ time: d.time as LineData["time"], value: d.value })));
        seriesListRef.current.push(s);
      });

      // ── 서브 패널(1): 거래량 ──
      const volume = c.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      }, 1);
      volume.setData(data.map((d) => ({
        time: d.time as HistogramData["time"],
        value: d.volume,
        color: d.close >= d.open ? "rgba(239,68,68,0.7)" : "rgba(59,130,246,0.7)",
      })));
      seriesListRef.current.push(volume);

      // ── 서브 패널(2): RSI(14) ──
      const rsiData = rsi(data);
      if (rsiData.length > 0) {
        const rsiSeries = c.addSeries(
          LineSeries,
          { color: "#f97316", lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
            title: "RSI(14)", priceFormat: { type: "price", precision: 1, minMove: 0.1 } },
          2
        );
        rsiSeries.setData(rsiData.map((d) => ({ time: d.time as LineData["time"], value: d.value })));
        rsiSeries.createPriceLine({ price: 70, color: "#475569", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
        rsiSeries.createPriceLine({ price: 30, color: "#475569", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
        seriesListRef.current.push(rsiSeries);
      }

      // 패널 높이 비율: 가격:거래량:RSI = 3:1:1
      const panes = c.panes();
      panes[0]?.setStretchFactor(3);
      panes[1]?.setStretchFactor(1);
      panes[2]?.setStretchFactor(1);

      c.timeScale().fitContent();

      // ── 기간 성과 계산 ──
      const firstClose = data[0].close;
      const lastClose  = data[data.length - 1].close;
      const amount = lastClose - firstClose;
      const pct    = (amount / firstClose) * 100;
      setPeriodChange({ amount, pct });

      setLoading(false);
    }

    loadData(chart).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [ticker, activePeriod]);

  const toggleFib = () => {
    setShowFib((prev) => {
      const next = !prev;
      const candle = candleRef.current;
      if (candle) {
        fibLinesRef.current.forEach((l) => { try { candle.removePriceLine(l); } catch { /* ignore */ } });
        fibLinesRef.current = [];
        if (next && lastDataRef.current.length > 1) {
          computeFibLevels(lastDataRef.current).forEach(({ level, price }) => {
            const line = candle.createPriceLine({
              price,
              color: FIB_COLORS[level] ?? "#94a3b8",
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `${(level * 100).toFixed(1)}%`,
            });
            fibLinesRef.current.push(line);
          });
        }
      }
      return next;
    });
  };

  const isUp = periodChange ? periodChange.pct >= 0 : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      {/* 기간 버튼 + 성과 */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setActivePeriod(p.value)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                activePeriod === p.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={toggleFib}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              showFib
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            피보나치 {showFib ? "ON" : "OFF"}
          </button>
        </div>

        {/* 기간 성과 표시 */}
        {periodChange && (
          <div className={`text-sm font-semibold tabular-nums ${isUp ? "text-red-600" : "text-blue-600"}`}>
            {isUp ? "▲" : "▼"}{" "}
            {fmt(Math.abs(periodChange.amount), baseCurrency)}
            {" "}
            ({isUp ? "+" : "-"}{Math.abs(periodChange.pct).toFixed(2)}%)
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        {(Object.entries(MA_COLORS) as [string, string][]).map(([p, c]) => (
          <span key={p} className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: c }} />
            <span className="text-gray-500">MA{p}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-gray-400 opacity-50" />
          <span className="text-gray-500">BB</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500 opacity-70" />
          <span className="text-gray-500">거래량</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-500 opacity-80" />
          <span className="text-gray-500">RSI(14)</span>
        </span>
        {showFib && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-amber-500" style={{ borderTop: "1px dashed #eab308" }} />
            <span className="text-gray-500">피보나치</span>
          </span>
        )}
      </div>

      <div className="relative rounded-lg overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10 rounded">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {showFib && (
          <div className="absolute top-3 left-3 z-20 max-w-[240px] bg-slate-800/95 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 leading-relaxed pointer-events-none">
            <p className="font-semibold text-amber-400 mb-1.5">피보나치 되돌림이란?</p>
            <p className="mb-1.5">
              주가가 크게 오르내린 뒤, 그 폭의 일정 비율(23.6%, 38.2%, 50%, 61.8%, 78.6%) 지점에서
              멈추거나 반등하는 경우가 많다는 경험적 패턴을 표시한 보조선입니다.
            </p>
            <p className="mb-1.5">0%는 이번 구간의 시작(고점 또는 저점), 100%는 반대쪽 끝입니다.</p>
            <p className="text-slate-500">※ 미래를 예측하는 지표가 아니라 참고용 보조선이에요.</p>
          </div>
        )}
        <div ref={containerRef} style={{ height: 680 }} />
      </div>
    </div>
  );
}
