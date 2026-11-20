"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ActivitySelect } from "@/components/activity-select";
import type { ActivityOption } from "@/lib/activity-service";

import type { CropCycleActionState } from "@/app/[locale]/(protected)/app/crop-cycles/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { CropCycleStatus } from "@/lib/crop-cycle-validation";
import type { CropCyclePlot } from "@/lib/crop-cycles";
import { formatAreaHectares } from "@/lib/format";

type CropCycleFormProps = {
  action: (
    state: CropCycleActionState,
    formData: FormData,
  ) => Promise<CropCycleActionState>;
  cancelHref: string;
  locale: Locale;
  mode: "create" | "edit";
  plots: CropCyclePlot[];
  activities: ActivityOption[];
  initialValues?: {
    plotId: string;
    cropName: string;
    plantedOn: string;
    expectedHarvestOn: string;
    actualHarvestOn: string;
    cultivatedAreaHectares: number;
    status: CropCycleStatus;
    notes: string;
    activityId: string | null;
  };
};

const initialState: CropCycleActionState = { message: null };

export function CropCycleForm({
  action,
  cancelHref,
  locale,
  mode,
  plots,
  activities,
  initialValues,
}: CropCycleFormProps) {
  const dictionary = getDictionary(locale).cropCycles;
  const form = dictionary.form;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [status, setStatus] = useState<CropCycleStatus>(
    initialValues?.status ?? "planned",
  );
  const [plotId, setPlotId] = useState(initialValues?.plotId ?? plots[0]?.id ?? "");
  const selectedPlot = useMemo(
    () => plots.find((plot) => plot.id === plotId) ?? null,
    [plotId, plots],
  );

  return (
    <form action={formAction} className="cycle-form">
      <input name="locale" type="hidden" value={locale} />

      <div className="form-field">
        <label htmlFor="cycle-plot">{form.plot}</label>
        <select
          aria-describedby={state.errors?.plotId ? "cycle-plot-error" : "cycle-plot-hint"}
          aria-invalid={state.errors?.plotId ? true : undefined}
          id="cycle-plot"
          name="plotId"
          onChange={(event) => setPlotId(event.target.value)}
          required
          value={plotId}
        >
          <option disabled value="">{form.selectPlot}</option>
          {plots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name} — {formatAreaHectares(plot.area_hectares, locale)} {form.hectares}
            </option>
          ))}
        </select>
        <span className="field-hint" id="cycle-plot-hint">
          {selectedPlot
            ? form.plotAreaHint.replace(
                "{area}",
                formatAreaHectares(selectedPlot.area_hectares, locale),
              )
            : form.plotHint}
        </span>
        {state.errors?.plotId ? (
          <span className="field-error" id="cycle-plot-error">{state.errors.plotId}</span>
        ) : null}
      </div>

      <ActivitySelect locale={locale} activities={activities} mode={mode} inheritFromPlot
        initialActivityId={initialValues?.activityId} error={state.errors?.activityId} />

      <div className="form-field">
        <label htmlFor="cycle-crop">{form.cropName}</label>
        <input
          aria-describedby={state.errors?.cropName ? "cycle-crop-error" : undefined}
          aria-invalid={state.errors?.cropName ? true : undefined}
          autoComplete="off"
          defaultValue={initialValues?.cropName ?? ""}
          id="cycle-crop"
          maxLength={120}
          minLength={2}
          name="cropName"
          placeholder={form.cropPlaceholder}
          required
          type="text"
        />
        {state.errors?.cropName ? (
          <span className="field-error" id="cycle-crop-error">{state.errors.cropName}</span>
        ) : null}
      </div>

      <div className="cycle-form-grid">
        <div className="form-field">
          <label htmlFor="cycle-planted">{form.plantedOn}</label>
          <input
            aria-describedby={state.errors?.plantedOn ? "cycle-planted-error" : undefined}
            aria-invalid={state.errors?.plantedOn ? true : undefined}
            defaultValue={initialValues?.plantedOn ?? ""}
            id="cycle-planted"
            name="plantedOn"
            required
            type="date"
          />
          {state.errors?.plantedOn ? (
            <span className="field-error" id="cycle-planted-error">{state.errors.plantedOn}</span>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor="cycle-expected">{form.expectedHarvestOn}</label>
          <input
            aria-describedby={state.errors?.expectedHarvestOn ? "cycle-expected-error" : undefined}
            aria-invalid={state.errors?.expectedHarvestOn ? true : undefined}
            defaultValue={initialValues?.expectedHarvestOn ?? ""}
            id="cycle-expected"
            name="expectedHarvestOn"
            required
            type="date"
          />
          {state.errors?.expectedHarvestOn ? (
            <span className="field-error" id="cycle-expected-error">{state.errors.expectedHarvestOn}</span>
          ) : null}
        </div>
      </div>

      <div className="cycle-form-grid">
        <div className="form-field">
          <label htmlFor="cycle-status">{form.status}</label>
          <select
            aria-describedby={state.errors?.status ? "cycle-status-error" : undefined}
            aria-invalid={state.errors?.status ? true : undefined}
            id="cycle-status"
            name="status"
            onChange={(event) => setStatus(event.target.value as CropCycleStatus)}
            value={status}
          >
            <option value="planned">{dictionary.statuses.planned}</option>
            <option value="active">{dictionary.statuses.active}</option>
            <option value="completed">{dictionary.statuses.completed}</option>
            <option value="cancelled">{dictionary.statuses.cancelled}</option>
          </select>
          {state.errors?.status ? (
            <span className="field-error" id="cycle-status-error">{state.errors.status}</span>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor="cycle-actual">
            {form.actualHarvestOn} <span className="optional-label">{form.whenCompleted}</span>
          </label>
          <input
            aria-describedby={state.errors?.actualHarvestOn ? "cycle-actual-error" : undefined}
            aria-invalid={state.errors?.actualHarvestOn ? true : undefined}
            defaultValue={initialValues?.actualHarvestOn ?? ""}
            disabled={status !== "completed"}
            id="cycle-actual"
            name="actualHarvestOn"
            required={status === "completed"}
            type="date"
          />
          {state.errors?.actualHarvestOn ? (
            <span className="field-error" id="cycle-actual-error">{state.errors.actualHarvestOn}</span>
          ) : null}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="cycle-area">{form.cultivatedArea}</label>
        <div className="input-with-suffix">
          <input
            aria-describedby={state.errors?.cultivatedAreaHectares ? "cycle-area-error" : undefined}
            aria-invalid={state.errors?.cultivatedAreaHectares ? true : undefined}
            defaultValue={
              initialValues?.plotId === plotId
                ? initialValues.cultivatedAreaHectares
                : selectedPlot?.area_hectares ?? 0
            }
            dir="ltr"
            id="cycle-area"
            inputMode="decimal"
            name="cultivatedAreaHectares"
            key={plotId}
            required
            type="text"
          />
          <span>{form.hectares}</span>
        </div>
        {state.errors?.cultivatedAreaHectares ? (
          <span className="field-error" id="cycle-area-error">
            {state.errors.cultivatedAreaHectares}
          </span>
        ) : null}
      </div>

      <div className="form-field">
        <label htmlFor="cycle-notes">
          {form.notes} <span className="optional-label">{form.optional}</span>
        </label>
        <textarea
          aria-describedby={state.errors?.notes ? "cycle-notes-error" : "cycle-notes-hint"}
          aria-invalid={state.errors?.notes ? true : undefined}
          defaultValue={initialValues?.notes ?? ""}
          id="cycle-notes"
          maxLength={2000}
          name="notes"
          placeholder={form.notesPlaceholder}
          rows={5}
        />
        <span className="field-hint" id="cycle-notes-hint">{form.notesHint}</span>
        {state.errors?.notes ? (
          <span className="field-error" id="cycle-notes-error">{state.errors.notes}</span>
        ) : null}
      </div>

      {state.message ? <p className="form-message error" role="alert">{state.message}</p> : null}

      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending
            ? mode === "create" ? form.creating : form.saving
            : mode === "create" ? form.create : form.save}
        </button>
        <Link className="button button-secondary" href={cancelHref}>{form.cancel}</Link>
      </div>
    </form>
  );
}
