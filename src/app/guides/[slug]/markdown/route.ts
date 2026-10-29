import { guideToMarkdown } from "@/lib/markdown";
import { getGuide } from "@/lib/store";

export async function GET(request: Request, { params }: RouteContext<"/guides/[slug]/markdown">) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return new Response("Not found", { status: 404 });
  const url = new URL(`/guides/${slug}`, request.url).toString();
  return new Response(guideToMarkdown(guide, url), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-oauth-guide.md"`,
    },
  });
}
