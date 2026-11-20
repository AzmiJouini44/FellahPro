"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { LivestockActionState } from "@/app/[locale]/(protected)/app/livestock/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { AnimalGroup } from "@/lib/livestock-service";
import type { ActivityOption } from "@/lib/activity-service";
import type { LivestockField } from "@/lib/livestock-validation";

export function AnimalGroupForm({ locale, action, options, initialValues, cancelHref }: {
  locale: Locale; action: (state: LivestockActionState, form: FormData) => Promise<LivestockActionState>;
  options: ActivityOption[]; initialValues?: AnimalGroup; cancelHref: string;
}) {
  const text = getDictionary(locale).livestock;
  const [state, formAction, pending] = useActionState(action, { message: null });
  const [values, setValues] = useState({ name: initialValues?.name ?? "", species: initialValues?.species ?? "",
    openingCount: String(initialValues?.opening_count ?? 0), activityId: initialValues?.activity_id ?? "", isActive: String(initialValues?.is_active ?? true) });
  const error = (field: LivestockField) => state.errors?.[field] ? <span id={`group-${field}-error`} className="field-error">{state.errors[field]}</span> : null;
  const describe = (field: LivestockField, hint = "") => [state.errors?.[field] ? `group-${field}-error` : "", hint].filter(Boolean).join(" ") || undefined;
  return <form action={formAction} className="livestock-form">
    <input name="locale" type="hidden" value={locale} />
    <fieldset className="livestock-form-fields" disabled={pending}>
      {(["name", "species"] as const).map((field) => <div key={field} className="form-field">
        <label htmlFor={`group-${field}`}>{text.fields[field]}</label>
        <input id={`group-${field}`} name={field} required type="text" minLength={2} maxLength={field === "name" ? 120 : 80} autoComplete="off"
          placeholder={field === "name" ? text.form.namePlaceholder : text.form.speciesPlaceholder} value={values[field]}
          onChange={(event) => setValues({ ...values, [field]: event.target.value })} aria-invalid={Boolean(state.errors?.[field])} aria-describedby={describe(field)} />{error(field)}
      </div>)}
      <div className="form-field">
        <label htmlFor="group-openingCount">{text.fields.openingCount}</label>
        <input id="group-openingCount" name="openingCount" required type="text" inputMode="numeric" value={values.openingCount}
          onChange={(event) => setValues({ ...values, openingCount: event.target.value })} aria-invalid={Boolean(state.errors?.openingCount)} aria-describedby={describe("openingCount", "group-opening-hint")} />
        <span className="field-hint" id="group-opening-hint">{text.form.openingHint}</span>{error("openingCount")}
      </div>
      <div className="form-field">
        <label htmlFor="group-isActive">{text.fields.isActive}</label>
        <select id="group-isActive" name="isActive" required value={values.isActive} onChange={(event) => setValues({ ...values, isActive: event.target.value })}
          aria-invalid={Boolean(state.errors?.isActive)} aria-describedby={describe("isActive")}>
          <option value="true">{text.active}</option><option value="false">{text.inactive}</option>
        </select>{error("isActive")}
      </div>
      <div className="form-field livestock-full-width">
        <label htmlFor="group-activityId">{text.fields.activityId}</label>
        <select id="group-activityId" name="activityId" required value={values.activityId} onChange={(event) => setValues({ ...values, activityId: event.target.value })}
          aria-invalid={Boolean(state.errors?.activityId)} aria-describedby={describe("activityId", "group-activity-hint")}>
          <option value="" disabled>{text.form.selectActivity}</option>
          {options.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}{activity.is_active ? "" : ` (${text.inactive})`}</option>)}
        </select>
        <span className="field-hint" id="group-activity-hint">{text.form.activityHint}</span>{error("activityId")}
      </div>
    </fieldset>
    {!options.length ? <p className="form-message">{text.form.noActivities} <Link href={`/${locale}/app/activities`}>{text.form.createActivity}</Link></p> : null}
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
    <div className="form-actions"><button type="submit" className="button button-primary" disabled={pending || !options.length}>{pending ? text.form.saving : initialValues ? text.form.save : text.form.create}</button>
      <Link className="button button-secondary" href={cancelHref}>{text.form.cancel}</Link></div>
  </form>;
}
