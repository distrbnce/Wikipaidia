import test from "node:test";
import assert from "node:assert/strict";
import { scanArticle, validateTitle, groupCoiRequests, SCAN_VERSION } from "../extension/scanner.js";

const page = (title, ns, wikitext = "", rest = {}) => ({ title, ns, wikitext, revid: 123, timestamp: "2026-10-30T10:00:00Z", ...rest });
const defaultPages = [page("Example", 0), page("Talk:Example", 1)];
const client = (overrides = {}) => ({
  getPages: async () => defaultPages,
  getArchiveTitles: async () => ({ titles: [], truncated: false }),
  getRecentContributors: async () => ({ users: [], hasMore: false }),
  ...overrides
});

test("basic scan surfaces paid talk notices with permanent evidence links", async () => {
  const api = client({ getPages: async () => [page("Example", 0), page("Talk:Example", 1, "{{Connected contributor (paid)|User1=Editor|U1-employer=Employer|U1-client=Example}}") ] });
  const result = await scanArticle("Example", { client: api });
  assert.equal(result.complete, true);
  assert.equal(result.evidence[0].employer, "Employer");
  assert.match(result.evidence[0].sourceUrl, /oldid=123/);
  assert.ok(result.coverage.some(s => s.includes("edit summaries") && s.includes("not analyzed")));
});

test("no finding is bounded coverage, not an assertion that no paid work occurred", async () => {
  const result = await scanArticle("Example", { client: client() });
  assert.deepEqual(result.evidence, []);
  assert.ok(result.coverage.some(s => s.includes("have not been checked")));
  assert.ok(result.coverage.some(s => s.includes("historical")));
});

test("missing talk page is a valid result; unavailable content is incomplete", async () => {
  const missing = await scanArticle("Example", { client: client({ getPages: async () => [defaultPages[0], page("Talk:Example", 1, "", { missing: true })] }) });
  assert.equal(missing.complete, true);
  const unavailable = await scanArticle("Example", { client: client({ getPages: async () => [defaultPages[0], page("Talk:Example", 1, "", { unavailable: true })] }) });
  assert.equal(unavailable.complete, false);
  assert.match(unavailable.warnings[0], /unavailable/);
});

test("omitted talk page does not look like a successful empty scan", async () => {
  const result = await scanArticle("Example", { client: client({ getPages: async () => [defaultPages[0]] }) });
  assert.equal(result.complete, false);
});

test("deep scan connects only article-specific user disclosures and bounded archives", async () => {
  let calls = 0;
  const api = client({
    getPages: async titles => {
      calls++;
      if (calls === 1) return defaultPages;
      assert.deepEqual(titles, ["Talk:Example/Archive 2", "User:Specific", "User:General"]);
      return [
        page("Talk:Example/Archive 2", 1, "{{Connected contributor (paid)|User1=Earlier|U1-employer=Agency}}"),
        page("User:Specific", 2, "{{Paid|employer=Agency|article=[[Example]]}}"),
        page("User:General", 2, "{{Paid|employer=Agency|article=[[Other article]]}}")
      ];
    },
    getArchiveTitles: async () => ({ titles: ["Talk:Example/Archive 2"], truncated: true }),
    getRecentContributors: async () => ({ users: ["Specific", "General"], hasMore: true })
  });
  const result = await scanArticle("Example", { client: api, deep: true });
  assert.equal(result.evidence.length, 2);
  assert.equal(result.evidence.some(e => e.contributor === "General"), false);
  assert.ok(result.warnings.some(w => w.includes("More archives")));
  assert.match(result.deepSummary, /Checked 1 talk archive and 2 user pages/);
  assert.match(result.deepSummary, /historical.*do not establish payment/);
  assert.ok(result.coverage.some(line => line.includes("not counts of distinct connected editors")));
});

const request = (id, additions = {}) => ({
  id, kind: "coi", coiType: "edit-request", heading: "COI edit request",
  sourceTitle: "Talk:Example/Archive 1", sourceRevision: 1173563426,
  sourceUrl: "https://en.wikipedia.org/w/index.php?oldid=1173563426",
  sourceTimestamp: "2023-09-03T06:56:00Z", sourceRole: "archive",
  sectionTitle: "New edit request", sectionUrl: `https://en.wikipedia.org/w/index.php?oldid=1173563426#${id}`,
  requestSummary: `Proposal ${id}`, requestStatus: "answered", contextExcerpt: `Discussion excerpt ${id}`,
  ...additions
});

test("multiple COI requests share one discussion card without losing their own context", () => {
  const first = request("first", { requestStatus: "declined", requestReason: "Not sufficiently sourced" });
  const second = request("second", { requestStatus: "open" });
  const originals = structuredClone([first, second]);
  const [group] = groupCoiRequests([first, second]);
  assert.equal(group.coiType, "edit-request-group");
  assert.equal(group.requestCount, 2);
  assert.equal(group.sourceRole, "archive");
  assert.equal(group.sourceRevision, 1173563426);
  assert.deepEqual(group.requests.map(item => item.id), ["first", "second"]);
  assert.deepEqual(group.requests.map(item => item.sectionUrl), [first.sectionUrl, second.sectionUrl]);
  assert.deepEqual(group.requests.map(item => item.requestStatus), ["declined", "open"]);
  assert.equal(group.requests[0].requestReason, "Not sufficiently sourced");
  assert.equal(group.requests[1].contextExcerpt, second.contextExcerpt);
  assert.equal(group.contributor, undefined, "a group is not attributed to the first request's editor");
  assert.deepEqual([first, second], originals, "aggregation must not mutate parser evidence");
});

test("same section titles do not collapse distinct requests or invent distinct editors", () => {
  const requests = [request("a"), request("b"), request("c")];
  const [group] = groupCoiRequests(requests);
  assert.equal(group.requests.length, 3);
  assert.deepEqual(group.requests.map(item => item.sectionTitle), Array(3).fill("New edit request"));
  assert.match(group.summary, /3 edit requests/);
  assert.doesNotMatch(group.summary, /3 editors|3 conflicts/);
});

test("requests from different source pages or snapshots remain separate", () => {
  const first = request("a");
  const anotherPage = request("b", { sourceTitle: "Talk:Example/Archive 2" });
  const anotherSnapshot = request("c", { sourceRevision: 999 });
  const output = groupCoiRequests([first, anotherPage, anotherSnapshot]);
  assert.deepEqual(output, [first, anotherPage, anotherSnapshot]);
  assert.equal(output.every(item => item.coiType === "edit-request"), true);
});

test("connected editors and paid disclosures are never merged into a request group", () => {
  const alice = { ...request("alice"), coiType: "connected-contributor", contributor: "Alice" };
  const bob = { ...request("bob"), coiType: "connected-contributor", contributor: "Bob" };
  const paid = { ...request("paid"), kind: "paid-disclosure", contributor: "PaidEditor" };
  const [keptAlice, keptPaid, group, keptBob] = groupCoiRequests([alice, paid, request("a"), request("b"), bob]);
  assert.equal(keptAlice, alice);
  assert.equal(keptPaid, paid);
  assert.equal(keptBob, bob);
  assert.equal(group.requestCount, 2);
});

test("empty evidence and single COI requests retain their meaning", () => {
  assert.deepEqual(groupCoiRequests([]), []);
  const single = request("one");
  assert.deepEqual(groupCoiRequests([single]), [single]);
  assert.equal(SCAN_VERSION, 6, "older cached cards must be rescanned with contextual evidence");
});

test("deep scan source failures retain basic evidence and mark check incomplete", async () => {
  const api = client({
    getPages: async () => [page("Example", 0, "{{Paid contributions}}"), defaultPages[1]],
    getArchiveTitles: async () => { throw new Error("Rate limited"); },
    getRecentContributors: async () => { throw new Error("Network unavailable"); }
  });
  const result = await scanArticle("Example", { client: api, deep: true });
  assert.equal(result.complete, false);
  assert.equal(result.evidence[0].kind, "paid-notice");
  assert.equal(result.warnings.length, 2);
});

test("article redirects check canonical talk page instead of old title's notices", async () => {
  const calls = [];
  const api = client({ getPages: async titles => {
    calls.push(titles);
    return calls.length === 1
      ? [page("Canonical", 0), page("Talk:Old", 1, "{{Paid contributions}}")]
      : [page("Talk:Canonical", 1)];
  }});
  const result = await scanArticle("Old", { client: api });
  assert.deepEqual(calls[1], ["Talk:Canonical"]);
  assert.equal(result.title, "Canonical");
  assert.equal(result.evidence.length, 0);
});

test("talk redirect to another subject is not paid evidence for the article", async () => {
  const api = client({ getPages: async () => [defaultPages[0], page("Talk:Unrelated", 1, "{{Connected contributor (paid)|User1=Someone|U1-employer=Employer}}") ] });
  const result = await scanArticle("Example", { client: api });
  assert.equal(result.complete, false);
  assert.deepEqual(result.evidence, []);
});

test("only existing articles may be scanned; title parameters cannot inject another API title", async () => {
  assert.equal(validateTitle("Example_article"), "Example article");
  for (const title of ["", "Example|User:Other", "Example#Section", "<script>", null, "x".repeat(256)]) assert.throws(() => validateTitle(title));
  await assert.rejects(scanArticle("User:Someone", { client: client({ getPages: async () => [page("User:Someone", 2)] }) }), /only supports/);
  await assert.rejects(scanArticle("Missing", { client: client({ getPages: async () => [page("Missing", 0, "", { missing: true })] }) }), /only supports/);
});

test("deep scan reuses basic evidence and reads only newly selected sources", async () => {
  const base = await scanArticle("Example", { client: client({ getPages: async () => [
    page("Example", 0, "{{Paid contributions}}"),
    page("Talk:Example", 1, "{{Connected contributor (paid)|User1=Named|U1-employer=Agency}}")
  ] }) });
  const [currentRequests] = groupCoiRequests([
    request("current-a", { sourceTitle: "Talk:Example", sourceRevision: 123, sourceRole: "talk", contributor: "RequestEditor" }),
    request("current-b", { sourceTitle: "Talk:Example", sourceRevision: 123, sourceRole: "talk" })
  ]);
  base.evidence.push(currentRequests);
  const before = structuredClone(base);
  const freeze = value => {
    if (!value || typeof value !== "object") return;
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  };
  freeze(base);
  const calls = [];
  const api = client({
    getArchiveTitles: async title => {
      assert.equal(title, "Example");
      return { titles: ["Talk:Example/Archive 1"], truncated: false };
    },
    getRecentContributors: async title => {
      assert.equal(title, "Example");
      return { users: ["Recent", "Named"], hasMore: false };
    },
    getPages: async titles => {
      calls.push(titles);
      assert.deepEqual(titles, ["Talk:Example/Archive 1", "User:Named", "User:RequestEditor", "User:Recent"]);
      return [
        page("Talk:Example/Archive 1", 1, "{{edit COI|summary=First request}}\n{{edit COI|summary=Second request}}", { revid: 456 }),
        page("User:Named", 2), page("User:RequestEditor", 2), page("User:Recent", 2)
      ];
    }
  });
  const result = await scanArticle("Example", { client: api, deep: true, baseResult: base, now: () => "2026-10-30T11:00:00Z" });
  assert.equal(calls.length, 1, "article and current talk sources must not be read again");
  assert.equal(result.checkedAt, "2026-10-30T11:00:00Z");
  assert.equal(result.deep, true);
  assert.equal(result.complete, true);
  for (const item of base.evidence) assert.deepEqual(result.evidence.find(found => found.id === item.id), item);
  const keptRequests = result.evidence.find(item => item.id === currentRequests.id);
  assert.equal(keptRequests.requestCount, 2);
  assert.notEqual(keptRequests.requests, base.evidence.at(-1).requests);
  assert.equal(result.evidence.filter(item => item.coiType === "edit-request-group").length, 2);
  assert.deepEqual(base, before, "a deep scan must not mutate cached basic evidence or grouped children");
  assert.ok(result.coverage.includes("Current talk page: Talk:Example"));
  assert.equal(result.coverage.filter(line => line.includes("Notices may describe historical")).length, 1);
  assert.equal(result.coverage.some(line => line.includes("have not been checked")), false);
  assert.match(result.deepSummary, /Checked 1 talk archive and 3 user pages/);
});

test("a cached canonical title matches the underscore-normalized request", async () => {
  const base = await scanArticle("Example article", { client: client({ getPages: async () => [page("Example article", 0), page("Talk:Example article", 1)] }) });
  const result = await scanArticle("Example_article", {
    deep: true, baseResult: base,
    client: client({ getPages: async () => { assert.fail("no newly selected sources require a page read"); } })
  });
  assert.equal(result.title, "Example article");
  assert.equal(result.complete, true);
});

test("new-source failures preserve cached basic findings and their source revision", async () => {
  const base = await scanArticle("Example", { client: client({ getPages: async () => [
    page("Example", 0), page("Talk:Example", 1, "{{Connected contributor (paid)|User1=Named|U1-employer=Agency}}", { revid: 789 })
  ] }) });
  const before = structuredClone(base);
  let pageReads = 0;
  const result = await scanArticle("Example", {
    deep: true, baseResult: base,
    client: client({
      getArchiveTitles: async () => { throw new Error("Archive listing unavailable"); },
      getRecentContributors: async () => { throw new Error("History unavailable"); },
      getPages: async titles => {
        pageReads++;
        assert.deepEqual(titles, ["User:Named"]);
        throw new Error("User page unavailable");
      }
    })
  });
  assert.equal(pageReads, 1);
  assert.equal(result.complete, false);
  assert.deepEqual(result.evidence, base.evidence);
  assert.equal(result.evidence[0].sourceRevision, 789);
  assert.equal(result.warnings.length, 3);
  assert.match(result.deepSummary, /Checked 0 talk archives and 0 user pages/);
  assert.deepEqual(base, before);
});

test("deep scan retains incomplete basic-source coverage and warnings", async () => {
  const base = await scanArticle("Example", { client: client({ getPages: async () => [
    page("Example", 0, "{{Paid contributions}}"), page("Talk:Example", 1, "", { unavailable: true })
  ] }) });
  const result = await scanArticle("Example", {
    deep: true, baseResult: base,
    client: client({ getPages: async () => { assert.fail("basic source must remain the original snapshot"); } })
  });
  assert.equal(result.complete, false);
  assert.deepEqual(result.warnings, base.warnings);
  assert.deepEqual(result.evidence, base.evidence);
});

test("stale, mismatched, malformed, and already-deep cached results read current sources normally", async () => {
  const base = await scanArticle("Example", { client: client() });
  for (const invalid of [
    { ...base, version: SCAN_VERSION - 1 },
    { ...base, title: "Different article" },
    { ...base, title: "Example|User:Other" },
    { ...base, deep: true },
    { ...base, evidence: null },
    { ...base, coverage: null },
    { ...base, warnings: null },
    { ...base, complete: undefined }
  ]) {
    const calls = [];
    const result = await scanArticle("Example", {
      deep: true, baseResult: invalid,
      client: client({ getPages: async titles => { calls.push(titles); return defaultPages; } })
    });
    assert.deepEqual(calls, [["Example", "Talk:Example"]]);
    assert.equal(result.complete, true);
  }
});

test("a basic scan always reads current sources even when given a cached base", async () => {
  const base = await scanArticle("Example", { client: client() });
  let reads = 0;
  await scanArticle("Example", { baseResult: base, client: client({ getPages: async () => { reads++; return defaultPages; } }) });
  assert.equal(reads, 1);
});
