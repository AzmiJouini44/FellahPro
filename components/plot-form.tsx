"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PlotActionState } from "@/app/[locale]/(protected)/app/plots/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

type PlotFormProps = {
  action: (
    state: PlotActionState,
    formData: FormData,
  ) => Promise<PlotActionState>;
  locale: Locale;
  mode: "create" | "edit";
  initialValues?: {
    name: string;
    areaHectares: number;
    notes: string;
  };
  cancelHref: string;
};

const initialState: PlotActionState = { message: null };

export function PlotForm({
  action,
  locale,
  mode,
  initialValues,
  cancelHref,
}: PlotFormProps) {
  const dictionary = getDictionary(locale);
  const [state, formAction, pending] = useActionState(action, initialState);
  const form = dictionary.plots.form;

  return (
    <form action={formAction} className="plot-form">
      <input name="locale" type="hidden" value={locale} />
      <div className="form-field">
        <label htmlFor="plot-name">{form.name}</label>
        <input
          aria-describedby={state.errors?.name ? "plot-name-error" : undefined}
          aria-invalid={state.errors?.name ? true : undefined}
          autoComplete="off"
          defaultValue={initialValues?.name ?? ""}
          id="plot-name"
          maxLength={120}
          minLength={2}
          name="name"
          placeholder={form.namePlaceholder}
          required
          type="text"
        />
        {state.errors?.name ? (
          <span className="field-error" id="plot-name-error">
            {state.errors.name}
          </span>
        ) : null}
      </div>

      <div className="form-field">
        <label htmlFor="plot-area">{form.area}</label>
        <div className="input-with-suffix">
          <input
            aria-describedby={state.errors?.areaHectares ? "plot-area-error" : undefined}
            aria-invalid={state.errors?.areaHectares ? true : undefined}
            defaultValue={initialValues?.areaHectares ?? 0}
            dir="ltr"
            id="plot-area"
            inputMode="decimal"
            name="areaHectares"
            required
            type="text"
          />
          <span>{form.hectares}</span>
        </div>
        {state.errors?.areaHectares ? (
          <span className="field-error" id="plot-area-error">
            {state.errors.areaHectares}
          </span>
        ) : null}
      </div>

      <div className="form-field">
        <label htmlFor="plot-notes">
          {form.notes} <span className="optional-label">{form.optional}</span>
        </label>
        <textarea
          aria-describedby={state.errors?.notes ? "plot-notes-error" : "plot-notes-hint"}
          aria-invalid={state.errors?.notes ? true : undefined}
          defaultValue={initialValues?.notes ?? ""}
          id="plot-notes"
          maxLength={2000}
          name="notes"
          placeholder={form.notesPlaceholder}
          rows={5}
        />
        <span className="field-hint" id="plot-notes-hint">
          {form.notesHint}
        </span>
        {state.errors?.notes ? (
          <span className="field-error" id="plot-notes-error">
            {state.errors.notes}
          </span>
        ) : null}
      </div>

      {state.message ? (
        <p className="form-message error" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending
            ? mode === "create"
              ? form.creating
              : form.saving
            : mode === "create"
              ? form.create
              : form.save}
        </button>
        <Link className="button button-secondary" href={cancelHref}>
          {form.cancel}
        </Link>
      </div>
    </form>
  );
}
