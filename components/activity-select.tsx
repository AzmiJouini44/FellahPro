"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { ActivityOption } from "@/lib/activity-service";

export function ActivitySelect({ locale, activities, mode, initialActivityId, inheritFromPlot = false, error }: {
  locale: Locale; activities: ActivityOption[]; mode: "create" | "edit";
  initialActivityId?: string | null; inheritFromPlot?: boolean; error?: string;
}) {
  const text = getDictionary(locale).activities;
  const initial = mode === "create" && inheritFromPlot ? "inherit" : initialActivityId ?? "";
  const [selected, setSelected] = useState(initial);
  // Unchanged edit controls do not send a stale assignment back to the server.
  const submitSelection = mode === "create" ? selected !== "inherit" : selected !== initial;
  return (
    <div className="form-field">
      <label htmlFor="record-activity">{text.assignment.label}</label>
      <select id="record-activity" name={submitSelection ? "activityId" : undefined} value={selected}
        onChange={(event) => setSelected(event.target.value)} aria-invalid={Boolean(error)}
        aria-describedby={error ? "record-activity-error" : "record-activity-hint"}>
        {mode === "create" && inheritFromPlot ? <option value="inherit">{text.assignment.inherit}</option> : null}
        <option value="">{text.assignment.none}</option>
        {initialActivityId && !activities.some((activity) => activity.id === initialActivityId) ?
          <option value={initialActivityId} disabled>{text.assignment.unavailable}</option> : null}
        {activities.map((activity) => <option key={activity.id} value={activity.id}>
          {activity.name}{activity.is_active ? "" : ` — ${text.inactive}`}
        </option>)}
      </select>
      <span className="field-hint" id="record-activity-hint">{mode === "edit" ? text.assignment.preserve : text.assignment.hint}</span>
      {error ? <span className="field-error" id="record-activity-error">{error}</span> : null}
    </div>
  );
}
