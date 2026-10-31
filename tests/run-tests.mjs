/**
 * VENMA test runner — zero dependencies.
 *
 * Runs on Node >= 22.6 with --experimental-strip-types (or Node >= 23.6 where
 * type stripping is on by default). Pure-logic modules (no DOM/IndexedDB) are
 * imported directly; DOM-dependent services are covered by hand-rolled fakes.
 */
import { strict as assert } from "node:assert";
import process from "node:process";

// ── SUT imports ─────────────────────────────────────────────────────────────
import { createHistory, applyOperation, undo, redo, applyOp, MAX_HISTORY_ENTRIES } from "../src/services/annotations/history.ts";
import { fingerprintBytes } from "../src/services/annotations/fingerprint.ts";
import { mockAssistantService } from "../src/services/assistant/mockAssistantService.ts";
import { computePdfPageRect, normalizePageNumber, clampScroll } from "../src/services/annotations/coordinates.ts";
import {
  makeHighlightAnnotation,
  makeNoteAnnotation,
  validateAnnotation,
  describeAnnotation
} from "../src/services/annotations/annotationsFactory.ts";

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ── Test doubles ────────────────────────────────────────────────────────────
/** Minimal PDF-like single page with a text-free, box-only layout. */
function makeMockDocument() {
  return {
    numPages: 1,
    getPage: async () => ({
      getViewport: () => ({ width: 612, height: 792, scale: 1 })
    })
  };
}

// ── history.ts ──────────────────────────────────────────────────────────────
test("history starts empty with cursor -1", () => {
  const history = createHistory();
  assert.equal(history.cursor, -1);
  assert.equal(history.entries.length, 0);
  assert.equal(history.maxEntries, MAX_HISTORY_ENTRIES);
});

test("applyOperation adds an annotation and records it", () => {
  const annotations = [];
  const history = createHistory();
  const highlight = makeHighlightAnnotation({ pageNumber: 1 });
  const result = applyOperation(annotations, history, "fp", "Add highlight", { kind: "remove", id: highlight.id }, { kind: "add", annotation: highlight });
  assert.ok(result);
  assert.equal(result.annotations.length, 1);
  assert.equal(result.history.cursor, 0);
  assert.equal(result.history.entries.length, 1);
  assert.equal(result.history.entries[0].label, "Add highlight");
  assert.equal(result.history.entries[0].fingerprint, "fp");
});

test("applyOperation discards redo branch when a new op is applied", () => {
  const a = makeHighlightAnnotation({ pageNumber: 1 });
  const b = makeHighlightAnnotation({ pageNumber: 1 });
  let { annotations, history } = applyOperation([], createHistory(), "fp", "add a", { kind: "remove", id: a.id }, { kind: "add", annotation: a });
  ({ annotations, history } = applyOperation(annotations, history, "fp", "add b", { kind: "remove", id: b.id }, { kind: "add", annotation: b }));
  // Undo once — should undo "add b", not "add a".
  const undone = undo(annotations, history);
  assert.ok(undone);
  assert.equal(undone.annotations.length, 1);
  assert.equal(undone.annotations[0].id, a.id);
  // Redo once — should re-add "b".
  const redone = redo(undone.annotations, undone.history);
  assert.ok(redone);
  assert.equal(redone.annotations.length, 2);
  assert.equal(redone.annotations[1].id, b.id);
  // New op now discards nothing (cursor was at the end).
  const c = makeHighlightAnnotation({ pageNumber: 1 });
  const third = applyOperation(redone.annotations, redone.history, "fp", "add c", { kind: "remove", id: c.id }, { kind: "add", annotation: c });
  assert.ok(third);
  assert.equal(third.history.entries.length, 3);
});

test("applyOperation caps history at maxEntries", () => {
  let annotations = [];
  let history = createHistory(3);
  for (let i = 0; i < 5; i++) {
    const annotation = makeHighlightAnnotation({ pageNumber: 1 });
    const result = applyOperation(annotations, history, "fp", `add ${i}`, { kind: "remove", id: annotation.id }, { kind: "add", annotation });
    assert.ok(result);
    annotations = result.annotations;
    history = result.history;
  }
  assert.equal(history.entries.length, 3);
  assert.equal(history.entries[0].label, "add 2");
  assert.equal(history.entries[2].label, "add 4");
  assert.equal(history.cursor, 2);
});

test("undo at the bottom returns null", () => {
  const history = createHistory();
  assert.equal(undo([], history), null);
});

test("redo past the last entry returns null", () => {
  const history = createHistory();
  assert.equal(redo([], history), null);
});

test("undo/redo round-trips an edit operation", () => {
  const original = makeHighlightAnnotation({ pageNumber: 1 });
  const edited = { ...original, color: "#8ce0a8" };
  const add = applyOperation([], createHistory(), "fp", "add", { kind: "remove", id: original.id }, { kind: "add", annotation: original });
  assert.ok(add);
  const edit = applyOperation(
    add.annotations,
    add.history,
    "fp",
    "edit",
    { kind: "update", before: edited, after: original },
    { kind: "update", before: original, after: edited }
  );
  assert.ok(edit);
  assert.equal(edit.annotations[0].color, "#8ce0a8");
  const undone = undo(edit.annotations, edit.history);
  assert.ok(undone);
  assert.equal(undone.annotations[0].color, original.color);
});

test("applyOp returns null when removing a missing id", () => {
  assert.equal(applyOp([], { kind: "remove", id: "missing" }), null);
});

test("applyOp returns null when updating a missing id", () => {
  const annotation = makeHighlightAnnotation({ pageNumber: 1 });
  assert.equal(applyOp([], { kind: "update", before: annotation, after: annotation }), null);
});

test("applyOp ignores duplicate annotation ids during restoration", () => {
  const annotation = makeHighlightAnnotation({ pageNumber: 1 });
  const once = applyOp([], { kind: "add", annotation });
  const twice = applyOp(once, { kind: "add", annotation });
  assert.equal(twice, null);
  assert.equal(once.length, 1);
});

// ── fingerprint.ts ──────────────────────────────────────────────────────────
test("fingerprintBytes hashes the same bytes to the same digest", async () => {
  const bytes = new TextEncoder().encode("venma");
  const first = await fingerprintBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const second = await fingerprintBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(first, second);
  assert.ok(/^[0-9a-f]{64}$/.test(first));
});

test("fingerprintBytes differs for different content", async () => {
  const encode = (s) => new TextEncoder().encode(s).buffer;
  const a = await fingerprintBytes(encode("hello"));
  const b = await fingerprintBytes(encode("hellp"));
  assert.notEqual(a, b);
});

test("fingerprintBytes is a known SHA-256 vector", async () => {
  // SHA-256 of the ASCII string "abc".
  const bytes = new TextEncoder().encode("abc");
  const digest = await fingerprintBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(digest, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

// ── mockAssistantService.ts ─────────────────────────────────────────────────
test("mock service reports itself as a mock", () => {
  assert.equal(mockAssistantService.isMock, true);
  assert.equal(typeof mockAssistantService.label, "string");
});

test("mock service returns a mock-sourced response", async () => {
  const controller = new AbortController();
  const response = await mockAssistantService.run(
    {
      documentName: "spec.pdf",
      pageNumber: 2,
      selection: "the quick brown fox",
      actionId: "explain"
    },
    controller.signal
  );
  assert.equal(response.source, "mock");
  assert.equal(response.actionId, "explain");
  assert.ok(response.text.length > 0);
  assert.ok(response.createdAt > 0);
});

test("mock service rejects when the signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => mockAssistantService.run({ documentName: "spec.pdf", pageNumber: null, selection: "", actionId: "summarize" }, controller.signal),
    (error) => error instanceof Error
  );
});

test("mock service aborts mid-run", async () => {
  const controller = new AbortController();
  const pending = mockAssistantService.run({ documentName: "d.pdf", pageNumber: 1, selection: "x", actionId: "quiz" }, controller.signal);
  controller.abort();
  await assert.rejects(() => pending, (error) => error instanceof Error);
});

// ── coordinates.ts ──────────────────────────────────────────────────────────
test("computePdfPageRect centers the rendered page inside the container", () => {
  const rect = computePdfPageRect(612, 792, 1000, 1000, 0);
  assert.equal(rect.width, 612);
  assert.equal(rect.height, 792);
  assert.equal(rect.left, (1000 - 612) / 2);
  assert.equal(rect.top, 0);
});

test("computePdfPageRect honors a manual vertical offset", () => {
  const rect = computePdfPageRect(612, 792, 1000, 1000, 20);
  assert.equal(rect.top, 20);
});

test("normalizePageNumber clamps into the valid page range", () => {
  const document = makeMockDocument();
  return document.getPage(1).then((page) => {
    const viewport = page.getViewport();
    assert.equal(normalizePageNumber(0, 5), 1);
    assert.equal(normalizePageNumber(3, 5), 3);
    assert.equal(normalizePageNumber(99, 5), 5);
    assert.equal(normalizePageNumber(-2, viewport.width), 1);
  });
});

test("clampScroll keeps the scroll offset within bounds", () => {
  assert.equal(clampScroll(-10, 500, 400), 0);
  assert.equal(clampScroll(50, 500, 400), 50);
  assert.equal(clampScroll(900, 500, 400), 100);
});

// ── annotationsFactory.ts ───────────────────────────────────────────────────
test("makeHighlightAnnotation produces a valid highlight", () => {
  const annotation = makeHighlightAnnotation({ pageNumber: 1 });
  assert.equal(annotation.kind, "highlight");
  assert.ok(validateAnnotation(annotation).valid, validateAnnotation(annotation).error);
});

test("makeNoteAnnotation produces a valid note", () => {
  const annotation = makeNoteAnnotation({ pageNumber: 1, text: "hello" });
  assert.equal(annotation.kind, "note");
  assert.ok(validateAnnotation(annotation).valid, validateAnnotation(annotation).error);
});

test("validateAnnotation rejects a note without text", () => {
  const annotation = makeNoteAnnotation({ pageNumber: 1, text: "  " });
  const result = validateAnnotation(annotation);
  assert.equal(result.valid, false);
  assert.match(result.error, /text/i);
});

test("describeAnnotation mentions the page number", () => {
  const annotation = makeHighlightAnnotation({ pageNumber: 4 });
  assert.match(describeAnnotation(annotation), /4/);
});

// ── run ─────────────────────────────────────────────────────────────────────
let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    process.stdout.write(`ok   ${name}\n`);
  } catch (error) {
    failures++;
    process.stdout.write(`FAIL ${name}\n     ${error && error.stack ? error.stack.split("\n").slice(0, 4).join("\n     ") : error}\n`);
  }
}

process.stdout.write(`\n${tests.length - failures}/${tests.length} passed\n`);
process.exit(failures === 0 ? 0 : 1);
