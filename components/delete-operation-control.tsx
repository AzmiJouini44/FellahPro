"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteOperation } from "@/app/[locale]/(protected)/app/operations/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function DeleteOperationControl({
  locale,
  id,
}: {
  locale: Locale;
  id: string;
}) {
  const text = getDictionary(locale).operations.delete;
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    deleteOperation.bind(null, id),
    { message: null },
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const previous = useRef(false);
  useEffect(() => {
    if (confirming) confirm.current?.focus();
    else if (previous.current) trigger.current?.focus();
    previous.current = confirming;
  }, [confirming]);
  if (!confirming)
    return (
      <button
        className="button button-danger"
        type="button"
        ref={trigger}
        onClick={() => setConfirming(true)}
      >
        {text.action}
      </button>
    );
  return (
    <div
      className="delete-confirmation"
      role="group"
      aria-labelledby="operation-delete-title"
      aria-describedby="operation-delete-description"
    >
      <strong id="operation-delete-title">{text.title}</strong>
      <p id="operation-delete-description">{text.description}</p>
      {state.message ? (
        <p className="form-message error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="delete-confirmation-actions">
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <button
            ref={confirm}
            type="submit"
            className="button button-danger"
            disabled={pending}
          >
            {pending ? text.pending : text.confirm}
          </button>
        </form>
        <button
          className="button button-secondary"
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {text.cancel}
        </button>
      </div>
    </div>
  );
}
