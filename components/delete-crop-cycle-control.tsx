"use client";

import { useActionState, useState } from "react";

import { deleteCropCycle } from "@/app/[locale]/(protected)/app/crop-cycles/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function DeleteCropCycleControl({
  locale,
  cycleId,
  cropName,
}: {
  locale: Locale;
  cycleId: string;
  cropName: string;
}) {
  const dictionary = getDictionary(locale).cropCycles.delete;
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    deleteCropCycle.bind(null, cycleId),
    { message: null },
  );

  if (!confirming) {
    return (
      <button className="button button-danger" onClick={() => setConfirming(true)} type="button">
        {dictionary.action}
      </button>
    );
  }

  return (
    <div className="delete-confirmation" role="alert">
      <strong>{dictionary.title}</strong>
      <p>{dictionary.description.replace("{crop}", cropName)}</p>
      {state.message ? <p className="form-message error">{state.message}</p> : null}
      <div className="delete-confirmation-actions">
        <form action={formAction}>
          <input name="locale" type="hidden" value={locale} />
          <button className="button button-danger" disabled={pending} type="submit">
            {pending ? dictionary.deleting : dictionary.confirm}
          </button>
        </form>
        <button
          className="button button-secondary"
          disabled={pending}
          onClick={() => setConfirming(false)}
          type="button"
        >
          {dictionary.cancel}
        </button>
      </div>
    </div>
  );
}
