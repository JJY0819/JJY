import { getQuoteData } from "@/lib/quote";

export async function GET(_req: Request, ctx: RouteContext<"/api/quote/[ticker]">) {
  const { ticker } = await ctx.params;
  const data = await getQuoteData(ticker);
  if (!data) {
    return Response.json({ error: "종목을 찾을 수 없습니다." }, { status: 404 });
  }
  return Response.json(data);
}
