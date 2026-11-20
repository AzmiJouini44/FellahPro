import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAreaHectares,
  formatDate,
  formatTnd,
  getNumberLocale,
  formatCount,
  formatUtcDate,
} from "../lib/format";

test("number formatting follows the selected application locale", () => {
  assert.equal(getNumberLocale("fr"), "fr-TN");
  assert.equal(getNumberLocale("ar"), "ar-TN");
});

test("TND formatting uses three fractional digits", () => {
  const french = formatTnd(12.5, "fr");
  const arabic = formatTnd(12.5, "ar");

  assert.match(french, /12,500/);
  assert.match(french, /(DT|TND)/);
  assert.ok(arabic.length > 0);
  assert.notEqual(arabic, french);
});

test("plot areas and dates follow the selected Tunisian locale", () => {
  assert.equal(formatAreaHectares(12.375, "fr"), "12,375");
  assert.match(formatAreaHectares(12.375, "ar"), /12[,.]375|١٢[٫,]٣٧٥/);
  assert.ok(formatDate("2026-11-19T00:00:00.000Z", "fr").length > 0);
});

test("activity counts are localized and audit-date display stays on the UTC filter day", () => {
  assert.ok(formatCount(1234, "ar").length > 0);
  assert.ok(formatCount(1234, "fr").length > 0);
  for (const locale of ["fr", "ar"] as const) {
    assert.equal(formatUtcDate("2026-01-01T23:30:00Z", locale), formatUtcDate("2026-01-01T00:00:00Z", locale));
  }
});
