import assert from "node:assert/strict";
import test from "node:test";

import { getMissingWorkspaceRedirect } from "../lib/workspace-routing";

test("a profile without a farm membership is sent to onboarding", () => {
  assert.equal(getMissingWorkspaceRedirect("fr", true, false), "/fr/onboarding");
  assert.equal(getMissingWorkspaceRedirect("ar", true, false), "/ar/onboarding");
});

test("a complete member workspace stays in the authenticated application", () => {
  assert.equal(getMissingWorkspaceRedirect("fr", true, true), null);
});
