import Link from "next/link";
import { TaskReminderRefresh } from "@/components/task-reminder-refresh";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatCount } from "@/lib/format";
import { getTaskContext } from "@/lib/tasks";

export async function TaskSummary({ locale }: { locale: Locale }) {
  const { service } = await getTaskContext(locale);
  const result = await service.summary();
  const text = getDictionary(locale).tasks;
  // Use the same day as the counts, even if a request spans Tunisian midnight.
  const today = result.ok ? result.data.dates.today : "";
  const hrefs = {
    pending: "?view=pending", dueToday: `?view=pending&dueFrom=${today}&dueTo=${today}`,
    overdue: "?view=overdue", completed: "?view=completed", upcoming: "?view=upcoming",
  };
  return <section className="dashboard-cycle-summary">
    <TaskReminderRefresh />
    <div className="dashboard-section-heading"><div><h2>{text.summary.title}</h2><p>{text.summary.hint}</p></div>
      <Link className="button button-secondary button-small" href={`/${locale}/app/tasks`}>{text.summary.view}</Link>
    </div>
    {!result.ok ? <p className="form-message error" role="alert">{text.errors.loadFailed}</p> : <>
      <div className="task-summary-grid">{(["pending", "dueToday", "overdue", "completed", "upcoming"] as const).map((key) =>
        <Link key={key} className={key === "overdue" && result.data.overdue > 0 ? "has-overdue" : ""} href={`/${locale}/app/tasks${hrefs[key]}`}>
          <span>{text.summary[key]}</span><strong>{formatCount(result.data[key], locale)}</strong>
        </Link>)}
      </div>
      {result.data.overdue > 0 || result.data.dueToday > 0 ? <aside className="task-reminder-notice" aria-label={text.reminders.title}>
        {result.data.overdue > 0 ? <Link href={`/${locale}/app/tasks?view=overdue`}>{text.reminders.overdue.replace("{count}", formatCount(result.data.overdue, locale))} →</Link> : null}
        {result.data.dueToday > 0 ? <Link href={`/${locale}/app/tasks${hrefs.dueToday}`}>{text.reminders.today.replace("{count}", formatCount(result.data.dueToday, locale))} →</Link> : null}
      </aside> : null}
    </>}
    <p className="field-hint">{text.reminders.window} {text.reminders.refresh}</p>
  </section>;
}
