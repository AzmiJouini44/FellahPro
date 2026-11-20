"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteAnimalGroup } from "@/app/[locale]/(protected)/app/livestock/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function DeleteAnimalGroupControl({ locale, id, name }: { locale: Locale; id: string; name: string }) {
  const text = getDictionary(locale).livestock.delete;
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(deleteAnimalGroup.bind(null, id), { message: null });
  const trigger = useRef<HTMLButtonElement>(null); const confirm = useRef<HTMLButtonElement>(null); const previous = useRef(false);
  useEffect(() => {
    if (confirming) confirm.current?.focus(); else if (previous.current) trigger.current?.focus();
    previous.current = confirming;
  }, [confirming]);
  if (!confirming) return <button ref={trigger} className="button button-danger" type="button" onClick={() => setConfirming(true)}>{text.action}</button>;
  return <div className="delete-confirmation" role="group" aria-labelledby="animal-delete-title" aria-describedby="animal-delete-description">
    <strong id="animal-delete-title">{text.title}</strong><p id="animal-delete-description">{text.description.replace("{name}", name)}</p><p>{text.hint}</p>
    {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}
    <div className="delete-confirmation-actions"><form action={action}><input type="hidden" name="locale" value={locale} />
      <button ref={confirm} className="button button-danger" type="submit" disabled={pending}>{pending ? text.pending : text.confirm}</button></form>
      <button type="button" className="button button-secondary" disabled={pending} onClick={() => setConfirming(false)}>{text.cancel}</button></div>
  </div>;
}
