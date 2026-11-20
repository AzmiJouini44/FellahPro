"use client";

import { useActionState, useState } from "react";
import { setTaskStatus } from "@/app/[locale]/(protected)/app/tasks/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { taskStatuses, type TaskStatus } from "@/lib/task-validation";

export function TaskStatusControl({ locale, id, status }: { locale: Locale; id: string; status: TaskStatus }) {
  const text = getDictionary(locale).tasks;
  const [value, setValue] = useState<string>(status);
  const [state, action, pending] = useActionState(setTaskStatus.bind(null, id), { message: null });
  return <form action={action} className="task-status-control">
    <input type="hidden" name="locale" value={locale} />
    <div className="form-field"><label htmlFor="task-quick-status">{text.form.status}</label>
      <select id="task-quick-status" name="status" required value={value} disabled={pending}
        onChange={(event) => setValue(event.target.value)} aria-invalid={Boolean(state.errors?.status)}>
        {taskStatuses.map((item) => <option key={item} value={item}>{text.statuses[item]}</option>)}
      </select>
    </div>
    <button type="submit" className="button button-secondary" disabled={pending || value === status}>
      {pending ? text.form.saving : text.form.changeStatus}
    </button>
    {state.message ? <p className="form-message error" role="alert">{state.errors?.status ?? state.message}</p> : null}
  </form>;
}
