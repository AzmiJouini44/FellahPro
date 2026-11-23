import assert from "node:assert/strict";
import test from "node:test";
import { livestockDictionaries } from "../i18n/livestock-dictionaries";
import { animalEventKinds } from "../lib/livestock-validation";
import { locales } from "../i18n/config";
function keys(value: object, path = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === "string"
    ? (assert.ok(child.trim()), [path + key]) : keys(child, path + key + "."));
}
test("all livestock locales cover nonempty forms, errors, history and event kinds", () => {
  assert.deepEqual(keys(livestockDictionaries.fr).sort(), keys(livestockDictionaries.ar).sort());
  for (const language of locales) {
    assert.deepEqual(keys(livestockDictionaries.fr).sort(), keys(livestockDictionaries[language]).sort());
    for (const kind of animalEventKinds) assert.ok(livestockDictionaries[language].events.kinds[kind]);
  }
  assert.match(livestockDictionaries.ar.title, /[\u0600-\u06ff]/);
});
