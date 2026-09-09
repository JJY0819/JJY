import { NextRequest } from "next/server";
import { getNaverCode, naverFrgnTrend } from "@/lib/naver";

const PERIOD_DAYS: Record<string, number> = {
  "1D": 1,
  "1W": 5,
  "1M": 21,
  "3M": 63,
  "6M": 126,
  "1Y": 252,
};

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/investor/[ticker]">
) {
  const { ticker } = await ctx.params;
  const code = getNaverCode(ticker);

  if (!code) {
    return Response.json({ available: false, message: "한국 주식만 지원됩니다." });
  }

  const period = request.nextUrl.searchParams.get("period") ?? "1M";
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS["1M"];

  try {
    const rows = await naverFrgnTrend(code, days);
    if (rows.length === 0) {
      return Response.json(
        { available: false, message: "투자자 현황을 불러올 수 없습니다." },
        { status: 500 }
      );
    }

    // rows는 최신순 → 차트 표시를 위해 날짜 오름차순으로 정렬
    // 개인 순매매량은 별도 제공되지 않아 -(외국인+기관)으로 추정한다
    const trend = [...rows].reverse().map((r) => ({
      date: r.date,
      foreign: r.foreign,
      institute: r.institute,
      individual: -(r.foreign + r.institute),
    }));

    const total = trend.reduce(
      (acc, r) => ({
        foreign: acc.foreign + r.foreign,
        institute: acc.institute + r.institute,
        individual: acc.individual + r.individual,
      }),
      { foreign: 0, institute: 0, individual: 0 }
    );

    return Response.json({ available: true, period, trend, total });
  } catch (e) {
    console.error("[investor] Naver 실패:", e);
    return Response.json(
      { available: false, message: "투자자 현황을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
