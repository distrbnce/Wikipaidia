import assert from "node:assert/strict";
import test from "node:test";
import { createRequestScheduler, createWikiClient, parseDiffHtml, API_ENDPOINT, CLIENT_ID, ARTICLE_DIFF_TEXT_LIMIT } from "../extension/wiki-api.js";

const tick = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300, status, headers: new Headers(headers),
  json: async () => structuredClone(data),
});
const page = (title = "Example", ns = 0) => ({
  title, ns, revisions: [{ revid: 1234, timestamp: "2026-10-30T12:00:00Z", slots: { main: { content: "Article text" } } }],
});
function clientWith(data, options = {}) {
  return createWikiClient({
    scheduler: createRequestScheduler({ minIntervalMs: 0 }),
    fetchImpl: async () => response(data), ...options,
  });
}
const errorCode = code => error => error.code === code;

const blockedAccount = (overrides = {}) => ({
  userid: 32854533, name: "FinalFrontier.003", blockid: 9510224, blockedby: "Bbb23",
  blockreason: "{{checkuserblock-account}}: Abusing [[WP:SOCK|multiple accounts]]: Please see: [[w:en:Wikipedia:Sockpuppet investigations/Changingguardsatbuckinghampalace]]",
  blockedtimestamp: "2020-01-20T17:42:10Z", blockexpiry: "infinite", blockpartial: false,
  ...overrides,
});

test("account status reads current blockinfo and keeps its recorded reason and evidence", async () => {
  let captured;
  const client = clientWith({}, { fetchImpl: async url => {
    captured = new URL(url);
    return response({ batchcomplete: true, query: { users: [blockedAccount()] } });
  } });
  const result = await client.getUserBlockStatus("finalFrontier.003");
  assert.equal(captured.searchParams.get("list"), "users");
  assert.equal(captured.searchParams.get("ususers"), "finalFrontier.003");
  assert.equal(captured.searchParams.get("usprop"), "blockinfo");
  assert.deepEqual(result, {
    user: "FinalFrontier.003", blocked: true, exists: true,
    block: {
      id: 9510224, by: "Bbb23",
      reason: "Abusing multiple accounts",
      reasonUrl: "https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Changingguardsatbuckinghampalace",
      timestamp: "2020-01-20T17:42:10Z", expiry: "infinite", partial: false,
      logUrl: "https://en.wikipedia.org/w/index.php?title=Special%3ALog&type=block&page=User%3AFinalFrontier.003",
    },
  });
  assert.doesNotMatch(result.block.reason, /paid/i, "a block for another reason must never become a paid-editing claim");
});

test("final Please see citations link the recorded block reason to local investigation evidence", async () => {
  for (const [citation, expected] of [
    ["[[Wikipedia:Sockpuppet investigations/Fixture case|the recorded investigation]]", "https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Fixture_case"],
    ["[[:w:en:Wikipedia:Sockpuppet investigations/Fixture case#Evidence|details]].", "https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Fixture_case#Evidence"],
    ["[[Example article|details]]", "https://en.wikipedia.org/wiki/Example_article"],
    ["[https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Fixture_case investigation]", "https://en.wikipedia.org/wiki/Wikipedia:Sockpuppet_investigations/Fixture_case"],
    ["[https://en.wikipedia.org/w/index.php?title=Wikipedia%3ASockpuppet_investigations%2FFixture_case&oldid=1234]", "https://en.wikipedia.org/w/index.php?title=Wikipedia%3ASockpuppet_investigations%2FFixture_case&oldid=1234"],
  ]) {
    const result = await clientWith({ query: { users: [blockedAccount({ blockreason: `Abusing [[WP:SOCK|multiple accounts]]: Please see: ${citation}` })] } })
      .getUserBlockStatus("FinalFrontier.003");
    assert.equal(result.block.reason, "Abusing multiple accounts");
    assert.equal(result.block.reasonUrl, expected);
  }
});

test("unsafe, ambiguous, and ordinary block citations retain the full readable reason", async () => {
  for (const raw of [
    "Disruption: Please see: [https://example.com/investigation evidence]",
    "Disruption: Please see: [https://en.wikipedia.org.evil.example/investigation evidence]",
    "Disruption: Please see: [https://name@en.wikipedia.org/wiki/Investigation evidence]",
    "Disruption: Please see: [http://en.wikipedia.org/wiki/Investigation evidence]",
    "Disruption: Please see: [[w:fr:Wikipedia:Investigation]]",
    "Disruption: Please see: [[commons:Investigation]]",
    "Disruption: Please see: [[Wikipedia:Investigation]] and additional recorded grounds.",
    "Disruption. [[Wikipedia:Investigation|Evidence]]",
    "{{block template|Please see: [[Wikipedia:Hidden citation]]}}: Disruption",
  ]) {
    const result = await clientWith({ query: { users: [blockedAccount({ blockreason: raw })] } }).getUserBlockStatus("FinalFrontier.003");
    assert.equal(result.block.reasonUrl, undefined, raw);
    assert.ok(result.block.reason.includes("Disruption"), raw);
    if (raw.includes("Please see:") && !raw.startsWith("{{")) assert.ok(result.block.reason.includes("Please see:"), raw);
  }
  const ordinary = await clientWith({ query: { users: [blockedAccount({ blockreason: "Repeated disruption" })] } }).getUserBlockStatus("FinalFrontier.003");
  assert.equal(ordinary.block.reason, "Repeated disruption");
  assert.equal(ordinary.block.reasonUrl, undefined);
});

test("unblocked, missing, and invalid actors are distinct from unavailable account data", async () => {
  assert.deepEqual(await clientWith({ query: { users: [{ userid: 12, name: "Example Editor" }] } })
    .getUserBlockStatus(" example_Editor "), { user: "Example Editor", blocked: false, exists: true });
  for (const account of [{ name: "Unknown Editor", missing: true }, { name: "71.67.84.234", invalid: true }]) {
    assert.deepEqual(await clientWith({ query: { users: [account] } }).getUserBlockStatus(account.name),
      { user: account.name, blocked: false, exists: false });
  }
  await assert.rejects(clientWith({}, { fetchImpl: async () => { throw new Error("offline"); } }).getUserBlockStatus("Example Editor"), errorCode("network-error"));
  await assert.rejects(clientWith({ warnings: { users: "incomplete" }, query: { users: [{ userid: 12, name: "Example Editor" }] } })
    .getUserBlockStatus("Example Editor"), errorCode("incomplete-response"));
});

test("partial and finite blocks retain the API's scope and expiry without guessing template meaning", async () => {
  const result = await clientWith({ query: { users: [blockedAccount({
    blockpartial: true, blockexpiry: "2027-01-01T00:00:00Z", blockreason: "{{some block template|value={{nested}}}}",
  })] } }).getUserBlockStatus("FinalFrontier.003");
  assert.equal(result.block.partial, true);
  assert.equal(result.block.expiry, "2027-01-01T00:00:00Z");
  assert.equal(result.block.reason, "No plain-text reason provided.");
  const noOptionalFields = blockedAccount();
  delete noOptionalFields.blockedby;
  delete noOptionalFields.blockedtimestamp;
  delete noOptionalFields.blockpartial;
  const minimal = await clientWith({ query: { users: [noOptionalFields] } }).getUserBlockStatus("FinalFrontier.003");
  assert.equal(minimal.block.partial, false);
  assert.equal(minimal.block.by, undefined);
  assert.equal(minimal.block.timestamp, undefined);
});

test("block reasons remain plain text and source links stay on English Wikipedia", async () => {
  const result = await clientWith({ query: { users: [blockedAccount({
    blockreason: "<!--hidden--><script>bad()</script><b>Disruption</b> &amp; '''abuse''': [https://example.com/path recorded evidence]",
  })] } }).getUserBlockStatus("FinalFrontier.003");
  assert.equal(result.block.reason, "Disruption & abuse: recorded evidence");
  assert.equal(new URL(result.block.logUrl).origin, "https://en.wikipedia.org");
  assert.equal(new URL(result.block.logUrl).searchParams.get("page"), "User:FinalFrontier.003");
});

test("account block status rejects unrelated actors, malformed data, and incomplete block metadata", async () => {
  for (const data of [
    { query: {} }, { query: { users: [] } }, { query: { users: {} } },
    { query: { users: [null] } }, { query: { users: [{ name: "Someone else", userid: 4 }] } },
    { query: { users: [blockedAccount(), blockedAccount()] } },
    { query: { users: [{ name: "FinalFrontier.003" }] } },
    { query: { users: [blockedAccount({ missing: true })] } },
    ...[
      { blockid: 0 }, { blockid: "9510224" }, { blockreason: {} }, { blockexpiry: "tomorrow" },
      { blockpartial: "false" }, { blockedtimestamp: "recently" }, { blockedby: "" },
    ].map(override => ({ query: { users: [blockedAccount(override)] } })),
  ]) {
    await assert.rejects(clientWith(data).getUserBlockStatus("FinalFrontier.003"), errorCode("invalid-response"));
  }
  await assert.rejects(clientWith({ continue: { continue: "next" }, query: { users: [blockedAccount()] } })
    .getUserBlockStatus("FinalFrontier.003"), errorCode("incomplete-response"));
});

test("invalid contributor input is rejected before any status request", async () => {
  let requests = 0;
  const client = clientWith({}, { fetchImpl: async () => { requests++; return response({}); } });
  for (const actor of [null, "", " ", "Alice|Bob", "<Alice>", "Alice\nBob", "x".repeat(256)]) {
    await assert.rejects(client.getUserBlockStatus(actor), errorCode("invalid-response"));
  }
  assert.equal(requests, 0);
});

test("public reads omit cookies/referrers and cannot override the read-only endpoint or query mode", async () => {
  let captured;
  const client = clientWith({}, { fetchImpl: async (url, options) => {
    captured = { url: new URL(url), options };
    return response({ query: { pages: [page()] } });
  } });
  await client.request({ action: "edit", format: "xml", origin: "https://example.com", titles: "Example" });
  assert.equal(captured.url.origin + captured.url.pathname, API_ENDPOINT);
  assert.equal(captured.url.searchParams.get("action"), "query");
  assert.equal(captured.url.searchParams.get("formatversion"), "2");
  assert.equal(captured.url.searchParams.get("origin"), "*");
  assert.equal(captured.options.method, "GET");
  assert.equal(captured.options.credentials, "omit");
  assert.equal(captured.options.referrerPolicy, "no-referrer");
  assert.equal(captured.options.redirect, "error");
  assert.equal(captured.options.headers["Api-User-Agent"], CLIENT_ID);
});

test("page reads retain authoritative namespace and expose unavailable sources", async () => {
  const client = clientWith({ query: { pages: [
    page(), { title: "Talk:Example", ns: 1, missing: true },
    { title: "User:Alice", ns: 2, revisions: [{ revid: 42, timestamp: "2026-10-30T12:00:00Z", texthidden: true }] },
  ] } });
  const [article, talk, user] = await client.getPages(["Example", "Talk:Example", "User:Alice"]);
  assert.equal(article.ns, 0);
  assert.equal(article.unavailable, false);
  assert.equal(article.wikitext, "Article text");
  assert.equal(talk.missing, true);
  assert.equal(talk.unavailable, false);
  assert.equal(user.ns, 2);
  assert.equal(user.unavailable, true);
  assert.equal(user.wikitext, "");
  const unusual = await clientWith({ query: { pages: [page("Example", 2)] } }).getPages(["Example"]);
  assert.equal(unusual[0].ns, 2, "title appearance must never manufacture namespace zero");
});

test("page identity follows Wikipedia normalization and redirects without accepting unrelated sources", async () => {
  const client = clientWith({ query: {
    normalized: [{ from: "old_title", to: "Old title" }],
    redirects: [{ from: "Old title", to: "Example" }], pages: [page()],
  } });
  assert.equal((await client.getPages(["old_title"]))[0].title, "Example");
  await assert.rejects(clientWith({ query: { pages: [page("Other")] } }).getPages(["Example"]), errorCode("incomplete-response"));
});

test("content reads reject continuation, warnings, omitted pages, and malformed namespaces", async () => {
  for (const data of [
    { continue: { rvcontinue: "next" }, query: { pages: [page()] } },
    { warnings: { revisions: { warnings: "The result was truncated" } }, query: { pages: [page()] } },
    { query: { pages: [page()] } },
  ]) {
    const requested = data.continue || data.warnings ? ["Example"] : ["Example", "Talk:Example"];
    await assert.rejects(clientWith(data).getPages(requested), errorCode("incomplete-response"));
  }
  const noNamespace = page();
  delete noNamespace.ns;
  await assert.rejects(clientWith({ query: { pages: [noNamespace] } }).getPages(["Example"]), errorCode("invalid-response"));
});

test("content reads reject empty/malformed data and require immutable revision metadata", async () => {
  for (const data of [{ query: {} }, { query: { pages: [] } }, { query: { pages: {} } }, { query: [] }, null]) {
    await assert.rejects(clientWith(data).getPages(["Example"]), errorCode("invalid-response"));
  }
  const missingMetadata = page();
  delete missingMetadata.revisions[0].revid;
  const [result] = await clientWith({ query: { pages: [missingMetadata] } }).getPages(["Example"]);
  assert.equal(result.unavailable, true);
});

test("page batches respect the content limit and empty batches do not use the network", async () => {
  let calls = 0;
  const client = clientWith({}, { fetchImpl: async () => { calls += 1; throw new Error("Should not fetch"); } });
  assert.deepEqual(await client.getPages([]), []);
  await assert.rejects(client.getPages(Array.from({ length: 51 }, (_, index) => `Page ${index}`)), errorCode("too-many-pages"));
  assert.equal(calls, 0);
});

test("contributor reads exclude hidden, anonymous, temporary, malformed, and duplicate identities", async () => {
  const client = clientWith({ continue: { rvcontinue: "older" }, query: { pages: [{
    title: "Example", ns: 0, revisions: [
      { userid: 1, user: "Alice" }, { userid: 1, user: "Alice" },
      { userid: 2, user: "Bob" }, { userid: 3 }, { userid: 4, user: "" },
      { userid: 5, user: "Hidden", userhidden: "" }, { userid: 0, user: "192.0.2.1" },
      { userid: 6, user: "~2026-12345" }, { userid: 7, user: "Temp", temp: true },
      { userid: "8", user: "Invalid ID" },
    ],
  }] } });
  const result = await client.getRecentContributors("Example");
  assert.deepEqual(result.users, ["Alice", "Bob"]);
  assert.equal(result.hasMore, true);
});

test("contributor reads reject missing or non-article source data", async () => {
  for (const source of [
    { title: "Example", ns: 0 }, { title: "Example", ns: 0, missing: true },
    { title: "Example", ns: 1, revisions: [] },
  ]) await assert.rejects(clientWith({ query: { pages: [source] } }).getRecentContributors("Example"), errorCode("invalid-response"));
});

test("archive reads preserve bounded continuation and reject an absent or unrelated listing", async () => {
  const client = clientWith({ continue: { apcontinue: "next" }, query: { allpages: [
    { title: "Talk:Example/Archive 2", ns: 1 }, { title: "Talk:Example/Archive 10", ns: 1 },
    { title: "Talk:Example/FAQ", ns: 1 },
  ] } });
  assert.deepEqual(await client.getArchiveTitles("Example", 1), { titles: ["Talk:Example/Archive 10"], truncated: true });
  for (const query of [{}, { allpages: [{ title: "Talk:Other/Archive 1", ns: 1 }] }, { allpages: [{ title: "Talk:Example/Archive 1", ns: 0 }] }]) {
    await assert.rejects(clientWith({ query }).getArchiveTitles("Example"), errorCode("invalid-response"));
  }
});

test("HTTP, API, invalid JSON, and connection failures remain distinguishable", async () => {
  await assert.rejects(clientWith({}, { fetchImpl: async () => response({}, 500) }).request(), errorCode("http-error"));
  await assert.rejects(clientWith({ error: { code: "maxlag" } }).request(), errorCode("maxlag"));
  await assert.rejects(clientWith({}, { fetchImpl: async () => { throw new Error("Offline"); } }).request(), errorCode("network-error"));
  await assert.rejects(clientWith({}, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("Not JSON"); } }) }).request(), errorCode("invalid-response"));
});

test("requests time out and abort the fetch without waiting for a long server response", async () => {
  let signal;
  const client = clientWith({}, { timeoutMs: 5, fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
  } });
  await assert.rejects(client.request(), errorCode("timeout"));
  assert.equal(signal.aborted, true);
});

test("one shared scheduler limits work from multiple clients to three simultaneous fetches", async () => {
  const scheduler = createRequestScheduler({ minIntervalMs: 0 });
  let active = 0;
  let maximum = 0;
  let starts = 0;
  const releases = [];
  const fetchImpl = async () => {
    starts += 1;
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => releases.push(resolve));
    active -= 1;
    return response({ query: {} });
  };
  const clients = [createWikiClient({ fetchImpl, scheduler }), createWikiClient({ fetchImpl, scheduler })];
  const jobs = Array.from({ length: 8 }, (_, index) => clients[index % 2].request());
  await tick();
  assert.equal(starts, 3);
  while (starts < 8 || releases.length) {
    releases.shift()?.();
    await tick();
  }
  await Promise.all(jobs);
  assert.equal(maximum, 3);
});

test("request starts are paced without slow wall-clock tests", async () => {
  let clock = 0;
  const delays = [];
  const starts = [];
  const scheduler = createRequestScheduler({
    now: () => clock,
    sleep: async milliseconds => { await Promise.resolve(); delays.push(milliseconds); clock += milliseconds; },
  });
  await Promise.all(Array.from({ length: 3 }, () => scheduler.run(() => { starts.push(clock); })));
  assert.deepEqual(starts, [0, 400, 800]);
  assert.deepEqual(delays, [400, 400]);
});

test("429 cooldown is shared across clients, fails quickly, and expires without automatic retries", async () => {
  let clock = Date.parse("2026-10-30T12:00:00Z");
  let calls = 0;
  const scheduler = createRequestScheduler({ minIntervalMs: 0, now: () => clock });
  const fetchImpl = async () => ++calls === 1 ? response({}, 429, { "Retry-After": "2" }) : response({ query: {} });
  const first = createWikiClient({ fetchImpl, scheduler, now: () => clock });
  const second = createWikiClient({ fetchImpl, scheduler, now: () => clock });
  await assert.rejects(first.request(), errorCode("rate-limited"));
  await assert.rejects(second.request(), errorCode("rate-limited"));
  assert.equal(calls, 1);
  clock += 1999;
  await assert.rejects(second.request(), errorCode("rate-limited"));
  clock += 1;
  await second.request();
  assert.equal(calls, 2);
});

test("503 Retry-After HTTP dates and missing headers establish a bounded fast-failing cooldown", async () => {
  for (const [header, expectedMilliseconds] of [["Fri, 30 Oct 2026 12:00:05 GMT", 5000], [undefined, 30000]]) {
    let clock = Date.parse("2026-10-30T12:00:00Z");
    let calls = 0;
    const scheduler = createRequestScheduler({ minIntervalMs: 0, now: () => clock });
    const client = createWikiClient({ scheduler, now: () => clock, fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? response({}, 503, header ? { "Retry-After": header } : {}) : response({ query: {} });
    } });
    await assert.rejects(client.request(), errorCode("rate-limited"));
    clock += expectedMilliseconds - 1;
    await assert.rejects(client.request(), errorCode("rate-limited"));
    assert.equal(calls, 1);
    clock += 1;
    await client.request();
    assert.equal(calls, 2);
  }
});

test("a server cooldown rejects queued work rather than sending it or holding the scan open", async () => {
  const scheduler = createRequestScheduler({ maxConcurrent: 1, minIntervalMs: 0 });
  let release;
  let calls = 0;
  const client = createWikiClient({ scheduler, fetchImpl: async () => {
    calls += 1;
    await new Promise(resolve => { release = resolve; });
    return response({}, 429, { "Retry-After": "60" });
  } });
  const results = Promise.allSettled([client.request(), client.request()]);
  await tick();
  release();
  const settled = await results;
  assert.equal(calls, 1);
  assert.ok(settled.every(result => result.status === "rejected" && result.reason.code === "rate-limited"));
});

const articleEdit = (overrides = {}) => ({ revid: 1234, parentid: 1230, timestamp: "2018-11-13T11:02:00Z", user: "Example Editor", comment: "Updated source", ...overrides });
const editPage = (revision = articleEdit(), overrides = {}) => ({ title: "Example", ns: 0, revisions: [revision], ...overrides });
const tableDiff = `<tr><td colspan="2" class="diff-lineno">Line 1:</td><td colspan="2" class="diff-lineno">Line 1:</td></tr>
<tr><td class="diff-marker">−</td><td class="diff-deletedline"><div>Old <del class="diffchange diffchange-inline">word</del> &amp; text</div></td><td class="diff-marker">+</td><td class="diff-addedline"><div>New <ins class="diffchange diffchange-inline">word</ins> &amp; text</div></td></tr>
<tr><td class="diff-marker"></td><td class="diff-context"><div>Unchanged context</div></td><td class="diff-marker"></td><td class="diff-context"><div>Unchanged context</div></td></tr>
<tr><td class="diff-marker"></td><td colspan="1" class="diff-empty"></td><td class="diff-marker">+</td><td class="diff-addedline"><div>Added source</div></td></tr>
<tr><td class="diff-marker">−</td><td class="diff-deletedline"><div>Removed source</div></td><td class="diff-marker"></td><td class="diff-empty"></td></tr>`;
const comparison = (overrides = {}) => ({ compare: { fromrevid: 1230, torevid: 1234, fromns: 0, tons: 0,
  fromtitle: "Example", totitle: "Example", body: tableDiff, ...overrides } });

function sequencedClient(responses, captured = []) {
  return clientWith({}, { fetchImpl: async (url, options) => {
    captured.push({ url: new URL(url), options });
    if (!responses.length) throw new Error("Unexpected extra request");
    return response(responses.shift());
  } });
}

test("article history filters by contributor across the article's full available history", async () => {
  const captured = [];
  const result = await sequencedClient([{ continue: { rvcontinue: "2017" }, query: { pages: [editPage()] } }], captured)
    .getContributorEdits("Example", "Example_Editor");
  assert.equal(captured[0].url.searchParams.get("rvuser"), "Example_Editor");
  assert.equal(captured[0].url.searchParams.get("rvlimit"), "10");
  assert.equal(captured[0].url.searchParams.get("rvprop"), "ids|timestamp|user|comment");
  assert.equal(result.hasMore, true);
  assert.equal(result.edits[0].timestamp, "2018-11-13T11:02:00Z");
  const link = new URL(result.edits[0].diffUrl);
  assert.equal(link.searchParams.get("diff"), "1234");
  assert.equal(link.searchParams.get("oldid"), "1230");
});

test("filtered existing-article histories without a revisions property are valid empty results", async () => {
  for (const source of [{ title: "Example", ns: 0 }, { title: "Example", ns: 0, revisions: [] }]) {
    assert.deepEqual(await clientWith({ query: { pages: [source] } }).getContributorEdits("Example", "Example Editor"), { edits: [], hasMore: false });
  }
});

test("complete contributor history follows metadata pagination, deduplicates, and orders newest first", async () => {
  const revision = index => articleEdit({ revid: 2000 + index, parentid: 1999 + index,
    timestamp: new Date(Date.UTC(2022, 0, 1, 0, 0, index)).toISOString() });
  const captured = [];
  const result = await sequencedClient([
    { continue: { continue: "||", rvcontinue: "older-batch" }, query: { pages: [editPage(undefined, {
      pageid: 42, revisions: Array.from({ length: 13 }, (_, index) => revision(22 - index))
    })] } },
    { query: { pages: [editPage(undefined, {
      pageid: 42, revisions: Array.from({ length: 11 }, (_, index) => revision(index))
    })] } },
  ], captured).getAllContributorEdits("Example", "Example Editor");
  assert.equal(result.edits.length, 23);
  assert.equal(result.totalCount, 23);
  assert.equal(result.hasMore, false);
  assert.equal(result.continuation, null);
  assert.deepEqual(result.edits.map(edit => edit.revid), Array.from({ length: 23 }, (_, index) => 2022 - index));
  assert.equal(captured[0].url.searchParams.get("rvlimit"), "500");
  assert.equal(captured[0].url.searchParams.get("rvdir"), "older");
  assert.equal(captured[0].url.searchParams.get("rvuser"), "Example Editor");
  assert.equal(captured[0].url.searchParams.has("rvcontinue"), false);
  assert.equal(captured[1].url.searchParams.get("rvcontinue"), "older-batch");
  assert.equal(captured[1].url.searchParams.get("continue"), "||");
});

test("complete contributor history accepts a filtered existing page with zero matches", async () => {
  const result = await clientWith({ query: { pages: [{ title: "Example", ns: 0 }] } })
    .getAllContributorEdits("Example", "Example Editor");
  assert.deepEqual(result, { edits: [], hasMore: false, totalCount: 0, continuation: null });
});

test("bounded history returns unknown totals and a safe continuation for a later chunk", async () => {
  const continuation = { continue: "||", rvcontinue: "older" };
  const partial = await sequencedClient([
    { continue: continuation, query: { pages: [editPage()] } },
  ]).getAllContributorEdits("Example", "Example Editor", { maxPages: 1 });
  assert.equal(partial.hasMore, true);
  assert.equal(partial.totalCount, null);
  assert.deepEqual(partial.continuation, continuation);
  const captured = [];
  const resumed = await sequencedClient([
    { query: { pages: [editPage(articleEdit({ revid: 1230, parentid: 1229 }))] } },
  ], captured).getAllContributorEdits("Example", "Example Editor", { continuation: partial.continuation });
  assert.equal(captured[0].url.searchParams.get("rvcontinue"), "older");
  assert.equal(resumed.hasMore, false);
  assert.equal(resumed.totalCount, null, "only the caller knows how many edits earlier chunks contained");
  assert.equal(resumed.continuation, null);
  assert.equal(resumed.edits[0].revid, 1230);
});

test("history continuation cannot override API parameters or contain malformed tokens", async () => {
  let calls = 0;
  const client = clientWith({}, { fetchImpl: async () => { calls++; throw new Error("Unexpected network"); } });
  for (const continuation of [
    {}, [], "older", { rvcontinue: "" }, { rvcontinue: 3 }, { rvcontinue: "bad\nvalue" },
    { rvcontinue: "older", action: "edit" }, { rvcontinue: "older", titles: "Other" },
    { rvcontinue: "older", continue: 3 }, { rvcontinue: "x".repeat(2049) },
    Object.create({ rvcontinue: "inherited" }),
  ]) await assert.rejects(client.getAllContributorEdits("Example", "Example Editor", { continuation }), errorCode("invalid-response"));
  for (const options of [null, [], "bad"]) await assert.rejects(client.getAllContributorEdits("Example", "Example Editor", options), errorCode("invalid-response"));
  for (const maxPages of [0, 21, 1.5, "20"]) await assert.rejects(client.getAllContributorEdits("Example", "Example Editor", { maxPages }), errorCode("invalid-response"));
  assert.equal(calls, 0);
  await assert.rejects(clientWith({ continue: { rvcontinue: "older", action: "edit" }, query: { pages: [editPage()] } })
    .getAllContributorEdits("Example", "Example Editor"), errorCode("invalid-response"));
});

test("repeated history continuations fail rather than looping or claiming a complete count", async () => {
  const repeated = { continue: "||", rvcontinue: "same-page" };
  await assert.rejects(sequencedClient([
    { continue: repeated, query: { pages: [editPage()] } },
    { continue: repeated, query: { pages: [editPage()] } },
  ]).getAllContributorEdits("Example", "Example Editor"), errorCode("incomplete-response"));
  await assert.rejects(sequencedClient([
    { continue: repeated, query: { pages: [editPage()] } },
  ]).getAllContributorEdits("Example", "Example Editor", { continuation: repeated }), errorCode("incomplete-response"));
});

test("every history page must identify the same article and contributor", async () => {
  const first = { continue: { rvcontinue: "older" }, query: { pages: [editPage(undefined, { pageid: 42 })] } };
  for (const badPage of [
    editPage(articleEdit({ user: "Other" }), { pageid: 42 }),
    editPage(), editPage(undefined, { pageid: 99 }), editPage(undefined, { ns: 1, pageid: 42 }),
    editPage(undefined, { title: "Other", pageid: 42 }),
    editPage(undefined, { missing: true, pageid: 42 }),
  ]) await assert.rejects(sequencedClient([structuredClone(first), { query: { pages: [badPage] } }])
    .getAllContributorEdits("Example", "Example Editor"));
  await assert.rejects(sequencedClient([first, {
    query: { redirects: [{ from: "Example", to: "Other" }], pages: [editPage(undefined, { title: "Other", pageid: 42 })] }
  }]).getAllContributorEdits("Example", "Example Editor"), errorCode("incomplete-response"));
});

test("article histories reject different, hidden, or malformed authors instead of misattributing edits", async () => {
  for (const revision of [articleEdit({ user: "Other" }), articleEdit({ user: "example editor" }), articleEdit({ userhidden: true }),
    articleEdit({ parentid: undefined }), articleEdit({ timestamp: "not a date" }), articleEdit({ revid: 0 })]) {
    await assert.rejects(clientWith({ query: { pages: [editPage(revision)] } }).getContributorEdits("Example", "Example Editor"), errorCode("invalid-response"));
  }
  for (const source of [editPage(undefined, { ns: 1 }), editPage(undefined, { missing: true }), editPage(undefined, { revisions: "bad" })]) {
    await assert.rejects(clientWith({ query: { pages: [source] } }).getContributorEdits("Example", "Example Editor"), errorCode("invalid-response"));
  }
  await assert.rejects(clientWith({ query: { pages: [editPage(undefined, { title: "Other" })] } }).getContributorEdits("Example", "Example Editor"), errorCode("incomplete-response"));
});

test("edit lookup validates API title/user boundaries and bounded limits before fetching", async () => {
  let calls = 0;
  const client = clientWith({}, { fetchImpl: async () => { calls++; throw new Error("Unexpected network"); } });
  for (const [title, user, limit] of [["Example|Other", "Editor", 10], ["Example", "Editor|Other", 10], ["", "Editor", 10], ["Example", "", 10], ["Example", "Editor", 0], ["Example", "Editor", 51]]) {
    await assert.rejects(client.getContributorEdits(title, user, limit), errorCode("invalid-response"));
  }
  await assert.rejects(client.getArticleEditDiff("Example", "Editor", "1234"), errorCode("invalid-response"));
  assert.equal(calls, 0);
});

test("table diffs show only changed source, including addition-only and deletion-only rows", () => {
  assert.deepEqual(parseDiffHtml(tableDiff), { changes: [
    { before: "Old word & text", after: "New word & text", beforeHighlights: [{ start: 0, end: 3 }], afterHighlights: [{ start: 0, end: 3 }] },
    { before: "", after: "Added source", afterHighlights: [{ start: 0, end: 12 }] },
    { before: "Removed source", after: "", beforeHighlights: [{ start: 0, end: 14 }] },
  ], truncated: false });
  assert.deepEqual(parseDiffHtml(""), { changes: [], truncated: false });
});

test("diff markup is stripped while encoded article markup remains inert plain text", () => {
  const html = `<tr><td class='diff-deletedline'><div>  &#x41;&#66; &lt;b&gt;old&lt;/b&gt;</div></td><td class=diff-addedline><div>&lt;img src=x onerror=alert(1)&gt;<br><script>alert('bad')</script><img src=x onerror=alert(2)>next&nbsp;line</div></td></tr>`;
  const result = parseDiffHtml(html);
  assert.equal(result.changes[0].before, "  AB <b>old</b>");
  assert.equal(result.changes[0].after, "<img src=x onerror=alert(1)>\nnext line");
  assert.equal(result.changes[0].after.includes("alert('bad')"), false);
});

test("diff previews enforce row/text bounds without presenting truncated source as complete", () => {
  const result = parseDiffHtml(tableDiff, { maxChanges: 2, maxTextLength: 5 });
  assert.equal(result.changes.length, 2);
  assert.deepEqual(result.changes[0], { before: "Old w", after: "New w", beforeHighlights: [{ start: 0, end: 3 }], afterHighlights: [{ start: 0, end: 3 }] });
  assert.equal(result.truncated, true);
});

test("article comparisons resolve the exact parent revision and use a separate readonly compare action", async () => {
  const captured = [];
  const result = await sequencedClient([{ query: { pages: [editPage()] } }, comparison()], captured)
    .getArticleEditDiff("Example", "Example Editor", 1234);
  assert.equal(captured[0].url.searchParams.get("revids"), "1234");
  assert.equal(captured[1].url.searchParams.get("action"), "compare");
  assert.equal(captured[1].url.searchParams.get("fromrev"), "1230");
  assert.equal(captured[1].url.searchParams.get("torev"), "1234");
  assert.equal(captured[1].url.searchParams.get("difftype"), "table");
  assert.ok(captured.every(call => call.options.credentials === "omit" && call.options.method === "GET"));
  assert.equal(result.user, "Example Editor");
  assert.equal(result.changes.length, 3);
});

test("article comparisons reject a user-page revision or another author before fetching a diff", async () => {
  for (const source of [editPage(undefined, { ns: 2 }), editPage(articleEdit({ user: "Other" })), editPage(articleEdit({ revid: 1235 }))]) {
    const calls = [];
    await assert.rejects(sequencedClient([{ query: { pages: [source] } }], calls).getArticleEditDiff("Example", "Example Editor", 1234), errorCode("invalid-response"));
    assert.equal(calls.length, 1);
  }
});

test("comparison response identities and hidden source must match the verified edit", async () => {
  for (const changed of [{ fromrevid: 1220 }, { torevid: 1235 }, { fromns: 2 }, { tons: 1 },
    { totitle: "Other" }, { fromtitle: "Other" }, { totexthidden: true }, { body: null }]) {
    await assert.rejects(sequencedClient([{ query: { pages: [editPage()] } }, comparison(changed)])
      .getArticleEditDiff("Example", "Example Editor", 1234), errorCode("invalid-response"));
  }
});

test("initial article creation compares empty text with the exact original source", async () => {
  const creation = articleEdit({ parentid: 0 });
  const original = { ...creation, slots: { main: { content: "Original article source" } } };
  const captured = [];
  const result = await sequencedClient([{ query: { pages: [editPage(creation)] } }, { query: { pages: [editPage(original)] } }], captured)
    .getArticleEditDiff("Example", "Example Editor", 1234);
  assert.ok(captured.every(call => call.url.searchParams.get("action") === "query"));
  assert.equal(captured[1].url.searchParams.get("revids"), "1234");
  assert.match(captured[1].url.searchParams.get("rvprop"), /content/);
  assert.deepEqual(result.changes, [{ before: "", after: "Original article source", afterHighlights: [{ start: 0, end: 23 }] }]);
  assert.equal(result.diffUrl, "https://en.wikipedia.org/wiki/Special:Diff/1234");
});

function inlineRow(before, after) {
  return `<tr><td class="diff-deletedline"><div>${before}</div></td><td class="diff-addedline"><div>${after}</div></td></tr>`;
}

test("a comma insertion highlights only the comma even if Wikipedia marks the whole token", () => {
  const result = parseDiffHtml(inlineRow(
    'He stepped down in <del class="diffchange diffchange-inline">2021</del> but remained chairman.',
    'He stepped down in <ins class="diffchange diffchange-inline">2021,</ins> but remained chairman.'
  ));
  const [change] = result.changes;
  assert.equal(change.before, "He stepped down in 2021 but remained chairman.");
  assert.equal(change.after, "He stepped down in 2021, but remained chairman.");
  assert.equal(change.beforeHighlights, undefined);
  assert.deepEqual(change.afterHighlights, [{ start: change.after.indexOf(","), end: change.after.indexOf(",") + 1 }]);
});

test("separated character changes preserve unchanged text between their highlights", () => {
  const [change] = parseDiffHtml(inlineRow("one cat and dog", "one bat and fog")).changes;
  assert.deepEqual(change.beforeHighlights, [{ start: 4, end: 5 }, { start: 12, end: 13 }]);
  assert.deepEqual(change.afterHighlights, [{ start: 4, end: 5 }, { start: 12, end: 13 }]);
  assert.deepEqual(parseDiffHtml(inlineRow("identical", "identical")).changes, [{ before: "identical", after: "identical" }]);
});

test("highlight positions decode entities and include whole Unicode characters", () => {
  const [emoji] = parseDiffHtml(inlineRow('A&#x1f600; B', 'A<span class="diffchange">&#x1f601;</span> B')).changes;
  assert.deepEqual(emoji.beforeHighlights, [{ start: 1, end: 3 }]);
  assert.deepEqual(emoji.afterHighlights, [{ start: 1, end: 3 }]);
  assert.equal(emoji.after.slice(1, 3), "😁");
  const [comma] = parseDiffHtml(inlineRow("😀 &amp; 2021 but", '😀 &amp; <ins class="diffchange">2021&#44;</ins> but')).changes;
  assert.equal(comma.beforeHighlights, undefined);
  assert.equal(comma.after.slice(comma.afterHighlights[0].start, comma.afterHighlights[0].end), ",");
});

test("clipped previews do not invent a deletion at the end after an early insertion", () => {
  const text = `x${"a".repeat(2000)}`;
  const result = parseDiffHtml(inlineRow(text, `x,${"a".repeat(2000)}`));
  assert.equal(result.truncated, true);
  assert.equal(result.changes[0].before.length, 1500);
  assert.equal(result.changes[0].after.length, 1500);
  assert.equal(result.changes[0].beforeHighlights, undefined);
  assert.deepEqual(result.changes[0].afterHighlights, [{ start: 1, end: 2 }]);
});

test("ranges stop at the displayed boundary and huge rewrites do not claim exact highlighting", () => {
  const clipped = parseDiffHtml(inlineRow("aa OLD", "aa xyzxyz"), { maxTextLength: 5 });
  assert.deepEqual(clipped.changes[0].beforeHighlights, [{ start: 3, end: 5 }]);
  assert.deepEqual(clipped.changes[0].afterHighlights, [{ start: 3, end: 5 }]);
  assert.equal(clipped.truncated, true);
  const huge = parseDiffHtml(inlineRow("a".repeat(2000), "b".repeat(2000)));
  assert.equal(huge.truncated, true);
  assert.equal(huge.changes[0].beforeHighlights, undefined);
  assert.equal(huge.changes[0].afterHighlights, undefined);
});

test("display clipping never splits a highlighted Unicode surrogate pair", async () => {
  const preview = parseDiffHtml(inlineRow("A😀X", "A😁X"), { maxTextLength: 2 });
  assert.deepEqual(preview, { changes: [{ before: "A", after: "A" }], truncated: true });
  const creation = articleEdit({ parentid: 0 });
  const original = { ...creation, slots: { main: { content: `${"a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1)}😀` } } };
  const result = await sequencedClient([{ query: { pages: [editPage(creation)] } }, { query: { pages: [editPage(original)] } }])
    .getArticleEditDiff("Example", "Example Editor", 1234);
  assert.equal(result.changes[0].after, "a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1));
  assert.deepEqual(result.changes[0].afterHighlights, [{ start: 0, end: ARTICLE_DIFF_TEXT_LIMIT - 1 }]);
  assert.equal(result.truncated, true);
});

test("article diff retrieval retains a full ordinary paragraph and changes beyond the old preview boundary", async () => {
  const before = `${"a".repeat(1800)} target ${"z".repeat(900)}`;
  const after = before.replace("target", "target,");
  const result = await sequencedClient([{ query: { pages: [editPage()] } }, comparison({ body: inlineRow(before, after) })])
    .getArticleEditDiff("Example", "Example Editor", 1234);
  const [change] = result.changes;
  assert.equal(change.before, before);
  assert.equal(change.after, after);
  assert.ok(change.after.length > 1500);
  assert.deepEqual(change.afterHighlights, [{ start: after.indexOf(","), end: after.indexOf(",") + 1 }]);
  assert.equal(result.truncated, false);
});

test("article diff retrieval bounds very long paragraphs without splitting surrogate pairs", async () => {
  const before = `${"a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1)}😀 tail`;
  const after = `${"a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1)}😁 tail`;
  const result = await sequencedClient([{ query: { pages: [editPage()] } }, comparison({ body: inlineRow(before, after) })])
    .getArticleEditDiff("Example", "Example Editor", 1234);
  assert.equal(result.changes[0].before, "a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1));
  assert.equal(result.changes[0].after, "a".repeat(ARTICLE_DIFF_TEXT_LIMIT - 1));
  assert.equal(result.changes[0].beforeHighlights, undefined);
  assert.equal(result.changes[0].afterHighlights, undefined);
  assert.equal(result.truncated, true);
});

test("initial creation retains full source up to the paragraph expansion bound", async () => {
  const creation = articleEdit({ parentid: 0 });
  const source = `${"Article source. ".repeat(200)}😀`;
  const original = { ...creation, slots: { main: { content: source } } };
  const result = await sequencedClient([{ query: { pages: [editPage(creation)] } }, { query: { pages: [editPage(original)] } }])
    .getArticleEditDiff("Example", "Example Editor", 1234);
  assert.equal(result.changes[0].after, source);
  assert.deepEqual(result.changes[0].afterHighlights, [{ start: 0, end: source.length }]);
  assert.equal(result.truncated, false);
});
