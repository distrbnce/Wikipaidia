# Wikipaidia support

For help, email [contact@michaeljasonhoward.com](mailto:contact@michaeljasonhoward.com)
or [open a GitHub issue](https://github.com/distrbnce/Wikipaidia/issues).
Publisher: **Michael Howard**.
The [project repository](https://github.com/distrbnce/Wikipaidia) contains source
code, release downloads and installation documentation.

## Enable the extension

Wikipaidia works on desktop Safari for macOS, Google Chrome and Microsoft Edge.
It reads recognized public disclosures on English Wikipedia.

- **Safari on Mac:** after installing the containing app, open it once. In
  **Safari → Settings → Extensions**, enable Wikipaidia and allow access to
  **en.wikipedia.org**. Grant website access from the Safari toolbar if requested,
  then reload the article.
- **Edge:** open **Extensions → Manage extensions**, enable Wikipaidia and allow
  access to **en.wikipedia.org**. Show its button in the toolbar if needed, then
  reload the article.
- **Chrome:** open **Extensions → Manage extensions**, enable Wikipaidia and allow
  access to **en.wikipedia.org**. Pin its button in the toolbar if needed, then
  reload the article.

For developer-loaded release ZIPs, extract the Chrome or Edge ZIP and use
**Load unpacked** on `chrome://extensions` or `edge://extensions`. Safari's local
temporary-extension and native-app instructions are in
[SAFARI.md](https://github.com/distrbnce/Wikipaidia/blob/main/SAFARI.md).
GitHub developer downloads and store installation are different distribution
methods; follow the instructions for the copy you installed.

## Try a public example

After granting website access, visit [BP](https://en.wikipedia.org/wiki/BP),
[Vivek Ramaswamy](https://en.wikipedia.org/wiki/Vivek_Ramaswamy) or
[Subway](https://en.wikipedia.org/wiki/Subway_(restaurant)). A recognized paid
disclosure can add a page alert. Click the alert or Wikipaidia's toolbar button
to open the evidence panel and follow an evidence/source link. The saved source
page highlights the matching editor entry or notice and scrolls it into view. If
it cannot locate the match, it shows a short status message. These are live public
pages, so notices and results can change. The source-page update date does not
state when a paid relationship began.

In the panel header, choose **Banner** or **Page Tint** and an alert color.
**Check more sources** checks an additional bounded set of archives and public
user pages. A lack of recognized findings does not establish that an article has
no paid involvement. The extension does not detect undisclosed payments or prove
that particular current sentences were paid for.

## If something does not work

1. Confirm you are on an article at `https://en.wikipedia.org/` and have enabled
   the extension's website permission.
2. Reload the article after enabling access or updating the extension. Click the
   toolbar button even if no page alert appears.
3. Confirm Wikipedia is reachable. Rate limits and network failures can prevent
   source checks; allow time before retrying if a rate-limit message appears.
4. For a report, include your browser and operating system versions, Wikipaidia
   version, article URL, expected result, actual result and steps to reproduce.
   A screenshot and exact source-revision link can help. Do not send passwords,
   session cookies or other private information.

Wikipaidia sends public article/source titles to Wikipedia to retrieve disclosures
and edit information; its API requests omit Wikipedia login credentials.
Preferences stay in your browser. Up to 30 recent scan results may be kept in
browser session storage and reused for up to 15 minutes. That limit controls
reuse, not deletion: older entries may remain until replaced or the session ends.
Opening an evidence/source link is a normal Wikipedia visit, subject to your
browser settings and Wikipedia login state. Its link fragment can remain in your
history or saved links and is read to highlight the matching notice without an
additional API request. The extension has no publisher backend, telemetry or
analytics. Read the [privacy policy](https://github.com/distrbnce/Wikipaidia/blob/main/PRIVACY.md)
for details.
