import { NextRequest } from "next/server";
import { investorRankAvailable, investorRankTop50, clampRange } from "@/lib/investorRank";

export async function GET(request: NextRequest) {
  if (!investorRankAvailable()) {
    return Response.json({ available: false, foreign: [], institute: [] });
  }

  const start = request.nextUrl.searchParams.get("start") ?? undefined;
  const end = request.nextUrl.searchParams.get("end") ?? undefined;
  const range = clampRange(start || end ? { start: start ?? end!, end: end ?? start! } : undefined);

  try {
    const data = await investorRankTop50(range);
    return Response.json({ available: true, range, ...data });
  } catch (e) {
    console.error("[rank/investor] 실패:", e);
    return Response.json(
      { available: false, foreign: [], institute: [] },
      { status: 500 }
    );
  }
}
