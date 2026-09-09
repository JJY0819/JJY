import { getProfileData } from "@/lib/profile";

export async function GET(_req: Request, ctx: RouteContext<"/api/profile/[ticker]">) {
  const { ticker } = await ctx.params;
  const data = await getProfileData(ticker);
  if (!data) {
    return Response.json({ description: null }, { status: 500 });
  }
  return Response.json(data);
}
