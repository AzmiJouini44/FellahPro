import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { ActivityKind } from "@/lib/activity-validation";

export function ActivityStatus({ locale, active }: { locale: Locale; active: boolean }) {
  const text = getDictionary(locale).activities;
  return <span className={`activity-status ${active ? "is-active" : "is-inactive"}`}>{active ? text.active : text.inactive}</span>;
}

export function ActivityKindBadge({ locale, kind }: { locale: Locale; kind: ActivityKind }) {
  return <span className="activity-kind">{getDictionary(locale).activities.kinds[kind]}</span>;
}
