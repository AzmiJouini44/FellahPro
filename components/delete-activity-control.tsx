"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteActivity } from "@/app/[locale]/(protected)/app/activities/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function DeleteActivityControl({ locale, id, name }: { locale: Locale; id: string; name: string }) {
  const text = getDictionary(locale).activities.delete;
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteActivity.bind(null, id), { message: null });
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) confirm.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  if (!confirming) return <button ref={trigger} type="button" className="button button-danger" onClick={() => setConfirming(true)}>{text.action}</button>;
  return <div className="delete-confirmation" role="group" aria-labelledby="activity-delete-title" aria-describedby="activity-delete-description">
    <strong id="activity-delete-title">{text.title}</strong>
    <p id="activity-delete-description">{text.description.replace("{name}", name)}</p>
    <p>{text.hint}</p>
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
    <div className="delete-confirmation-actions">
      <form action={action}>
        <input type="hidden" name="locale" value={locale} />
        <button ref={confirm} type="submit" className="button button-danger" disabled={pending}>{pending ? text.deleting : text.confirm}</button>
      </form>
      <button type="button" className="button button-secondary" disabled={pending} onClick={() => setConfirming(false)}>{text.cancel}</button>
    </div>
  </div>;
}
