import assert from "node:assert/strict";
import test from "node:test";
import { operationDictionaries } from "../i18n/operation-dictionaries";
import { operationTypes, operationUnits } from "../lib/operation-validation";
import { locales } from "../i18n/config";
function keys(value: object, path = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "string"
      ? (assert.ok(child.trim()), [path + key])
      : keys(child, path + key + "."),
  );
}
test("all operation locales cover every operation, unit, error and financial explanation", () => {
  assert.deepEqual(
    keys(operationDictionaries.fr).sort(),
    keys(operationDictionaries.ar).sort(),
  );
  for (const locale of locales) {
    assert.deepEqual(keys(operationDictionaries.fr).sort(), keys(operationDictionaries[locale]).sort());
    for (const type of operationTypes)
      assert.ok(operationDictionaries[locale].types[type]);
    for (const unit of operationUnits)
      assert.ok(operationDictionaries[locale].units[unit]);
  }
  assert.match(operationDictionaries.ar.title, /[\u0600-\u06ff]/);
});
