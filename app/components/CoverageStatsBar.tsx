import { formatDateLabel, formatRelative, todayStr } from "@/lib/date";
import type { CoverageSummary } from "@/lib/data/coverage";

export default function CoverageStatsBar({ coverage }: { coverage: CoverageSummary }) {
  // The board's date defaults to today but the date picker can select any
  // day - "Photos today" would misreport the count once someone picks a
  // past date, so the label follows coverage.date instead of assuming.
  const photosLabel = coverage.date === todayStr() ? "Photos today" : `Photos on ${formatDateLabel(coverage.date)}`;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-brand bg-navy px-5 py-4">
      <Stat label={photosLabel} value={coverage.photoCount} />
      <Stat label="Sites reported" value={`${coverage.sitesReported} of ${coverage.sitesTotal}`} />
      <Stat
        label="Day parts missing"
        value={coverage.dayPartsMissing}
        valueClassName={coverage.dayPartsMissing > 0 ? "text-amber-300" : undefined}
      />
      <Stat
        label="Open flags"
        value={coverage.openFlags}
        valueClassName={coverage.openFlags > 0 ? "text-red-300" : undefined}
      />
      <Stat label="Unmatched items" value={coverage.unmatchedItems} />
      {coverage.lastUpload && (
        <div className="ml-auto text-right">
          <p className="text-[11.5px] font-medium text-white/60">Last upload</p>
          <p className="mt-0.5 text-[15px] font-bold text-white">
            {formatRelative(coverage.lastUpload.at)} · {coverage.lastUpload.siteName}
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11.5px] font-medium text-white/60">{label}</p>
      <p className={`mt-0.5 text-[19px] font-bold text-white ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}
