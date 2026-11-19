"use client";

import { useActionState, useState } from "react";

import { deletePlot } from "@/app/[locale]/(protected)/app/plots/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type DeletePlotControlProps = {
  locale: Locale;
  plotId: string;
  plotName: string;
};

const initialState = { message: null };

export function DeletePlotControl({
  locale,
  plotId,
  plotName,
}: DeletePlotControlProps) {
  const dictionary = getDictionary(locale).plots.delete;
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteAction = deletePlot.bind(null, plotId);
  const [state, formAction, pending] = useActionState(deleteAction, initialState);

  if (!isConfirming) {
    return (
      <button
        className="button button-danger"
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        {dictionary.action}
      </button>
    );
  }

  return (
    <div className="delete-confirmation" role="alert">
      <strong>{dictionary.title}</strong>
      <p>{dictionary.description.replace("{name}", plotName)}</p>
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
          onClick={() => setIsConfirming(false)}
          type="button"
        >
          {dictionary.cancel}
        </button>
      </div>
    </div>
  );
}
