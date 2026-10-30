import test from "node:test";
import assert from "node:assert/strict";
import "../extension/diff-model.js";

const { buildUnifiedDiff, contextualize } = globalThis.WikipaidiaDiff;
const source = (segments, side) => segments.filter(segment => segment.type !== (side === "before" ? "add" : "remove")).map(segment => segment.text).join("");

function assertSources(change, result) {
  assert.equal(source(result.segments, "before"), change.before);
  assert.equal(source(result.segments, "after"), change.after);
}

test("a comma insertion has one shared paragraph and only one added character", () => {
  const change = { before: "He stepped down in 2021 but remained chairman.", after: "He stepped down in 2021, but remained chairman.", afterHighlights: [{ start: 23, end: 24 }] };
  const result = buildUnifiedDiff(change);
  assert.deepEqual(result, { precise: true, segments: [
    { type: "equal", text: "He stepped down in 2021" }, { type: "add", text: "," }, { type: "equal", text: " but remained chairman." }
  ] });
  assertSources(change, result);
});

test("a replacement renders removal before addition and retains common text once", () => {
  const change = { before: "The old text.", after: "The new text.", beforeHighlights: [{ start: 4, end: 7 }], afterHighlights: [{ start: 4, end: 7 }] };
  const result = buildUnifiedDiff(change);
  assert.deepEqual(result.segments, [
    { type: "equal", text: "The " }, { type: "remove", text: "old" }, { type: "add", text: "new" }, { type: "equal", text: " text." }
  ]);
  assertSources(change, result);
});

test("multiple insertion and deletion ranges retain all source and their order", () => {
  const change = { before: "old red and blue end", after: "new red plus blue end",
    beforeHighlights: [{ start: 0, end: 3 }, { start: 8, end: 11 }], afterHighlights: [{ start: 0, end: 3 }, { start: 8, end: 12 }] };
  const result = buildUnifiedDiff(change);
  assert.deepEqual(result.segments.filter(s => s.type === "remove").map(s => s.text), ["old", "and"]);
  assert.deepEqual(result.segments.filter(s => s.type === "add").map(s => s.text), ["new", "plus"]);
  assertSources(change, result);
});

test("pure insertion, deletion, empty, and equal sources need no metadata", () => {
  for (const change of [{ before: "", after: "New paragraph." }, { before: "Removed paragraph.", after: "" }, { before: "", after: "" }, { before: "Same", after: "Same" }]) {
    const result = buildUnifiedDiff(change);
    assert.equal(result.precise, true);
    assertSources(change, result);
  }
});

test("the character fallback handles Unicode and whitespace without changing source", () => {
  const change = { before: "😀 old name  ", after: "😀 new name " };
  const result = buildUnifiedDiff(change);
  assert.equal(result.precise, true);
  assertSources(change, result);
  assert.ok(result.segments.some(s => s.type === "equal" && s.text.startsWith("😀 ")));
  assert.ok(result.segments.some(s => s.type === "remove" && s.text.includes(" ")));
});

test("invalid or clipped ranges cannot silently lose unmatched source", () => {
  for (const change of [
    { before: "one text", after: "one new text", afterHighlights: [{ start: 200, end: 201 }] },
    { before: "ABCD", after: "AXBC", afterHighlights: [{ start: 1, end: 2 }] },
    { before: "😀", after: "😁", beforeHighlights: [{ start: 0, end: 1 }], afterHighlights: [{ start: 0, end: 2 }] }
  ]) {
    const result = buildUnifiedDiff(change);
    assert.equal(result.precise, false);
    assertSources(change, result);
  }
});

test("large rewrites preserve complete source and report coarse comparison", () => {
  const change = { before: "prefix " + "a".repeat(2000) + " suffix", after: "prefix " + "b".repeat(2000) + " suffix" };
  const result = buildUnifiedDiff(change);
  assert.equal(result.precise, false);
  assert.equal(result.segments[0].text, "prefix ");
  assert.equal(result.segments.at(-1).text, " suffix");
  assertSources(change, result);
});

test("collapsed context omits distant shared text and keeps the changed comma", () => {
  const before = "Beginning words ".repeat(10) + "in 2021 but still chair. " + "Later words ".repeat(10);
  const after = before.replace("2021 but", "2021, but");
  const result = buildUnifiedDiff({ before, after });
  const compact = contextualize(result.segments);
  assert.deepEqual(compact.filter(s => s.type !== "equal" && s.type !== "ellipsis"), [{ type: "add", text: "," }]);
  assert.equal(compact.filter(s => s.type === "ellipsis").length, 2);
  assert.ok(compact.map(s => s.text).join("").length < after.length / 2);
  assert.equal(source(result.segments, "after"), after);
});

test("nearby changes merge context and distant changes remain individually visible", () => {
  const nearby = [{ type: "equal", text: "prefix " }, { type: "remove", text: "old" }, { type: "add", text: "new" }, { type: "equal", text: " shared words " }, { type: "add", text: "," }, { type: "equal", text: " suffix" }];
  assert.deepEqual(contextualize(nearby), nearby);
  const distant = [{ type: "add", text: "A" }, { type: "equal", text: " middle ".repeat(50) }, { type: "remove", text: "B" }];
  const compact = contextualize(distant, { context: 12 });
  assert.equal(compact.filter(s => s.type === "ellipsis").length, 1);
  assert.equal(compact[0].text, "A");
  assert.equal(compact.at(-1).text, "B");
});

test("context cuts keep Unicode characters intact, including with zero context", () => {
  const segments = [{ type: "equal", text: "😀".repeat(70) }, { type: "add", text: "," }, { type: "equal", text: "😁".repeat(70) }];
  const compact = contextualize(segments, { context: 5 });
  assert.deepEqual(compact.map(s => [s.type, Array.from(s.text).length]), [["ellipsis", 1], ["equal", 5], ["add", 1], ["equal", 5], ["ellipsis", 1]]);
  assert.deepEqual(contextualize(segments, { context: 0 }), [{ type: "ellipsis", text: "…" }, { type: "add", text: "," }, { type: "ellipsis", text: "…" }]);
});

test("invalid context inputs fail explicitly rather than dropping changes", () => {
  assert.throws(() => contextualize(null), TypeError);
  assert.throws(() => contextualize([{ type: "unknown", text: "x" }]), TypeError);
  assert.throws(() => contextualize([], { context: -1 }), TypeError);
});
