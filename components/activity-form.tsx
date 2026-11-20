"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActivityActionState } from "@/app/[locale]/(protected)/app/activities/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { activityKinds, type ActivityKind } from "@/lib/activity-validation";

export function ActivityForm({ action, locale, mode, cancelHref, initialValues }: {
  action: (state: ActivityActionState, form: FormData) => Promise<ActivityActionState>;
  locale: Locale; mode: "create" | "edit"; cancelHref: string;
  initialValues?: { name: string; kind: ActivityKind; isActive: boolean };
}) {
  const text = getDictionary(locale).activities;
  const [state, formAction, pending] = useActionState(action, { message: null });
  const [name, setName] = useState(initialValues?.name ?? "");
  const [kind, setKind] = useState(initialValues?.kind ?? "culture");
  const [active, setActive] = useState(String(initialValues?.isActive ?? true));
  return (
    <form action={formAction} className="activity-form">
      <input name="locale" type="hidden" value={locale} />
      <div className="form-field">
        <label htmlFor="activity-name">{text.form.name}</label>
        <input id="activity-name" name="name" type="text" required minLength={2} maxLength={120}
          autoComplete="off" placeholder={text.form.placeholder} value={name} onChange={(event) => setName(event.target.value)}
          aria-invalid={Boolean(state.errors?.name)} aria-describedby={state.errors?.name ? "activity-name-error" : undefined} />
        {state.errors?.name ? <span className="field-error" id="activity-name-error">{state.errors.name}</span> : null}
      </div>
      <div className="form-field">
        <label htmlFor="activity-kind">{text.form.kind}</label>
        <select id="activity-kind" name="kind" required value={kind} onChange={(event) => setKind(event.target.value as ActivityKind)}
          aria-invalid={Boolean(state.errors?.kind)} aria-describedby={state.errors?.kind ? "activity-kind-error" : undefined}>
          {activityKinds.map((value) => <option key={value} value={value}>{text.kinds[value]}</option>)}
        </select>
        {state.errors?.kind ? <span className="field-error" id="activity-kind-error">{state.errors.kind}</span> : null}
      </div>
      <div className="form-field">
        <label htmlFor="activity-state">{text.form.state}</label>
        <select id="activity-state" name="isActive" required value={active} onChange={(event) => setActive(event.target.value)}
          aria-invalid={Boolean(state.errors?.isActive)} aria-describedby={state.errors?.isActive ? "activity-state-error" : "activity-state-hint"}>
          <option value="true">{text.active}</option><option value="false">{text.inactive}</option>
        </select>
        <span className="field-hint" id="activity-state-hint">{text.form.stateHint}</span>
        {state.errors?.isActive ? <span className="field-error" id="activity-state-error">{state.errors.isActive}</span> : null}
      </div>
      {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? mode === "create" ? text.form.creating : text.form.saving : mode === "create" ? text.form.create : text.form.save}
        </button>
        <Link className="button button-secondary" href={cancelHref}>{text.form.cancel}</Link>
      </div>
    </form>
  );
}
