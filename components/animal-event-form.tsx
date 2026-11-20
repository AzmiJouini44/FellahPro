"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { LivestockActionState } from "@/app/[locale]/(protected)/app/livestock/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { animalEventKinds } from "@/lib/livestock-validation";

export function AnimalEventForm({ locale, action, today, cancelHref }: {
  locale: Locale; action: (state: LivestockActionState, form: FormData) => Promise<LivestockActionState>; today: string; cancelHref: string;
}) {
  const text = getDictionary(locale).livestock;
  const [state, formAction, pending] = useActionState(action, { message: null });
  const [values, setValues] = useState({ kind: "naissance", eventDate: today, quantity: "1", notes: "" });
  return <form action={formAction} className="livestock-form">
    <input name="locale" type="hidden" value={locale} />
    <p className="field-hint">{text.form.historyHint}</p>
    <fieldset disabled={pending} className="livestock-form-fields">
      <div className="form-field livestock-full-width"><label htmlFor="animal-event-kind">{text.fields.kind}</label>
        <select id="animal-event-kind" name="kind" required value={values.kind} onChange={(event) => setValues({ ...values, kind: event.target.value })}
          aria-invalid={Boolean(state.errors?.kind)} aria-describedby={state.errors?.kind ? "animal-event-kind-error" : undefined}>
          {animalEventKinds.map((kind) => <option key={kind} value={kind}>{text.events.kinds[kind]}</option>)}
        </select>{state.errors?.kind ? <span className="field-error" id="animal-event-kind-error">{state.errors.kind}</span> : null}
      </div>
      <div className="form-field"><label htmlFor="animal-event-date">{text.fields.eventDate}</label>
        <input id="animal-event-date" name="eventDate" type="date" required max={today} value={values.eventDate} onChange={(event) => setValues({ ...values, eventDate: event.target.value })}
          aria-invalid={Boolean(state.errors?.eventDate)} aria-describedby={`animal-event-date-hint${state.errors?.eventDate ? " animal-event-date-error" : ""}`} />
        <span className="field-hint" id="animal-event-date-hint">{text.form.dateHint}</span>
        {state.errors?.eventDate ? <span className="field-error" id="animal-event-date-error">{state.errors.eventDate}</span> : null}
      </div>
      <div className="form-field"><label htmlFor="animal-event-quantity">{text.fields.quantity}</label>
        <input id="animal-event-quantity" name="quantity" type="text" inputMode="numeric" required value={values.quantity} onChange={(event) => setValues({ ...values, quantity: event.target.value })}
          aria-invalid={Boolean(state.errors?.quantity)} aria-describedby={`animal-event-quantity-hint${state.errors?.quantity ? " animal-event-quantity-error" : ""}`} />
        <span className="field-hint" id="animal-event-quantity-hint">{text.form.quantityHint}</span>
        {state.errors?.quantity ? <span className="field-error" id="animal-event-quantity-error">{state.errors.quantity}</span> : null}
      </div>
      <p className="field-hint livestock-full-width">{text.form.neutralHint}</p>
      <div className="form-field livestock-full-width"><label htmlFor="animal-event-notes">{text.fields.notes}</label>
        <textarea id="animal-event-notes" name="notes" rows={4} maxLength={2000} value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })}
          aria-invalid={Boolean(state.errors?.notes)} aria-describedby={`animal-event-notes-hint${state.errors?.notes ? " animal-event-notes-error" : ""}`} />
        <span className="field-hint" id="animal-event-notes-hint">{text.form.notesHint}</span>
        {state.errors?.notes ? <span className="field-error" id="animal-event-notes-error">{state.errors.notes}</span> : null}
      </div>
    </fieldset>
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
    <div className="form-actions"><button type="submit" className="button button-primary" disabled={pending}>{pending ? text.form.recording : text.form.record}</button>
      <Link className="button button-secondary" href={cancelHref}>{text.form.cancel}</Link></div>
  </form>;
}
