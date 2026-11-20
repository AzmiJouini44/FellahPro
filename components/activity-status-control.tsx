"use client";

import { useActionState } from "react";
import { setActivityActive } from "@/app/[locale]/(protected)/app/activities/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function ActivityStatusControl({ locale, id, active }: { locale: Locale; id: string; active: boolean }) {
  const text = getDictionary(locale).activities;
  const [state, action, pending] = useActionState(setActivityActive.bind(null, id), { message: null });
  return <form action={action} className="activity-status-control">
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="isActive" value={String(!active)} />
    <button type="submit" className="button button-secondary" disabled={pending}>
      {pending ? text.details.changing : active ? text.details.deactivate : text.details.reactivate}
    </button>
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
  </form>;
}
