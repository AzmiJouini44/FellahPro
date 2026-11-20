import assert from "node:assert/strict";
import test from "node:test";
import { taskDictionaries } from "../i18n/task-dictionaries";
import { getDirection } from "../i18n/config";
import { taskPriorities, taskStatuses, taskViews } from "../lib/task-validation";

function leaves(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => typeof child === "string"
    ? (assert.ok(child.trim().length > 0), [prefix + key])
    : leaves(child, prefix + key + "."));
}

test("French and Arabic task dictionaries cover matching nonempty labels, validation and reminders", () => {
  assert.deepEqual(leaves(taskDictionaries.fr).sort(), leaves(taskDictionaries.ar).sort());
  for (const language of ["fr", "ar"] as const) {
    const text = taskDictionaries[language];
    for (const status of taskStatuses) assert.ok(text.statuses[status]);
    for (const priority of taskPriorities) assert.ok(text.priorities[priority]);
    for (const view of taskViews) assert.ok(text.views[view]);
  }
  assert.equal(getDirection("ar"), "rtl");
  assert.equal(getDirection("fr"), "ltr");
  assert.match(taskDictionaries.ar.title, /[\u0600-\u06ff]/);
});
