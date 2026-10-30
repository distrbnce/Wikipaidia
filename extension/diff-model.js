(() => {
  "use strict";

  const MAX_CELLS = 2_500_000;
  const WORD = /[\p{L}\p{N}_]/u;

  function append(segments, type, text) {
    if (!text) return;
    const last = segments.at(-1);
    if (last?.type === type && type !== "ellipsis") last.text += text;
    else segments.push({ type, text });
  }

  function atCharacterBoundary(text, index) {
    if (index <= 0 || index >= text.length) return true;
    const previous = text.charCodeAt(index - 1), next = text.charCodeAt(index);
    return !(previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff);
  }

  function normalizedRanges(value, text) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return null;
    const ranges = [];
    for (const range of value) {
      if (!Number.isSafeInteger(range?.start) || !Number.isSafeInteger(range?.end)
        || range.start < 0 || range.end <= range.start || range.end > text.length
        || !atCharacterBoundary(text, range.start) || !atCharacterBoundary(text, range.end)) return null;
      ranges.push({ start: range.start, end: range.end });
    }
    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push(range);
    }
    return merged;
  }

  function fromRanges(before, after, deleted, inserted) {
    if (!deleted || !inserted || (!deleted.length && !inserted.length)) return null;
    const segments = [];
    let i = 0, j = 0, d = 0, a = 0;
    while (i < before.length || j < after.length) {
      // At a replacement point, show the removed text before the added text.
      if (deleted[d]?.start === i) {
        append(segments, "remove", before.slice(i, deleted[d].end));
        i = deleted[d++].end;
      }
      if (inserted[a]?.start === j) {
        append(segments, "add", after.slice(j, inserted[a].end));
        j = inserted[a++].end;
      }
      if (i === before.length && j === after.length) break;
      const count = Math.min((deleted[d]?.start ?? before.length) - i, (inserted[a]?.start ?? after.length) - j);
      if (count <= 0 || before.slice(i, i + count) !== after.slice(j, j + count)) return null;
      append(segments, "equal", before.slice(i, i + count));
      i += count;
      j += count;
    }
    if (d !== deleted.length || a !== inserted.length) return null;
    return segments;
  }

  function characterDiff(before, after) {
    const left = Array.from(before), right = Array.from(after);
    let prefix = 0, suffix = 0;
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;
    while (suffix < left.length - prefix && suffix < right.length - prefix
      && left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix++;
    const a = left.slice(prefix, left.length - suffix), b = right.slice(prefix, right.length - suffix);
    const segments = [];
    append(segments, "equal", left.slice(0, prefix).join(""));
    let precise = true;
    if (!a.length) append(segments, "add", b.join(""));
    else if (!b.length) append(segments, "remove", a.join(""));
    else if ((a.length + 1) * (b.length + 1) > MAX_CELLS) {
      // Preserve all source when a rewrite is too large for an interactive LCS.
      append(segments, "remove", a.join(""));
      append(segments, "add", b.join(""));
      precise = false;
    } else {
      const width = b.length + 1;
      const lengths = new Uint16Array((a.length + 1) * width);
      for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
        lengths[i * width + j] = a[i] === b[j] ? lengths[(i + 1) * width + j + 1] + 1
          : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
      }
      let i = 0, j = 0;
      while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) { append(segments, "equal", a[i]); i++; j++; }
        else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
          append(segments, "remove", a[i++]);
        } else append(segments, "add", b[j++]);
      }
    }
    if (suffix) append(segments, "equal", left.slice(left.length - suffix).join(""));
    return { segments, precise };
  }

  /** Plain text only. Filtering out adds/removals reconstructs each source. */
  function buildUnifiedDiff(change = {}) {
    const before = typeof change.before === "string" ? change.before : "";
    const after = typeof change.after === "string" ? change.after : "";
    if (before === after) return { segments: before ? [{ type: "equal", text: before }] : [], precise: true };
    if (!before) return { segments: [{ type: "add", text: after }], precise: true };
    if (!after) return { segments: [{ type: "remove", text: before }], precise: true };
    const supplied = change.beforeHighlights !== undefined || change.afterHighlights !== undefined;
    const segments = fromRanges(before, after,
      normalizedRanges(change.beforeHighlights, before), normalizedRanges(change.afterHighlights, after));
    if (segments) return { segments, precise: true };
    const fallback = characterDiff(before, after);
    // Mismatched supplied metadata can indicate clipped source. Do not claim
    // that a reconstructed preview is an exact comparison of the full paragraph.
    return { ...fallback, precise: fallback.precise && !supplied };
  }

  function contextEnd(characters, count) {
    let end = Math.min(count, characters.length);
    const limit = Math.min(end + 16, characters.length);
    while (end > 0 && end < limit && WORD.test(characters[end - 1]) && WORD.test(characters[end])) end++;
    return end;
  }

  function contextStart(characters, count) {
    let start = Math.max(0, characters.length - count);
    const limit = Math.max(0, start - 16);
    while (start > limit && start < characters.length && WORD.test(characters[start - 1]) && WORD.test(characters[start])) start--;
    return start;
  }

  /** Keep every change, with nearby shared text and explicit omission markers. */
  function contextualize(input, { context = 55 } = {}) {
    if (!Array.isArray(input)) throw new TypeError("Diff segments must be an array.");
    if (!Number.isSafeInteger(context) || context < 0) throw new TypeError("Context must be a nonnegative integer.");
    const segments = [];
    for (const segment of input) {
      if (!segment || !["equal", "remove", "add"].includes(segment.type) || typeof segment.text !== "string") throw new TypeError("Invalid diff segment.");
      append(segments, segment.type, segment.text);
    }
    const first = segments.findIndex(segment => segment.type !== "equal");
    if (first === -1) return segments;
    const last = segments.findLastIndex(segment => segment.type !== "equal");
    const result = [];
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (segment.type !== "equal") { append(result, segment.type, segment.text); continue; }
      const characters = Array.from(segment.text);
      const end = index > first ? contextEnd(characters, context) : 0;
      const start = index < last ? contextStart(characters, context) : characters.length;
      if (end >= start) { append(result, "equal", segment.text); continue; }
      append(result, "equal", characters.slice(0, end).join(""));
      append(result, "ellipsis", "…");
      append(result, "equal", characters.slice(start).join(""));
    }
    return result;
  }

  globalThis.WikipaidiaDiff = Object.freeze({ buildUnifiedDiff, contextualize });
})();
