"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { formatUtcDate } from "@/lib/format";
import type { OperationOptions } from "@/lib/operation-service";
import {
  operationTypes,
  type OperationFilters as Filters,
} from "@/lib/operation-validation";

export function OperationFilters({
  locale,
  locations,
  filters,
}: {
  locale: Locale;
  locations: Pick<OperationOptions, "plots" | "cycles">;
  filters: Filters | null;
}) {
  const text = getDictionary(locale).operations;
  const [plot, setPlot] = useState(filters?.plotId ?? "");
  const [cycle, setCycle] = useState(filters?.cycleId ?? "");
  return (
    <form method="get" className="operation-filters">
      {filters?.taskId ? (
        <input type="hidden" name="taskId" value={filters.taskId} />
      ) : null}
      <div className="form-field operation-search">
        <label htmlFor="op-search">{text.filters.search}</label>
        <input
          id="op-search"
          name="search"
          type="search"
          maxLength={120}
          placeholder={text.filters.placeholder}
          defaultValue={filters?.search ?? ""}
        />
      </div>
      <div className="form-field">
        <label htmlFor="op-type-filter">{text.filters.type}</label>
        <select
          id="op-type-filter"
          name="type"
          defaultValue={filters?.type ?? ""}
        >
          <option value="">{text.all}</option>
          {operationTypes.map((type) => (
            <option key={type} value={type}>
              {text.types[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="op-plot-filter">{text.filters.plot}</label>
        <select
          id="op-plot-filter"
          name="plotId"
          value={plot}
          onChange={(event) => {
            setPlot(event.target.value);
            setCycle("");
          }}
        >
          <option value="">{text.all}</option>
          {locations.plots.map((plot) => (
            <option key={plot.id} value={plot.id}>
              {plot.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="op-cycle-filter">{text.filters.cycle}</label>
        <select
          id="op-cycle-filter"
          name="cycleId"
          value={cycle}
          onChange={(event) => setCycle(event.target.value)}
        >
          <option value="">{text.all}</option>
          {locations.cycles
            .filter((cycle) => !plot || cycle.plot_id === plot)
            .map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.crop_name} — {formatUtcDate(cycle.started_on, locale)}
              </option>
            ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="op-from">{text.filters.from}</label>
        <input
          id="op-from"
          type="date"
          name="from"
          defaultValue={filters?.from ?? ""}
        />
      </div>
      <div className="form-field">
        <label htmlFor="op-to">{text.filters.to}</label>
        <input
          id="op-to"
          type="date"
          name="to"
          defaultValue={filters?.to ?? ""}
        />
      </div>
      <div className="form-actions operation-full-width">
        <button className="button button-primary" type="submit">
          {text.filters.apply}
        </button>
        <Link
          className="button button-secondary"
          href={`/${locale}/app/operations`}
        >
          {text.filters.clear}
        </Link>
      </div>
    </form>
  );
}
