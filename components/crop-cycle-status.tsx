import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { CropCycleStatus } from "@/lib/crop-cycle-validation";

export function CropCycleStatusBadge({
  locale,
  status,
}: {
  locale: Locale;
  status: CropCycleStatus;
}) {
  return (
    <span className={`cycle-status cycle-status-${status}`}>
      {getDictionary(locale).cropCycles.statuses[status]}
    </span>
  );
}
