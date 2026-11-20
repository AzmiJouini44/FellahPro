"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { OperationActionState } from "@/app/[locale]/(protected)/app/operations/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatTnd, formatUtcDate } from "@/lib/format";
import type {
  OperationDefaults,
  OperationDetail,
  OperationOptions,
} from "@/lib/operation-service";
import {
  operationTypes,
  operationUnits,
  type OperationField,
} from "@/lib/operation-validation";

export function OperationForm({
  locale,
  action,
  options,
  initial,
  defaults,
  today,
  owner,
  cancelHref,
}: {
  locale: Locale;
  action: (
    state: OperationActionState,
    form: FormData,
  ) => Promise<OperationActionState>;
  options: OperationOptions;
  initial?: OperationDetail;
  defaults?: OperationDefaults;
  today: string;
  owner: boolean;
  cancelHref: string;
}) {
  const text = getDictionary(locale).operations;
  const [state, formAction, pending] = useActionState(action, {
    message: null,
  });
  const [values, setValues] = useState({
    operationType: initial?.operation_type ?? "",
    performedOn: initial?.performed_on ?? today,
    plotId: initial?.plot_id ?? defaults?.plotId ?? "",
    cycleId: initial?.crop_cycle_id ?? defaults?.cycleId ?? "",
    activityId: initial?.activity_id ?? defaults?.activityId ?? "",
    taskId: initial?.related_task_id ?? defaults?.taskId ?? "",
    expenseLineId: initial?.expense_line_id ?? "",
    description: initial?.description ?? "",
    notes: initial?.notes ?? "",
    quantity:
      initial?.quantity === null || initial?.quantity === undefined
        ? ""
        : String(initial.quantity),
    unit: initial?.unit ?? "",
  });
  const locked = Boolean(initial?.expense_line_id && !owner);
  function change(field: OperationField, value: string) {
    setValues((previous) => {
      if (field === "plotId")
        return {
          ...previous,
          plotId: value,
          cycleId: "",
          activityId:
            options.plots.find((plot) => plot.id === value)?.activity_id ?? "",
          expenseLineId: "",
        };
      if (field === "cycleId")
        return {
          ...previous,
          cycleId: value,
          activityId: value
            ? (options.cycles.find((cycle) => cycle.id === value)
                ?.activity_id ?? "")
            : (options.plots.find((plot) => plot.id === previous.plotId)
                ?.activity_id ?? ""),
          expenseLineId: "",
        };
      if (field === "activityId")
        return { ...previous, activityId: value, expenseLineId: "" };
      if (field === "expenseLineId")
        return {
          ...previous,
          expenseLineId: value,
          activityId:
            previous.activityId ||
            options.expenses.find((expense) => expense.id === value)
              ?.activity_id ||
            "",
        };
      return { ...previous, [field]: value };
    });
  }
  const error = (field: OperationField) =>
    state.errors?.[field] ? (
      <span className="field-error" id={`operation-${field}-error`}>
        {state.errors[field]}
      </span>
    ) : null;
  const described = (field: OperationField, hint?: string) =>
    [state.errors?.[field] ? `operation-${field}-error` : "", hint]
      .filter(Boolean)
      .join(" ") || undefined;
  const cycles = options.cycles.filter(
    (cycle) => cycle.plot_id === values.plotId,
  );
  const expenses = options.expenses.filter(
    (expense) =>
      (!expense.crop_cycle_id || expense.crop_cycle_id === values.cycleId) &&
      (!values.activityId || expense.activity_id === values.activityId),
  );
  const extraError = (
    [
      "description",
      "notes",
      "quantity",
      "unit",
      "activityId",
      "taskId",
    ] as const
  ).some((field) => state.errors?.[field]);
  const currentExpense = options.expenses.find(
    (expense) => expense.id === values.expenseLineId,
  );
  return (
    <form action={formAction} className="operation-form">
      <input name="locale" type="hidden" value={locale} />
      <fieldset disabled={pending} className="operation-form-fields">
        <div className="form-field operation-full-width">
          <label htmlFor="operation-operationType">
            {text.fields.operationType}
          </label>
          <select
            id="operation-operationType"
            name="operationType"
            required
            value={values.operationType}
            onChange={(event) => change("operationType", event.target.value)}
            aria-invalid={Boolean(state.errors?.operationType)}
            aria-describedby={described("operationType")}
          >
            <option value="" disabled>
              {text.form.chooseType}
            </option>
            {operationTypes.map((type) => (
              <option key={type} value={type}>
                {text.types[type]}
              </option>
            ))}
          </select>
          {error("operationType")}
        </div>
        <div className="form-field">
          <label htmlFor="operation-performedOn">
            {text.fields.performedOn}
          </label>
          <input
            id="operation-performedOn"
            name="performedOn"
            required
            type="date"
            max={today}
            value={values.performedOn}
            onChange={(event) => change("performedOn", event.target.value)}
            aria-invalid={Boolean(state.errors?.performedOn)}
            aria-describedby={described("performedOn", "operation-date-hint")}
          />
          <span className="field-hint" id="operation-date-hint">
            {text.form.dateHint}
          </span>
          {error("performedOn")}
        </div>
        <div className="form-field">
          <label htmlFor="operation-plotId">{text.fields.plotId}</label>
          {locked ? (
            <input type="hidden" name="plotId" value={values.plotId} />
          ) : null}
          <select
            id="operation-plotId"
            name={locked ? undefined : "plotId"}
            required
            value={values.plotId}
            disabled={locked}
            onChange={(event) => change("plotId", event.target.value)}
            aria-invalid={Boolean(state.errors?.plotId)}
            aria-describedby={described("plotId")}
          >
            <option value="" disabled>
              {text.form.choosePlot}
            </option>
            {options.plots.map((plot) => (
              <option key={plot.id} value={plot.id}>
                {plot.name}
              </option>
            ))}
          </select>
          {error("plotId")}
        </div>
        {cycles.length ? (
          <div className="form-field operation-full-width">
            <label htmlFor="operation-cycleId">
              {text.fields.cycleId} ({text.optional})
            </label>
            {locked ? (
              <input type="hidden" name="cycleId" value={values.cycleId} />
            ) : null}
            <select
              id="operation-cycleId"
              name={locked ? undefined : "cycleId"}
              disabled={locked}
              value={values.cycleId}
              onChange={(event) => change("cycleId", event.target.value)}
              aria-invalid={Boolean(state.errors?.cycleId)}
              aria-describedby={described("cycleId", "operation-cycle-hint")}
            >
              <option value="">{text.none}</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.crop_name} — {formatUtcDate(cycle.started_on, locale)}
                </option>
              ))}
            </select>
            <span className="field-hint" id="operation-cycle-hint">
              {text.form.cycleHint}
            </span>
            {error("cycleId")}
          </div>
        ) : (
          <input type="hidden" name="cycleId" value={values.cycleId} />
        )}
        {locked ? (
          <p className="read-only-notice operation-full-width">
            {text.finance.locked}
          </p>
        ) : null}
        <details
          className="operation-optional operation-full-width"
          open={extraError ? true : undefined}
        >
          <summary>{text.form.details}</summary>
          <div className="operation-optional-fields">
            <div className="form-field operation-full-width">
              <label htmlFor="operation-description">
                {text.fields.description}
              </label>
              <input
                id="operation-description"
                name="description"
                maxLength={240}
                value={values.description}
                placeholder={text.form.descriptionPlaceholder}
                onChange={(event) => change("description", event.target.value)}
                aria-invalid={Boolean(state.errors?.description)}
                aria-describedby={described("description")}
              />
              {error("description")}
            </div>
            <div className="form-field">
              <label htmlFor="operation-quantity">{text.fields.quantity}</label>
              <input
                id="operation-quantity"
                name="quantity"
                type="text"
                inputMode="decimal"
                value={values.quantity}
                onChange={(event) => change("quantity", event.target.value)}
                aria-invalid={Boolean(state.errors?.quantity)}
                aria-describedby={described(
                  "quantity",
                  "operation-quantity-hint",
                )}
              />
              {error("quantity")}
            </div>
            <div className="form-field">
              <label htmlFor="operation-unit">{text.fields.unit}</label>
              <select
                id="operation-unit"
                name="unit"
                value={values.unit}
                onChange={(event) => change("unit", event.target.value)}
                aria-invalid={Boolean(state.errors?.unit)}
                aria-describedby={described("unit", "operation-quantity-hint")}
              >
                <option value="">{text.form.chooseUnit}</option>
                {operationUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {text.units[unit]}
                  </option>
                ))}
              </select>
              {error("unit")}
            </div>
            <p
              className="field-hint operation-full-width"
              id="operation-quantity-hint"
            >
              {text.form.quantityHint}
            </p>
            <div className="form-field operation-full-width">
              <label htmlFor="operation-activityId">
                {text.fields.activityId}
              </label>
              {locked ? (
                <input
                  type="hidden"
                  name="activityId"
                  value={values.activityId}
                />
              ) : null}
              <select
                id="operation-activityId"
                name={locked ? undefined : "activityId"}
                disabled={locked}
                value={values.activityId}
                onChange={(event) => change("activityId", event.target.value)}
                aria-invalid={Boolean(state.errors?.activityId)}
                aria-describedby={described(
                  "activityId",
                  "operation-category-hint",
                )}
              >
                <option value="">{text.none}</option>
                {options.activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                    {activity.is_active
                      ? ""
                      : ` (${getDictionary(locale).activities.inactive})`}
                  </option>
                ))}
              </select>
              <span className="field-hint" id="operation-category-hint">
                {text.form.categoryHint}
              </span>
              {error("activityId")}
            </div>
            <div className="form-field operation-full-width">
              <label htmlFor="operation-taskId">{text.fields.taskId}</label>
              <select
                id="operation-taskId"
                name="taskId"
                value={values.taskId}
                onChange={(event) => change("taskId", event.target.value)}
                aria-invalid={Boolean(state.errors?.taskId)}
                aria-describedby={described("taskId", "operation-task-hint")}
              >
                <option value="">{text.none}</option>
                {options.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
              <span className="field-hint" id="operation-task-hint">
                {text.form.taskHint}
              </span>
              {error("taskId")}
            </div>
            <div className="form-field operation-full-width">
              <label htmlFor="operation-notes">{text.fields.notes}</label>
              <textarea
                id="operation-notes"
                name="notes"
                rows={3}
                maxLength={2000}
                value={values.notes}
                onChange={(event) => change("notes", event.target.value)}
                aria-invalid={Boolean(state.errors?.notes)}
                aria-describedby={described("notes", "operation-notes-hint")}
              />
              <span className="field-hint" id="operation-notes-hint">
                {text.form.notesHint}
              </span>
              {error("notes")}
            </div>
          </div>
        </details>
        {owner ? (
          <details
            className="operation-optional operation-full-width"
            open={state.errors?.expenseLineId ? true : undefined}
          >
            <summary>{text.finance.title}</summary>
            <div className="operation-optional-fields">
              <p className="field-hint operation-full-width">
                {text.finance.hint} {text.finance.context}
              </p>
              <div className="form-field operation-full-width">
                <label htmlFor="operation-expenseLineId">
                  {text.fields.expenseLineId}
                </label>
                <select
                  id="operation-expenseLineId"
                  name="expenseLineId"
                  value={values.expenseLineId}
                  onChange={(event) =>
                    change("expenseLineId", event.target.value)
                  }
                  aria-invalid={Boolean(state.errors?.expenseLineId)}
                  aria-describedby={described("expenseLineId")}
                >
                  <option value="">{text.finance.noExpense}</option>
                  {expenses.map((expense) => (
                    <option key={expense.id} value={expense.id}>
                      {expense.description} ·{" "}
                      {formatTnd(Number(expense.amount), locale)} ·{" "}
                      {formatUtcDate(expense.transaction_date, locale)}
                    </option>
                  ))}
                </select>
                {error("expenseLineId")}
              </div>
              {!expenses.length ? (
                <p className="field-hint operation-full-width">
                  {text.finance.noOptions}
                </p>
              ) : null}
              {currentExpense ? (
                <p className="operation-full-width">
                  {text.finance.amount}:{" "}
                  <strong>
                    {formatTnd(Number(currentExpense.amount), locale)}
                  </strong>
                </p>
              ) : null}
              <p className="field-hint operation-full-width">
                {text.finance.noCreation}
              </p>
            </div>
          </details>
        ) : (
          <>
            <input
              type="hidden"
              name="expenseLineId"
              value={values.expenseLineId}
            />
            <p className="field-hint operation-full-width">
              {text.finance.ownerOnly}
              {initial?.expense_amount !== null &&
              initial?.expense_amount !== undefined
                ? ` · ${text.finance.amount}: ${formatTnd(Number(initial.expense_amount), locale)}`
                : ""}
            </p>
          </>
        )}
      </fieldset>
      {!options.plots.length ? (
        <p className="form-message">
          {text.form.noPlots}{" "}
          <Link href={`/${locale}/app/plots`}>{text.form.managePlots}</Link>
        </p>
      ) : null}
      {state.message ? (
        <p className="form-message error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="form-actions">
        <button
          type="submit"
          className="button button-primary"
          disabled={pending || !options.plots.length}
        >
          {pending ? text.form.saving : text.form.save}
        </button>
        <Link className="button button-secondary" href={cancelHref}>
          {text.form.cancel}
        </Link>
      </div>
    </form>
  );
}
