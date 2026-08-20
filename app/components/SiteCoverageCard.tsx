import Link from "next/link";
import type { CoverageStatus, SiteCoverage } from "@/lib/data/coverage";

const STATUS_META: Record<CoverageStatus, { label: string; stripe: string; pill: string }> = {
  incomplete: { label: "Incomplete", stripe: "border-t-error", pill: "bg-error-bg text-error" },
  needs_review: {
    label: "Needs review",
    stripe: "border-t-amber-500",
    pill: "bg-amber-50 text-amber-800",
  },
  complete: { label: "Complete", stripe: "border-t-success", pill: "bg-success-bg text-success" },
};

function buildMessage(s: SiteCoverage): string {
  if (s.status === "incomplete") {
    const missing = s.dayPartCoverage.filter((d) => d.count === 0).map((d) => d.dayPart.label);
    const missingText = `No ${missing.join(", ")} upload${missing.length === 1 ? "" : "s"}.`;
    return s.flagCount > 0
      ? `${missingText} ${s.flagCount} staff flag${s.flagCount === 1 ? "" : "s"} open.`
      : missingText;
  }
  if (s.status === "needs_review") {
    return `${s.unmatchedCount} photo${s.unmatchedCount === 1 ? "" : "s"} with no matched menu item.`;
  }
  return s.flagCount > 0
    ? `All day parts covered. ${s.flagCount} staff flag${s.flagCount === 1 ? "" : "s"} open.`
    : "All day parts covered. Nothing outstanding.";
}

export default function SiteCoverageCard({ coverage }: { coverage: SiteCoverage }) {
  const meta = STATUS_META[coverage.status];
  const message = buildMessage(coverage);
  const siteHref = `/dashboard?site=${coverage.site.id}`;
  const overflowCount = coverage.photoCount - coverage.previewCaptures.length;

  return (
    <div className={`rounded-brand border border-border-default border-t-[3px] bg-white p-4 ${meta.stripe}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={siteHref} className="truncate text-sm font-bold text-navy hover:text-brand">
            {coverage.site.name}
          </Link>
          <p className="mt-0.5 truncate text-[11.5px] text-secondary">
            {coverage.photoCount} photo{coverage.photoCount === 1 ? "" : "s"}
            {coverage.flagCount > 0 && ` · ${coverage.flagCount} flag${coverage.flagCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.pill}`}>
          {meta.label}
        </span>
      </div>

      {coverage.dayPartCoverage.length > 0 && (
        <div className="my-3.5 flex gap-1.5">
          {coverage.dayPartCoverage.map(({ dayPart, count }) => (
            <div key={dayPart.id} className="flex-1">
              <div
                className={`flex h-[26px] items-center justify-center rounded text-[11px] font-semibold ${
                  count === 0
                    ? "border border-dashed border-error-border bg-error-bg text-error"
                    : "bg-app text-navy"
                }`}
              >
                {count}
              </div>
              <p className="mt-1 truncate text-center text-[10px] text-muted" title={dayPart.label}>
                {dayPart.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <p
        className={`border-t border-border-subtle pt-2 text-[11.5px] leading-snug ${
          coverage.status === "incomplete" ? "text-error" : coverage.status === "needs_review" ? "text-amber-800" : "text-secondary"
        }`}
      >
        {message}
      </p>

      {coverage.previewCaptures.length > 0 && (
        <div className="mt-3 flex gap-1.5">
          {coverage.previewCaptures.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={c.id}
              src={c.thumbnailUrl ?? c.imageUrl}
              alt=""
              className="aspect-square min-w-0 flex-1 rounded object-cover"
            />
          ))}
          {overflowCount > 0 && (
            <div className="flex aspect-square flex-1 items-center justify-center rounded bg-app text-[11px] font-semibold text-secondary">
              +{overflowCount}
            </div>
          )}
        </div>
      )}

      {/* "Rankings"/"Flag an issue" are inherently per-photo actions elsewhere
          in this app - there's no single site-wide ranking or flag to jump
          to from a card. Both go to this site's own dashboard view, where
          the real per-photo actions already exist, rather than guessing
          which specific photo either should mean. */}
      <div className="mt-3 flex gap-4 border-t border-border-subtle pt-3 text-[12px] font-medium">
        <Link href={siteHref} className="text-brand hover:text-brand-light">
          Rankings
        </Link>
        <Link href={siteHref} className="text-secondary hover:text-body">
          Flag an issue
        </Link>
      </div>
    </div>
  );
}
