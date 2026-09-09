import Link from "next/link";
import StockChart from "@/components/StockChart";
import FinancialTable from "@/components/FinancialTable";
import NewsCard from "@/components/NewsCard";
import InvestorChart from "@/components/InvestorChart";
import FinancialSnapshot from "@/components/FinancialSnapshot";
import CurrencyToggle from "@/components/CurrencyToggle";
import CompanyProfile from "@/components/CompanyProfile";
import StockHeaderCard from "@/components/StockHeaderCard";
import AtAGlanceSummary from "@/components/AtAGlanceSummary";
import KeyMetricsCard from "@/components/KeyMetricsCard";
import MaxPainCard from "@/components/MaxPainCard";
import RecordRecentView from "@/components/RecordRecentView";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { isKoreanStock } from "@/lib/naver";
import { getQuoteData } from "@/lib/quote";
import { getProfileData } from "@/lib/profile";

export default async function StockPage(props: PageProps<"/stock/[ticker]">) {
  const { ticker } = await props.params;
  const decodedTicker = decodeURIComponent(ticker);
  const [quote, profile] = await Promise.all([getQuoteData(decodedTicker), getProfileData(decodedTicker)]);
  const isKorean = isKoreanStock(decodedTicker);
  const baseCurrency = quote?.currency === "USD" ? "USD" : "KRW";

  return (
    <CurrencyProvider baseCurrency={baseCurrency}>
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-6">

          <Link href="/"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm mb-6 transition-colors">
            ← 홈으로
          </Link>

          {/* ── 종목 헤더 ── */}
          {quote ? (
            <>
              <RecordRecentView stock={{ symbol: quote.symbol, name: quote.name, market: quote.exchange }} />
              <StockHeaderCard
                quote={{
                  symbol: quote.symbol,
                  name: quote.name,
                  exchange: quote.exchange,
                  currency: quote.currency,
                  marketState: quote.marketState,
                  price: quote.price,
                  change: quote.change,
                  changePercent: quote.changePercent,
                  previousClose: quote.previousClose ?? null,
                  volume: quote.volume,
                  marketCap: quote.marketCap,
                  week52High: quote.week52High,
                  week52Low: quote.week52Low,
                  forwardPer: quote.forwardPer,
                  dividendYield: quote.dividendYield,
                  targetMeanPrice: quote.targetMeanPrice,
                  preMarketPrice: quote.preMarketPrice,
                  preMarketChangePercent: quote.preMarketChangePercent,
                  postMarketPrice: quote.postMarketPrice,
                  postMarketChangePercent: quote.postMarketChangePercent,
                  regularMarketTime: quote.regularMarketTime,
                  industry: profile?.industry ?? null,
                  sectorKo: profile?.sectorKo ?? null,
                }}
              />
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{decodedTicker}</h1>
                <p className="text-gray-500 text-sm mt-1">시세를 불러올 수 없습니다.</p>
              </div>
              <CurrencyToggle />
            </div>
          )}

          {/* ── 본문 + 우측 고정 사이드바 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
            <div className="min-w-0">
              {/* ── 차트 (RSI + 기간 성과 포함) ── */}
              <div className="mb-6">
                <StockChart ticker={decodedTicker} />
              </div>

              {/* ── 옵션 / Max Pain (미국 종목만 데이터 존재 시 표시) ── */}
              <MaxPainCard ticker={decodedTicker} canonicalPrice={quote?.price ?? null} />

              {/* ── 한눈에 요약 (52주 위치·애널 컨센서스·실적·평가) ── */}
              {quote && (
                <AtAGlanceSummary
                  ticker={decodedTicker}
                  price={quote.price}
                  week52High={quote.week52High}
                  week52Low={quote.week52Low}
                  targetMeanPrice={quote.targetMeanPrice ?? null}
                  regularMarketTime={quote.regularMarketTime ?? null}
                  isUsd={quote.currency === "USD"}
                />
              )}

              {/* ── 기업 정보 ── */}
              <div className="mb-6">
                <CompanyProfile ticker={decodedTicker} />
              </div>

              {/* ── 재무 스냅샷 (밸류에이션·수익성·성장&안정성·배당·원시재무·거래정보) ── */}
              <FinancialSnapshot
                ticker={decodedTicker}
                canonicalPreviousClose={quote?.previousClose ?? null}
                canonicalVolume={quote?.volume ?? null}
                canonicalMarketCap={quote?.marketCap ?? null}
                canonicalPrice={quote?.price ?? null}
              />

              {/* ── 재무제표 + 뉴스 ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <FinancialTable ticker={decodedTicker} />
                <NewsCard ticker={decodedTicker} />
              </div>

              {/* ── 투자자 현황 (한국 주식만) ── */}
              {isKorean && (
                <div className="mb-6">
                  <InvestorChart ticker={decodedTicker} />
                </div>
              )}
            </div>

            {/* ── 우측 사이드바: 핵심 지표 (스크롤 시 고정) ── */}
            {quote && (
              <div className="lg:sticky lg:top-6 mb-6">
                <KeyMetricsCard
                  per={quote.per}
                  forwardPer={quote.forwardPer}
                  pbr={quote.pbr}
                  roe={quote.roe}
                  netMargin={quote.netMargin}
                  operatingMargin={quote.operatingMargin}
                  dividendYield={quote.dividendYield}
                  marketCap={quote.marketCap}
                  revenueGrowth={quote.revenueGrowth}
                  isUsd={quote.currency === "USD"}
                />
              </div>
            )}
          </div>

        </div>
      </main>
    </CurrencyProvider>
  );
}
