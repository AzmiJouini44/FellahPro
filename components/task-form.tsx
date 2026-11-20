"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TaskActionState } from "@/app/[locale]/(protected)/app/tasks/actions";
import { taskMemberLabel } from "@/components/task-status";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatUtcDate } from "@/lib/format";
import type { TaskOptions } from "@/lib/task-service";
import { taskPriorities, taskStatuses, type TaskField, type TaskInput } from "@/lib/task-validation";

export function TaskForm({ action, locale, mode, cancelHref, options, initialValues }: {
  action: (state: TaskActionState, form: FormData) => Promise<TaskActionState>;
  locale: Locale; mode: "create" | "edit"; cancelHref: string; options: TaskOptions; initialValues?: TaskInput;
}) {
  const text = getDictionary(locale).tasks;
  const [state, formAction, pending] = useActionState(action, { message: null });
  const [values, setValues] = useState({
    title: initialValues?.title ?? "", description: initialValues?.description ?? "",
    dueOn: initialValues?.dueOn ?? "", status: initialValues?.status ?? "a_faire",
    priority: initialValues?.priority ?? "normale", assignedTo: initialValues?.assignedTo ?? "",
    activityId: initialValues?.activityId ?? "", cropCycleId: initialValues?.cropCycleId ?? "",
    animalGroupId: initialValues?.animalGroupId ?? "",
  });
  function change(field: TaskField, value: string) {
    setValues((previous) => {
      if (field === "cropCycleId" && value) return {
        ...previous, cropCycleId: value, animalGroupId: "",
        activityId: options.cycles.find((cycle) => cycle.id === value)?.activity_id ?? "",
      };
      if (field === "animalGroupId" && value) return {
        ...previous, animalGroupId: value, cropCycleId: "",
        activityId: options.groups.find((group) => group.id === value)?.activity_id ?? "",
      };
      return { ...previous, [field]: value };
    });
  }
  const linked = Boolean(values.cropCycleId || values.animalGroupId);
  const error = (field: TaskField) => state.errors?.[field]
    ? <span className="field-error" id={`task-${field}-error`}>{state.errors[field]}</span> : null;
  const describedBy = (field: TaskField, hint?: string) =>
    [state.errors?.[field] ? `task-${field}-error` : "", hint].filter(Boolean).join(" ") || undefined;
  const optional = (label: string) => `${label} (${text.form.optional})`;

  return <form action={formAction} className="task-form">
    <input name="locale" type="hidden" value={locale} />
    <fieldset disabled={pending} className="task-form-fields">
      <div className="form-field task-full-width">
        <label htmlFor="task-title">{text.form.title}</label>
        <input id="task-title" name="title" type="text" required minLength={2} maxLength={120} autoComplete="off"
          value={values.title} onChange={(event) => change("title", event.target.value)} placeholder={text.form.titlePlaceholder}
          aria-invalid={Boolean(state.errors?.title)} aria-describedby={describedBy("title")} />
        {error("title")}
      </div>
      <div className="form-field task-full-width">
        <label htmlFor="task-description">{optional(text.form.description)}</label>
        <textarea id="task-description" name="description" rows={4} maxLength={2000} value={values.description}
          onChange={(event) => change("description", event.target.value)} placeholder={text.form.descriptionPlaceholder}
          aria-invalid={Boolean(state.errors?.description)} aria-describedby={describedBy("description", "task-description-hint")} />
        <span className="field-hint" id="task-description-hint">{text.form.descriptionHint}</span>{error("description")}
      </div>
      <div className="form-field">
        <label htmlFor="task-status">{text.form.status}</label>
        <select id="task-status" name="status" required value={values.status} onChange={(event) => change("status", event.target.value)}
          aria-invalid={Boolean(state.errors?.status)} aria-describedby={describedBy("status")}>
          {taskStatuses.map((status) => <option key={status} value={status}>{text.statuses[status]}</option>)}
        </select>{error("status")}
      </div>
      <div className="form-field">
        <label htmlFor="task-priority">{text.form.priority}</label>
        <select id="task-priority" name="priority" required value={values.priority} onChange={(event) => change("priority", event.target.value)}
          aria-invalid={Boolean(state.errors?.priority)} aria-describedby={describedBy("priority")}>
          {taskPriorities.map((priority) => <option key={priority} value={priority}>{text.priorities[priority]}</option>)}
        </select>{error("priority")}
      </div>
      <div className="form-field">
        <label htmlFor="task-dueOn">{optional(text.form.dueOn)}</label>
        <input id="task-dueOn" name="dueOn" type="date" value={values.dueOn} onChange={(event) => change("dueOn", event.target.value)}
          aria-invalid={Boolean(state.errors?.dueOn)} aria-describedby={describedBy("dueOn", "task-due-hint")} />
        <span className="field-hint" id="task-due-hint">{text.form.dueHint}</span>{error("dueOn")}
      </div>
      <div className="form-field">
        <label htmlFor="task-assignedTo">{optional(text.form.assignedTo)}</label>
        <select id="task-assignedTo" name="assignedTo" value={values.assignedTo} onChange={(event) => change("assignedTo", event.target.value)}
          aria-invalid={Boolean(state.errors?.assignedTo)} aria-describedby={describedBy("assignedTo")}>
          <option value="">{text.unassigned}</option>
          {options.members.map((member) => <option key={member.id} value={member.id}>{taskMemberLabel(locale, member)}</option>)}
        </select>{error("assignedTo")}
      </div>
      <div className="form-field task-full-width">
        <label htmlFor="task-activityId">{optional(text.form.activityId)}</label>
        {linked ? <input type="hidden" name="activityId" value={values.activityId} /> : null}
        <select id="task-activityId" name={linked ? undefined : "activityId"} disabled={linked} value={values.activityId}
          onChange={(event) => change("activityId", event.target.value)} aria-invalid={Boolean(state.errors?.activityId)}
          aria-describedby={describedBy("activityId", linked ? "task-linked-activity" : undefined)}>
          <option value="">{text.none}</option>
          {options.activities.map((activity) => <option key={activity.id} value={activity.id}>
            {activity.name}{activity.is_active ? "" : ` (${text.form.inactive})`}
          </option>)}
        </select>
        {linked ? <span className="field-hint" id="task-linked-activity">{text.form.linkedActivity}</span> : null}{error("activityId")}
      </div>
      <p className="field-hint task-full-width" id="task-links-hint">{text.form.linksHint}</p>
      <div className="form-field">
        <label htmlFor="task-cropCycleId">{optional(text.form.cropCycleId)}</label>
        <select id="task-cropCycleId" name="cropCycleId" value={values.cropCycleId} onChange={(event) => change("cropCycleId", event.target.value)}
          aria-invalid={Boolean(state.errors?.cropCycleId)} aria-describedby={describedBy("cropCycleId", "task-links-hint task-cycle-hint")}>
          <option value="">{text.none}</option>
          {options.cycles.map((cycle) => <option key={cycle.id} value={cycle.id} disabled={!cycle.activity_id}>
            {cycle.crop_name} — {formatUtcDate(cycle.started_on, locale)}{cycle.activity_id ? "" : ` (${text.form.needsActivity})`}
          </option>)}
        </select><span className="field-hint" id="task-cycle-hint">{text.form.unclassifiedCycle}</span>{error("cropCycleId")}
      </div>
      <div className="form-field">
        <label htmlFor="task-animalGroupId">{optional(text.form.animalGroupId)}</label>
        <select id="task-animalGroupId" name="animalGroupId" value={values.animalGroupId} onChange={(event) => change("animalGroupId", event.target.value)}
          aria-invalid={Boolean(state.errors?.animalGroupId)} aria-describedby={describedBy("animalGroupId", "task-links-hint")}>
          <option value="">{text.none}</option>
          {options.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>{error("animalGroupId")}
      </div>
    </fieldset>
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
    <div className="form-actions">
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? mode === "create" ? text.form.creating : text.form.saving : mode === "create" ? text.form.create : text.form.save}
      </button>
      <Link className="button button-secondary" href={cancelHref}>{text.form.cancel}</Link>
    </div>
  </form>;
}
