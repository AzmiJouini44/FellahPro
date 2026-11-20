import assert from "node:assert/strict";
import test from "node:test";
import { livestockDictionaries } from "../i18n/livestock-dictionaries";
import { animalEventKinds } from "../lib/livestock-validation";
function keys(value: object, path = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === "string"
    ? (assert.ok(child.trim()), [path + key]) : keys(child, path + key + "."));
}
test("French and Arabic livestock labels cover the same nonempty forms, errors, history and event kinds", () => {
  assert.deepEqual(keys(livestockDictionaries.fr).sort(), keys(livestockDictionaries.ar).sort());
  for (const language of ["fr", "ar"] as const) for (const kind of animalEventKinds) assert.ok(livestockDictionaries[language].events.kinds[kind]);
  assert.match(livestockDictionaries.ar.title, /[\u0600-\u06ff]/);
});
