import {
  CONFIDENCE_LABEL,
  DIFFICULTY_LABEL,
  OWNER_LABEL,
  TIER_LABEL,
  type ApprovalTier,
  type Confidence,
  type Owner,
  type Source,
} from "@/lib/guide-schema";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const TIER_STYLE: Record<ApprovalTier, string> = {
  self_serve: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  limited_until_review: "bg-amber-50 text-amber-800 ring-amber-200",
  review_required: "bg-orange-50 text-orange-800 ring-orange-200",
  partner_gated: "bg-rose-50 text-rose-800 ring-rose-200",
  no_public_oauth: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function TierBadge({ tier, className }: { tier: ApprovalTier; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TIER_STYLE[tier], className)}>
      {TIER_LABEL[tier]}
    </span>
  );
}

const DIFF_COLOR = ["", "bg-emerald-500", "bg-lime-500", "bg-amber-500", "bg-orange-500", "bg-rose-500"];

export function DifficultyMeter({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Difficulty ${value}/5`}>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={cx(size === "sm" ? "h-2 w-3" : "h-2.5 w-5", "rounded-sm", i <= value ? DIFF_COLOR[value] : "bg-slate-200")}
          />
        ))}
      </span>
      <span className={cx("font-medium text-slate-700", size === "sm" ? "text-xs" : "text-sm")}>{DIFFICULTY_LABEL[value]}</span>
    </span>
  );
}

const CONF_STYLE: Record<Confidence, string> = {
  tested: "bg-emerald-600 text-white",
  official: "bg-sky-100 text-sky-800",
  community: "bg-amber-100 text-amber-800",
  inferred: "bg-slate-200 text-slate-700",
};

const CONF_HELP: Record<Confidence, string> = {
  tested: "We did this ourselves and observed the result",
  official: "Stated in the provider's official docs or policies",
  community: "Reported by developers (forums, blogs); not official",
  inferred: "Reasoned from indirect evidence; treat as a hypothesis",
};

export function ConfidenceBadge({ value }: { value: Confidence }) {
  return (
    <span title={CONF_HELP[value]} className={cx("inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium", CONF_STYLE[value])}>
      {CONFIDENCE_LABEL[value]}
    </span>
  );
}

const OWNER_STYLE: Record<Owner, string> = {
  agent: "bg-violet-100 text-violet-800",
  you: "bg-slate-800 text-white",
  provider: "bg-amber-100 text-amber-900",
};
const OWNER_ICON: Record<Owner, string> = { agent: "🤖", you: "👤", provider: "⏳" };

export function OwnerBadge({ owner }: { owner: Owner }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium", OWNER_STYLE[owner])}>
      <span aria-hidden>{OWNER_ICON[owner]}</span>
      {OWNER_LABEL[owner]}
    </span>
  );
}

export function SourceChips({ ids, sources }: { ids: string[]; sources: Source[] }) {
  if (!ids.length) return null;
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.map((id) => {
        const s = byId.get(id);
        if (!s) return null;
        return (
          <a
            key={id}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={`${s.title} (${s.kind})`}
            className="rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-500 hover:border-indigo-300 hover:text-indigo-700"
          >
            {id}
          </a>
        );
      })}
    </span>
  );
}

export function OriginBadge({ origin }: { origin: "curated" | "generated" }) {
  return origin === "curated" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
      ✓ Human-verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
      🤖 Agent-generated
    </span>
  );
}

export function Section({ id, title, subtitle, children }: { id?: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
