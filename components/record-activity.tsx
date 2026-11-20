import Link from "next/link";
import { ActivityStatus } from "@/components/activity-status";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { ActivityOption } from "@/lib/activity-service";

export function RecordActivity({ locale, activityId, activities }: {
  locale: Locale; activityId: string | null; activities: ActivityOption[];
}) {
  const text = getDictionary(locale).activities;
  const activity = activities.find((item) => item.id === activityId);
  return <section className="record-activity-link">
    <h2>{text.assignment.label}</h2>
    {activity ? <div className="activity-badges"><Link href={`/${locale}/app/activities/${activity.id}`}>{activity.name}</Link>
      <ActivityStatus locale={locale} active={activity.is_active} /></div>
      : <p>{activityId ? text.assignment.unavailable : text.assignment.unassigned}</p>}
  </section>;
}
