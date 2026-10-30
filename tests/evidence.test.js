import assert from "node:assert/strict";
import test from "node:test";
import { analyzePage } from "../extension/evidence.js";

function analyze(wikitext, overrides = {}) {
  return analyzePage({
    title: "Talk:Example", articleTitle: "Example", role: "talk", revid: 1234,
    timestamp: "2026-10-30T12:00:00Z", wikitext, ...overrides,
  });
}

test("extracts multiple paid relationships without assigning a paid revision", () => {
  const result = analyze(`{{Connected contributor (paid)
    |User1=Alice |U1-employer=[[Acme|Acme Ltd]] |U1-client=Example |U1-EH=yes
    |User2=Bob |U2-employer=Agency |U2-client=Example |U2-EH=no}}`);
  assert.equal(result.length, 2);
  assert.equal(result[0].contributor, "Alice");
  assert.equal(result[0].employer, "Acme Ltd");
  assert.equal(result[0].employerUrl, "https://en.wikipedia.org/wiki/Acme");
  assert.equal(result[0].client, "Example");
  assert.equal(result[0].directEdit, true);
  assert.equal(result[1].directEdit, false);
  assert.equal(result[0].relationship, "page-notice");
  assert.match(result[0].summary, /paid revisions not verified/);
  assert.match(result[1].summary, /edits or accepted requests not verified/);
  assert.equal(result[0].sourceRevision, 1234);
  assert.equal(new URL(result[0].sourceUrl).searchParams.get("oldid"), "1234");
  assert.notEqual(result[0].id, result[1].id);
  assert.doesNotMatch(result[0].excerpt, /Bob|Agency/);
  assert.doesNotMatch(result[1].excerpt, /Alice|Acme/);
});

test("employer and client links preserve explicit destinations instead of display labels", () => {
  const [item] = analyze(`{{Connected contributor (paid)|User1=Alice
    |U1-employer=[[Acme Corporation|Acme]]|U1-client=[[Example#Paid work|the client]]}}`);
  assert.equal(item.employer, "Acme");
  assert.equal(item.employerUrl, "https://en.wikipedia.org/wiki/Acme_Corporation");
  assert.equal(item.client, "the client");
  assert.equal(item.clientUrl, "https://en.wikipedia.org/wiki/Example#Paid_work");
  const [profile] = analyze("{{Paid|employer=[[Agency|Agency Ltd]]|client=[[Example]]|article=Example}}", {
    role: "user", title: "User:Alice"
  });
  assert.equal(profile.employerUrl, "https://en.wikipedia.org/wiki/Agency");
  assert.equal(profile.clientUrl, "https://en.wikipedia.org/wiki/Example");
});

test("plain or ambiguous employer names do not manufacture a destination", () => {
  for (const employer of ["Vivek Ramaswamy", "[[Alice]] and [[Bob]]", "<nowiki>[[Example]]</nowiki>", "<!-- [[Example]] -->Agency"]) {
    const [item] = analyze(`{{Connected contributor (paid)|User1=Alice|U1-employer=${employer}}}`);
    assert.equal(item.employerUrl, undefined);
  }
});

test("employer links reject external routes and interwiki or protocol redirects", () => {
  for (const employer of [
    "[[fr:Example|Agency]]", "[[javascript:alert(1)|Agency]]", "[[https://example.com/|Agency]]",
    "[[//en.wikipedia.org/wiki/Example|Agency]]", "[[data:text/html,example|Agency]]",
    "[https://example.com/ Agency]", "[[UnknownPrefix:Example|Agency]]",
    "[[https://name:secret@en.wikipedia.org/wiki/Example|Agency]]"
  ]) {
    const [item] = analyze(`{{Connected contributor (paid)|User1=Alice|U1-employer=${employer}}}`);
    assert.equal(item.employerUrl, undefined, employer);
  }
});

test("multiuser disclosures keep excerpts and supporting links with their own contributor", () => {
  const [first, second] = analyze(`{{Connected contributor (paid)
    |User1=FinalFrontier.003|U1-employer=Vivek Ramaswamy|U1-client=|U1-EH=|U1-banned=yes
    |U1-otherlinks=Freelancer; disclosed [https://en.wikipedia.org/w/index.php?title=User%3AFinalFrontier.003&type=revision&diff=868618238&oldid=866595107 here]
    |User2=Jhofferman|U2-employer=Vivek Ramaswamy|U2-client=|U2-EH=|U2-banned=
    |U2-otherlinks=Freelancer; disclosed [https://en.wikipedia.org/wiki/User:Jhofferman here]}}`, {
    title: "Talk:Vivek Ramaswamy", articleTitle: "Vivek Ramaswamy",
    revid: 1382659279, timestamp: "2026-10-29T13:00:00Z",
  });
  assert.equal(first.contributor, "FinalFrontier.003");
  assert.equal(second.contributor, "Jhofferman");
  assert.doesNotMatch(first.excerpt, /Jhofferman|User2|U2-/);
  assert.doesNotMatch(second.excerpt, /FinalFrontier|User1|U1-/);
  assert.match(first.excerpt, /Notes: Freelancer; disclosed here/);
  assert.equal(first.disclosureLinks.length, 1);
  assert.equal(second.disclosureLinks.length, 1);
  assert.equal(first.disclosureLinks[0].label, "Disclosure");
  assert.equal(second.disclosureLinks[0].label, "Disclosure");
  assert.equal(new URL(first.disclosureLinks[0].url).searchParams.get("diff"), "868618238");
  assert.equal(new URL(first.disclosureLinks[0].url).searchParams.get("title"), "User:FinalFrontier.003");
  assert.equal(second.disclosureLinks[0].url, "https://en.wikipedia.org/wiki/User:Jhofferman");
  // These dates identify the same source snapshot, not two inferred event dates.
  assert.equal(first.sourceRevision, 1382659279);
  assert.equal(second.sourceRevision, first.sourceRevision);
  assert.equal(first.sourceTimestamp, "2026-10-29T13:00:00Z");
  assert.equal(second.sourceTimestamp, first.sourceTimestamp);
  assert.equal(first.editDate, undefined);
  assert.equal(first.disclosureDate, undefined);
  assert.equal(first.paidRevision, undefined);
});

test("supporting disclosure links accept local diffs and permalinks without promoting them to edits", () => {
  const [item] = analyze(`{{Connected contributor (paid)|User1=Alice|U1-employer=Acme
    |U1-otherlinks=[[Special:Diff/12345|Declaration]] and [[Special:Permalink/45678#Paid work|here]]
      [https://en.wikipedia.org/wiki/User:Alice?x=1&amp;y=2 here]}}`);
  assert.deepEqual(item.disclosureLinks.map(link => link.label), ["Declaration", "Disclosure", "Disclosure"]);
  assert.equal(new URL(item.disclosureLinks[0].url).pathname, "/wiki/Special%3ADiff%2F12345");
  assert.equal(new URL(item.disclosureLinks[1].url).hash, "#Paid_work");
  assert.equal(new URL(item.disclosureLinks[2].url).searchParams.get("y"), "2");
  assert.equal(item.directEdit, undefined);
});

test("supporting links exclude other sites, credentials, untrusted protocols, examples, and duplicates", () => {
  const [item] = analyze(`{{Connected contributor (paid)|User1=Alice|U1-employer=Acme
    |U1-otherlinks=[https://example.com/ offsite]
      [https://en.wikipedia.org.evil.example/wiki/User:Alice fake]
      [https://name:secret@en.wikipedia.org/wiki/User:Alice credentials]
      [https://en.wikipedia.org:444/wiki/User:Alice port]
      [http://en.wikipedia.org/wiki/User:Alice insecure]
      [//en.wikipedia.org/wiki/User:Alice relative]
      [[javascript:alert(1)|script]] [[fr:User:Alice|interwiki]]
      <!-- [https://en.wikipedia.org/wiki/User:Hidden hidden] -->
      <nowiki>[https://en.wikipedia.org/wiki/User:Example example]</nowiki>
      [https://en.wikipedia.org/wiki/User:Alice Declaration]
      [https://en.wikipedia.org/wiki/User:Alice repeated]}}`);
  assert.deepEqual(item.disclosureLinks, [{ label: "Declaration", url: "https://en.wikipedia.org/wiki/User:Alice" }]);
});

test("connected COI contributors also receive their own notes without payment claims", () => {
  const [alice, bob] = analyze(`{{Connected contributor|User1=Alice|U1-otherlinks=[[User:Alice|Declaration]]
    |User2=Bob|U2-otherlinks=Bob's note}}`);
  assert.equal(alice.kind, "coi");
  assert.equal(bob.kind, "coi");
  assert.equal(alice.disclosureLinks.length, 1);
  assert.doesNotMatch(alice.excerpt, /Bob/);
  assert.doesNotMatch(bob.excerpt, /Alice/);
  assert.equal(bob.disclosureLinks, undefined);
});

test("preserves balanced nested templates, links, and equals inside field values", () => {
  const [item] = analyze(`{{Template:Connected_contributor_(paid)
    |User1={{u|Alice}}
    |U1-employer=[[Acme|{{nowrap|Acme &amp; Company}}]]
    |U1-client=[[Example|Example = client]]
    |U1-otherlinks=[https://example.com/?x=y Discussion]}}`);
  assert.equal(item.contributor, "Alice");
  assert.equal(item.employer, "Acme & Company");
  assert.equal(item.client, "Example = client");
});

test("ignores comments, literal tags, and malformed incomplete templates", () => {
  const paid = "{{Connected contributor (paid)|User1=Alice|U1-employer=Acme}}";
  for (const source of [
    `<!-- ${paid} -->`, `<nowiki>${paid}</nowiki>`, `<pre>${paid}</pre>`,
    `<code>${paid}</code>`, `<syntaxhighlight lang="wikitext">${paid}</syntaxhighlight>`,
    `<source>${paid}</source>`, `<nowiki>${paid}`, `${paid.slice(0, -2)}`,
    `{{#if:|${paid}}}`, `{{tl|${paid}}}`, `{{{unused|${paid}}}}`,
  ]) assert.deepEqual(analyze(source), [], source);
});

test("a comment inside a real notice does not corrupt its fields", () => {
  const [item] = analyze("{{Connected contributor (paid)|User1=Alice<!--note-->|U1-employer=Acme}}");
  assert.equal(item.contributor, "Alice");
  assert.equal(item.employer, "Acme");
});

test("separates payment notices, allegations, and general COI inside multiple issues", () => {
  const result = analyze("{{Multiple issues|{{Paid contributions|date=October 2026}}{{UDP}}{{COI}}}}", {
    role: "article", title: "Example",
  });
  assert.deepEqual(result.map((item) => item.kind), ["paid-notice", "concern", "coi"]);
  assert.match(result[1].summary, /Not independently verified/);
  assert.match(result[2].summary, /payment not established/);
});

test("an answered COI edit request is neither paid evidence nor proof of implementation", () => {
  const [item] = analyze("{{edit COI|answered=yes}} Proposed edits.");
  assert.equal(item.kind, "coi");
  assert.equal(item.directEdit, undefined);
  assert.match(item.summary, /Payment and implementation not established/);
});

test("general connected contributor notices remain nonpaid", () => {
  const [item] = analyze("{{Connected contributor|User1=Alice|U1-declared=yes|U1-employer=Acme}}");
  assert.equal(item.kind, "coi");
  assert.equal(item.contributor, "Alice");
});

test("legacy lowercase COI parameters restore named editors and declared connection links", () => {
  const [declared, possible] = analyze("{{Connected contributor|user=CommanderMaque|declared=1148811414|User2=71.67.84.234}}", {
    title: "Talk:Vivek Ramaswamy", articleTitle: "Vivek Ramaswamy", revid: 1382659279
  });
  assert.equal(declared.contributor, "CommanderMaque");
  assert.equal(declared.coiType, "connected-contributor");
  assert.equal(declared.declarationStatus, "declared");
  assert.equal(declared.sourceRole, "talk");
  assert.match(declared.connection, /A connection is declared/);
  assert.match(declared.connection, /does not specify the relationship/);
  assert.deepEqual(declared.disclosureLinks, [{ label: "Declared connection", url: "https://en.wikipedia.org/wiki/Special:Diff/1148811414" }]);
  assert.equal(possible.contributor, "71.67.84.234");
  assert.equal(possible.declarationStatus, "unspecified");
  assert.match(possible.connection, /possible personal or professional connection/);
  assert.equal(possible.disclosureLinks, undefined);
  assert.equal(declared.kind, "coi");
  assert.equal(possible.kind, "coi");
});

test("COI relationship notes and declared states remain scoped to each contributor", () => {
  const [alice, bob] = analyze(`{{Connected contributor|user=Alice|declared=yes|otherlinks=I am the subject's sister.
    |User2=Bob|U2-declared=no|U2-otherlinks=Works for the subject's company.}}`);
  assert.equal(alice.declarationStatus, "declared");
  assert.match(alice.connection, /subject's sister/);
  assert.doesNotMatch(alice.connection, /company/);
  assert.equal(bob.declarationStatus, "not-declared");
  assert.match(bob.connection, /Works for the subject's company/);
  assert.doesNotMatch(bob.connection, /sister/);
  assert.equal(alice.kind, "coi");
  assert.equal(bob.kind, "coi");
});

test("article COI notices explain what is unknown instead of inventing a relationship", () => {
  const [item] = analyze("{{COI|date=October 2026}}", { title: "Example", role: "article" });
  assert.equal(item.coiType, "article-notice");
  assert.match(item.connection, /cleanup notice/);
  assert.match(item.connection, /no specific editor or relationship/);
  assert.equal(item.contributor, undefined);
  assert.equal(item.sourceRole, "article");
});

test("COI requests receive section-specific context and do not inherit unrelated replies", () => {
  const [item] = analyze(`== Career section ==
{{edit COI|summary=Correct the employment dates|D|Per [[WP:V]].}}
I propose correcting the start date from 2010 to 2011. [[User:Requester|Requester]] 12:00, 1 January 2020 (UTC)
: The reviewer says this needs another source. [[User:Reviewer|Reviewer]]
== Other discussion ==
An unrelated editor discusses another issue.`, { role: "archive", title: "Talk:Example/Archive 1" });
  assert.equal(item.coiType, "edit-request");
  assert.equal(item.requestSummary, "Correct the employment dates");
  assert.equal(item.requestSummaryExplicit, true);
  assert.equal(item.sectionTitle, "Career section");
  assert.match(item.sectionUrl, /oldid=1234#Career_section$/);
  assert.equal(item.requestStatus, "declined");
  assert.equal(item.requestReason, "Per WP:V.");
  assert.match(item.contextExcerpt, /correcting the start date/);
  assert.doesNotMatch(item.contextExcerpt, /reviewer says|unrelated editor/);
  assert.equal(item.contributor, undefined);
  assert.equal(item.sourceRole, "archive");
  assert.equal(item.sourceTimestamp, "2026-10-30T12:00:00Z");
  assert.equal(item.requestDate, undefined);
});

test("request status follows documented template modes without treating answered as implemented", () => {
  const cases = [
    ["A", "answered"], ["answered", "answered"], ["D", "declined"],
    ["D|A", "proceed"], ["G", "proceed"], ["P", "partial"], ["U", "under-review"],
    ["R|answered=yes", "open"], ["N", "open"], ["answered=yes", "answered"],
    ["ans=y", "answered"], ["answered=|ans=yes", "open"], ["", "open"]
  ];
  for (const [parameters, expected] of cases) {
    const [item] = analyze(`{{edit COI|${parameters}}}`);
    assert.equal(item.requestStatus, expected, parameters);
    assert.equal(item.kind, "coi");
    assert.equal(item.implemented, undefined);
    assert.equal(item.paidRevision, undefined);
  }
});

test("multiple requests in one discussion keep their own local excerpts", () => {
  const result = analyze(`== New edit request ==
{{edit COI|D}}Please add the hepatitis research context.
: Declined by a reviewer.
{{edit COI|A}}I was asked to update publications and books.
: Please make a specific request.
== Next section ==
Other text.`);
  assert.equal(result.length, 2);
  assert.equal(result[0].requestStatus, "declined");
  assert.equal(result[1].requestStatus, "answered");
  assert.equal(result[0].sectionUrl, result[1].sectionUrl);
  assert.match(result[0].contextExcerpt, /hepatitis research/);
  assert.doesNotMatch(result[0].contextExcerpt, /publications|reviewer/);
  assert.match(result[1].contextExcerpt, /publications and books/);
  assert.doesNotMatch(result[1].contextExcerpt, /hepatitis|specific request/);
});

test("section anchors ignore literal examples and distinguish repeated headings", () => {
  const result = analyze(`<nowiki>== False section ==</nowiki>
== Edit request ==
{{edit COI|summary=First request}}
${"Request context ".repeat(60)}
<!-- == Fake section == -->
== Edit request ==
{{edit COI|ans=yes|summary=Second request}}
A shorter second request.`);
  assert.equal(result[0].sectionTitle, "Edit request");
  assert.match(result[0].sectionUrl, /#Edit_request$/);
  assert.match(result[1].sectionUrl, /#Edit_request_2$/);
  assert.equal(result[0].contextExcerpt.length, 350);
  assert.equal(result[1].requestSummary, "Second request");
  assert.equal(result[0].end, undefined);
});

test("reply subsection headings do not become inferred request dates or misleading topic summaries", () => {
  const [item] = analyze(`== New edit request ==
=== Reply 16-APR-2019 ===
Older discussion.
{{edit COI|A}}
I have been asked to update my previous paid work. [[User:Example]] 06:18, 1 February 2023 (UTC)`);
  assert.equal(item.requestSummary, "New edit request");
  assert.equal(item.requestSummaryExplicit, false);
  assert.equal(item.topicTitle, "New edit request");
  assert.equal(item.sectionTitle, "Reply 16-APR-2019");
  assert.match(item.sectionUrl, /#Reply_16-APR-2019$/);
  assert.equal(item.requestDate, undefined);
  assert.match(item.contextExcerpt, /February 2023/);
});

test("known live template redirects preserve the distinction between disclosures and concerns", () => {
  const [paid] = analyze("{{Connpaid|User=Alice|U1-employer=Acme|editedhere=yes}}");
  assert.equal(paid.kind, "paid-disclosure");
  assert.equal(paid.directEdit, true);
  const [concern] = analyze("{{Paid edit}}", { role: "article", title: "Example" });
  assert.equal(concern.kind, "concern");
  const [coi] = analyze("{{Request edit|answered=yes}}");
  assert.equal(coi.kind, "coi");
});

test("template parameter case and actual contributor link targets are respected", () => {
  assert.deepEqual(analyze("{{Connected contributor (paid)|USER1=Alice|U1-employer=Acme}}"), []);
  const [item] = analyze("{{Connected contributor (paid)|User1=[[User:Alice|Someone else]]|employer=Acme}}");
  assert.equal(item.contributor, "Alice");
  assert.equal(item.employer, undefined);
});

test("empty paid notices and prose mentions are not payment findings", () => {
  for (const source of [
    "{{Connected contributor (paid)}}", "We should check whether Alice is a paid editor.",
    "Alice has never been paid to edit this page.", "{{Pay|date=October 2026}}",
  ]) assert.deepEqual(analyze(source), []);
});

test("user-page payment must explicitly cover the requested article", () => {
  const user = { role: "user", title: "User:Alice" };
  assert.deepEqual(analyze("{{Paid|employer=Example|some=yes}}", user), []);
  assert.deepEqual(analyze("{{Paid|employer=Acme|article=Other}}", user), []);
  const [item] = analyze("{{Paid|employer=Acme|article=[[Example|this article]]|some=yes}}", user);
  assert.equal(item.kind, "paid-disclosure");
  assert.equal(item.contributor, "Alice");
  assert.deepEqual(item.articles, ["Example"]);
  assert.match(item.summary, /Paid revisions and surviving text not verified/);
});

test("uses link destinations rather than misleading labels for article scope", () => {
  assert.deepEqual(analyze("{{Paid|employer=Acme|article=[[Other|Example]]}}", {
    role: "user", title: "User:Alice",
  }), []);
});

test("scopes a visible userbox paid-article list and ignores unused list arguments", () => {
  const source = "{{Paid|employer=Agency|userbox=yes|list=yes|articles=\n* [[Other]]\n* [[Example]]\n}}";
  const [item] = analyze(source, { role: "user", title: "User:Alice/Paid work" });
  assert.deepEqual(item.articles, ["Other", "Example"]);
  assert.equal(item.contributor, "Alice");
  assert.deepEqual(analyze(source.replace("userbox=yes", "userbox=no"), {
    role: "user", title: "User:Alice",
  }), []);
});

test("article title matching handles underscores and fragments without substring matching", () => {
  const user = { role: "user", title: "User:Alice", articleTitle: "Example Corporation" };
  assert.equal(analyze("{{Paid|employer=Acme|article=[[Example_Corporation#History]]}}", user).length, 1);
  assert.deepEqual(analyze("{{Paid|employer=Acme|article=Example Corporation International}}", user), []);
});

test("does not read user disclosures in unrelated namespaces or article notices on talk pages", () => {
  assert.deepEqual(analyze("{{Paid|employer=Acme|article=Example}}"), []);
  assert.deepEqual(analyze("{{Paid contributions}}{{Undisclosed paid}}{{COI}}"), []);
  assert.deepEqual(analyze("{{Connected contributor (paid)|User1=Alice|U1-employer=Acme}}", {
    role: "article", title: "Example",
  }), []);
});

test("archive evidence keeps its archive source and bounded plain-text excerpt", () => {
  const [item] = analyze(`{{Connected contributor (paid)|User1=Alice|U1-employer=Acme|U1-otherlinks=${"Details ".repeat(150)}}}`, {
    role: "archive", title: "Talk:Example/Archive 1", revid: undefined,
  });
  assert.equal(item.sourceTitle, "Talk:Example/Archive 1");
  assert.match(item.sourceUrl, /Talk%3AExample%2FArchive_1$/);
  assert.ok(item.excerpt.length <= 601);
  assert.match(item.excerpt, /…$/);
});

test("invalid input and unsupported templates do not fabricate evidence", () => {
  assert.deepEqual(analyzePage({ title: "Example", wikitext: null, articleTitle: "Example" }), []);
  assert.deepEqual(analyze("{{undisclosed paid/doc}}{{paid/doc}}"), []);
});
