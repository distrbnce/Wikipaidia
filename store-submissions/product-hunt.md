# Product Hunt launch — Wikipaidia

Prepared November 2, 2026. Use Michael Howard's personal Product Hunt account.
Keep the launch in draft while Safari App Review is pending. This file is launch
preparation, not evidence that a Product Hunt draft has been saved or published.
The browser currently requires the owner to sign in before a draft can be saved.

## Listing copy and media

Exact form values and the maker comment are in
[product-hunt/listing.json](product-hunt/listing.json). The comment credits
[Pablo Torre Finds Out at 27:45](https://youtu.be/SzgQWv71a2E?t=1665), explains the
extension's limits, and invites product feedback.

| Field | Value |
| --- | --- |
| Name | Wikipaidia |
| Tagline | See paid-editing disclosures on Wikipedia |
| Primary URL | https://github.com/distrbnce/Wikipaidia |
| Pricing | Free |
| Role | I made this |
| Suggested topics | Open Source; Chrome Extensions; Productivity — select matching live topics |
| Logo | [240×240 PNG](product-hunt/assets/logo-240.png) |
| Gallery 1 | [Evidence panel and edit comparisons](product-hunt/assets/01-evidence-and-edits.png) |
| Gallery 2 | [Page alert](product-hunt/assets/02-banner.png) |
| Gallery 3 | [Page tint](product-hunt/assets/03-page-tint.png) |

The gallery images are 1270×760. They proportionally scale the existing real
extension-interface captures with navy padding at the sides, without cropping
or retouching the screenshot contents. The images visibly identify the fictional
example data. They are Chromium fixture captures, not branded Safari or Edge
captures. Source and output hashes are recorded in
[assets.json](product-hunt/assets/assets.json).

Regenerate from the existing store assets:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/wikipaidia-playwright node scripts/prepare-product-hunt-assets.mjs
```

Alternatively, use installed Google Chrome with an isolated temporary profile:

```sh
PRODUCT_HUNT_BROWSER_CHANNEL=chrome node scripts/prepare-product-hunt-assets.mjs
```

Use a product demonstration in the optional video field if one is prepared. The
inspiration episode belongs in the maker comment; it is not a product demo.

## Availability to check before scheduling

- The public GitHub release was verified as **v0.10.0** on November 2; its three
  browser ZIPs are public. Current repository source and these launch images are
  **v0.11.0**. Publish and verify matching v0.11.0 release downloads before using
  them as the launch's installation links.
- Chrome and Edge currently require the README's developer-loading instructions.
  Do not imply Chrome Web Store or Microsoft Edge Add-ons availability.
- Safari **0.11.0 (3)** was submitted November 2 and is **Waiting for Review**.
  Add the public App Store link only once Apple approves and the listing is live.
- Update the maker comment's availability paragraph when distribution changes.
- Open the final links and complete a clean installation before scheduling.

## Draft workflow

Sign in, click Submit, enter the repository URL, and check for an existing product
before creating a new one. Enter the listing copy, logo, three gallery images,
free pricing, relevant topics and maker role. Add the first comment and repository
link in the open-source company information if the editor offers it. Save as a
draft and verify it appears in the account's products. Leave the date unset.

Once installation is ready, choose a day when Michael can answer comments. Ask
for feedback rather than upvotes. Product Hunt reviews scheduled launches before
they go live; submitting does not guarantee homepage placement.

Official references checked November 2, 2026:

- [Build your product page](https://help.producthunt.com/en/articles/17834537-4-build-your-product-page)
- [How to post a product](https://help.producthunt.com/en/articles/479557-how-to-post-a-product)
- [Scheduling](https://help.producthunt.com/en/articles/2724119-how-to-schedule-a-post)
- [Account posting access](https://help.producthunt.com/en/articles/481909-how-can-i-get-access-to-post)
- [Unreleased products](https://help.producthunt.com/en/articles/484932-can-i-submit-an-unreleased-product)
