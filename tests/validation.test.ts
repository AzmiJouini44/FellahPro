import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanText,
  isValidEmail,
  isValidFarmName,
  isValidPassword,
  isValidPersonName,
} from "../lib/validation";

test("cleanText trims and collapses repeated whitespace", () => {
  assert.equal(cleanText("  Ferme   du   Nord  "), "Ferme du Nord");
});

test("email validation accepts ordinary addresses and rejects malformed input", () => {
  assert.equal(isValidEmail("owner@example.com"), true);
  assert.equal(isValidEmail("owner@"), false);
  assert.equal(isValidEmail(""), false);
});

test("password validation enforces the authentication minimum", () => {
  assert.equal(isValidPassword("eight888"), true);
  assert.equal(isValidPassword("short"), false);
});

test("person and farm names accept useful text but reject unsafe lengths", () => {
  assert.equal(isValidPersonName("Amira Ben Salah"), true);
  assert.equal(isValidPersonName("A"), false);
  assert.equal(isValidFarmName("Ferme des Oliviers"), true);
  assert.equal(isValidFarmName(""), false);
  assert.equal(isValidFarmName("x".repeat(121)), false);
});
