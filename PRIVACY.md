# Wikipaidia Privacy Policy

Effective date: October 30, 2026

This policy describes Wikipaidia desktop version 0.11.0 for Safari, Google Chrome,
and Microsoft Edge. Wikipaidia helps readers find publicly disclosed paid
involvement and conflict-of-interest notices on English Wikipedia.

## Information used to check an article

After you allow access to English Wikipedia, Wikipaidia reads the current article
title and requests public information directly from the English Wikipedia API at
`https://en.wikipedia.org/w/api.php`. A basic check reads the article and its talk
page. Choosing **Check more sources** also requests selected talk archives and
public user pages, using contributors named in notices and recent article history
to select those pages.

Opening the evidence panel can request contributors' public article edit history,
revision comparisons, and current account-block information. These requests can
include article, talk-page, and user-page titles, contributor usernames, and
revision identifiers. The returned information includes public disclosure text,
contributor and employer names, edit details, and links to source revisions.
Wikipaidia uses it to display the requested evidence and edit previews locally in
your browser. The extension does not publish edits, comments, or messages to
Wikipedia.

## Requests to Wikimedia

Automated API requests use HTTPS and omit cookies, login credentials, and browser
referrer information. They identify the Wikipaidia client to the API. They do not
require you to sign in to Wikipedia or provide a Wikipaidia account.

Wikimedia still receives the requested titles and identifiers, your IP address,
and ordinary connection and browser information associated with a network
request. Omitting login credentials does not make these requests anonymous.
Wikimedia handles information it receives under its own
[privacy policy](https://foundation.wikimedia.org/wiki/Policy:Privacy_policy).

Opening an evidence or source link is an ordinary Wikipedia page visit. Your
browser's normal settings and Wikipedia login state may apply to that visit.

Evidence links can include a `#wikipaidia-source=…` fragment identifying the source
page and revision, editor, evidence type, template, article, and section. On that
source page, Wikipaidia reads the rendered page and the fragment locally to
highlight the matching notice and scroll it into view. This highlighting does
not make additional API requests.

The fragment is part of the link address. Browsers do not include URL fragments
in the HTTP page request, but the visited page can read its own fragment. The
complete address may be retained in browser history or saved links according to
your browser settings and actions.

## Information stored in your browser

Wikipaidia saves your alert style (**Banner** or **Page Tint**) and alert color in
local extension storage so they can be used across articles and browser restarts.
These preferences remain until the extension's stored data is cleared.

When browser session storage is available, Wikipaidia can keep up to 30 recent
scan results there. A cached result may be reused for up to 15 minutes. The cache
can contain checked article titles, public evidence, source links, and check
timestamps. The 15-minute limit controls reuse; expired entries may remain until
they are replaced or the browser session ends. Session storage is cleared when
the browser session ends. The panel also holds fetched information in memory
while its page is open.

## Analytics, sharing, and permissions

Wikipaidia has no account system or backend service and does not send browsing
activity or usage reports to the project's maintainers. It does not use analytics,
advertising, tracking identifiers, telemetry, or remote AI services. It does not
sell personal information or share information for advertising.

The extension requests access only to `https://en.wikipedia.org/*` and the
browser's `storage` permission. Website access lets it check English Wikipedia
articles, add its alert and evidence panel, and highlight notices on linked source
pages. Storage supports preferences and the temporary cache described above. It
does not request access to other sites or the browser's browsing-history database.

You can stop new checks by disabling Wikipaidia or revoking its English Wikipedia
access in your browser's extension settings. Your browser controls clearing and
removal of extension storage.

## Contact

For privacy questions, contact Wikipaidia at
[contact@michaeljasonhoward.com](mailto:contact@michaeljasonhoward.com).
You can also use the project's
[GitHub issues](https://github.com/distrbnce/Wikipaidia/issues). Issues are public;
avoid posting private information there. Information you choose to send by email
or post on GitHub is separate from the extension's automatic operation and is used
to respond to your request.
