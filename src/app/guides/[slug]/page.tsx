import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GuideView } from "@/components/GuideView";
import { TIER_LABEL } from "@/lib/guide-schema";
import { getGuide } from "@/lib/store";

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: `${guide.app.name} OAuth app setup & approval`,
    description: `${guide.verdict.headline} ${TIER_LABEL[guide.verdict.approvalTier]}. Production: ${guide.verdict.timeToProduction}.`,
  };
}

async function GuideLoader({ params }: { params: PageProps<"/guides/[slug]">["params"] }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  return <GuideView guide={guide} />;
}

export default function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
          <div className="h-8 w-2/3 rounded bg-slate-200" />
          <div className="mt-6 h-40 rounded-xl bg-slate-200" />
        </div>
      }
    >
      <GuideLoader params={params} />
    </Suspense>
  );
}
