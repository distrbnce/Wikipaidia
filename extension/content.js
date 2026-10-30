(() => {
  "use strict";

  const webExtension = globalThis.browser ?? globalThis.chrome;
  const diffModel = globalThis.WikipaidiaDiff;
  const sourceLocator = globalThis.WikipaidiaSource;
  if (!webExtension?.runtime?.sendMessage || !diffModel) return;
  if (location.hostname !== "en.wikipedia.org" || !document.body?.classList.contains("ns-0")) return;
  const currentUrl = new URL(location.href);
  if ((currentUrl.searchParams.get("action") || "view") !== "view" || currentUrl.searchParams.has("veaction") || currentUrl.searchParams.has("diff")) return;
  if (sourceLocator?.isSourceView?.()) return;
  if (document.getElementById("wikipaidia-extension-root")) return;

  function titleFromUrl(url) {
    if (url.hostname !== "en.wikipedia.org") return "";
    if (url.searchParams.get("title")) return url.searchParams.get("title").replaceAll("_", " ");
    if (url.pathname.startsWith("/wiki/")) {
      try { return decodeURIComponent(url.pathname.slice(6)).replaceAll("_", " "); } catch { return ""; }
    }
    return "";
  }

  let title = "";
  try { title = titleFromUrl(new URL(document.querySelector('link[rel="canonical"]')?.href)); } catch { /* Use this page's title. */ }
  title ||= titleFromUrl(currentUrl);
  title ||= document.querySelector("#firstHeading")?.textContent.trim();
  if (!title) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const host = el("div");
  host.id = "wikipaidia-extension-root";
  const shadow = host.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = `
    :host { all:initial; display:block; font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#263442; color-scheme:light; }
    *,*::before,*::after { box-sizing:border-box; }
    [hidden] { display:none !important; }
    button,input,select,summary { font:inherit; }
    button,summary { cursor:pointer; }
    button:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible { outline:3px solid #517da0; outline-offset:3px; }
    .page-tint { position:fixed; inset:0; z-index:2147483644; background:var(--alert-tint,rgba(234,170,43,.13)); pointer-events:none; }
    .panel { position:fixed; z-index:2147483647; right:20px; top:70px; display:flex; flex-direction:column; width:min(380px,calc(100vw - 32px)); height:min(760px,calc(100dvh - 90px)); background:#fff; border:1px solid #c8ccd1; border-radius:10px; box-shadow:0 8px 32px #172b3f29; overflow:hidden; }
    .topbar { display:flex; flex:none; align-items:center; gap:8px; padding:13px 16px; border-bottom:1px solid #eaecf0; }
    .brand { font-size:14px; font-weight:650; margin-right:auto; }
    .header-controls { display:flex; flex:none; align-items:center; gap:6px; margin-left:auto; }
    .alert-style-picker { height:28px; max-width:105px; padding:3px 5px; border:1px solid #c8ccd1; border-radius:4px; color:#263442; background:#fff; font-size:11px; }
    .alert-color-picker { flex:none; width:28px; height:28px; padding:2px; border:1px solid #c8ccd1; border-radius:4px; background:#fff; cursor:pointer; }
    .close { flex:none; width:28px; height:28px; border:0; border-radius:4px; background:transparent; color:#54595d; font-size:22px; line-height:1; }
    .close:hover { background:#f1f3f5; }
    .scroll { flex:1; min-height:0; padding:16px; overflow-y:auto; overscroll-behavior:contain; overflow-anchor:none; }
    h1 { margin:0 0 10px; font-size:18px; line-height:1.35; font-weight:600; overflow-wrap:anywhere; }
    h2,p { margin:0; }
    .status { margin-bottom:14px; }
    .status-title { font-size:13px; font-weight:600; }
    .status[data-tone="paid"] .status-title { color:#785310; }
    .status-detail { margin-top:3px; font-size:12px; color:#72777d; }
    .evidence { display:grid; gap:10px; }
    .card { border:1px solid #dde1e7; border-radius:6px; overflow-wrap:anywhere; }
    .card-label { display:flex; align-items:center; gap:8px; padding:7px 11px; border-radius:5px 5px 0 0; color:#54595d; background:#f1f3f5; font-size:11px; font-weight:600; list-style:none; }
    .card-label::-webkit-details-marker { display:none; }
    .card-label::before { content:""; flex:none; width:6px; height:6px; border-right:1.5px solid currentColor; border-bottom:1.5px solid currentColor; transform:rotate(-45deg); }
    .card[open] > .card-label::before { transform:translateY(-2px) rotate(45deg); }
    .card:not([open]) > .card-label { border-radius:5px; }
    .card[data-kind="paid-disclosure"] .card-label { background:#fff3d4; color:#785310; }
    .card[data-kind="paid-notice"] .card-label { background:#ffecd9; color:#874b16; }
    .card[data-kind="coi"] .card-label { background:#eaf1fb; color:#345777; }
    .card[data-kind="concern"] .card-label { background:#fcebed; color:#8c3442; }
    .card-body { padding:10px 11px; }
    h2 { font-size:13px; font-weight:600; }
    .facts { display:grid; grid-template-columns:auto minmax(0,1fr); gap:4px 8px; margin:0 0 8px; font-size:12px; }
    .facts dt { color:#72777d; }
    .facts dd { margin:0; }
    .source { font-size:12px; color:#36c; text-decoration:underline; text-underline-offset:2px; }
    .card-sources { display:flex; flex-wrap:wrap; gap:5px 10px; font-size:11px; }
    .card-sources .source { font-size:11px; }
    .evidence-source-entry { flex-basis:100%; }
    .evidence-source-date { margin-top:2px; color:#72777d; font-size:10px; }
    .article-edits { margin-top:10px; }
    .article-edits .action { font-size:11px; min-height:28px; }
    .article-edits .see-edits { margin-top:12px; }
    .editor-status { margin:6px 0 4px; padding:8px 9px; border:1px solid #e8c9ce; border-radius:4px; background:#fcf3f4; font-size:11px; }
    .block-badge { color:#8c3442; font-weight:650; }
    .block-reason { margin-top:4px; color:#54595d; line-height:1.6; }
    .block-reason .source { font-size:inherit; }
    .block-meta { display:grid; gap:3px; margin-top:5px; color:#72777d; font-size:10px; }
    .editor-status.unavailable { padding:0; border:0; background:transparent; color:#72777d; }
    .edits-placeholder { padding-top:2px; }
    .skeleton-edit { min-height:114px; margin-top:10px; padding-top:10px; border-top:1px solid #eaecf0; }
    .skeleton-line { height:9px; width:62%; margin:4px 0 9px; border-radius:3px; background:#eaecf0; }
    .skeleton-line.short { width:36%; }
    .skeleton-preview,.diff-placeholder { min-height:80px; padding:10px; border:1px solid #eaecf0; border-radius:4px; background:#f8f9fa; }
    .diff-placeholder { margin-top:8px; color:#72777d; font-size:11px; }
    .coi-explanation { margin:0 0 8px; font-size:12px; line-height:1.6; color:#54595d; }
    .coi-origin { margin:0 0 6px; font-size:10px; color:#72777d; }
    .coi-requests { margin:8px 0; font-size:12px; }
    .coi-requests > summary { color:#36c; }
    .coi-request { margin-top:9px; padding-top:9px; border-top:1px solid #eaecf0; }
    .coi-request > .source { font-weight:600; }
    .coi-request-status { margin-top:4px; font-size:10px; color:#72777d; }
    .coi-request-summary,.coi-request-reason { margin-top:5px; font-size:11px; line-height:1.6; color:#54595d; }
    .source-check-hint { margin-top:7px; font-size:11px; line-height:1.6; color:#72777d; }
    .edit-note { font-size:11px; color:#72777d; margin:7px 0; }
    .edit-row { margin-top:10px; padding-top:8px; border-top:1px solid #eaecf0; }
    .edit-meta { display:flex; align-items:baseline; gap:4px 10px; flex-wrap:wrap; }
    .edit-date { font-size:11px; font-weight:600; }
    .edit-meta .source { font-size:11px; }
    .edit-comment { margin:4px 0; font-size:11px; color:#54595d; }
    .edit-controls { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-top:5px; }
    .change { margin-top:8px; font-size:12px; overflow-wrap:anywhere; }
    .change-unified { padding:8px 10px; border:1px solid #eaecf0; border-radius:4px; background:#f8f9fa; white-space:pre-wrap; line-height:1.75; }
    .diff-highlight { color:#fff; font-weight:700; border-radius:2px; text-decoration:none; box-decoration-break:clone; -webkit-box-decoration-break:clone; }
    .diff-remove { background:#9f2434; box-shadow:0 0 0 2px #9f2434; }
    .diff-add { background:#176b3d; box-shadow:0 0 0 2px #176b3d; }
    .diff-ellipsis { color:#72777d; }
    .paragraph-toggle { padding:4px 0; margin-top:3px; border:0; background:transparent; color:#36c; font-size:11px; text-decoration:underline; text-underline-offset:2px; }
    .actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .action { min-height:32px; padding:5px 10px; background:#fff; color:#36c; border:1px solid #a2a9b1; border-radius:4px; font-size:12px; }
    .action:hover { background:#f8f9fa; }
    .action:disabled { opacity:.5; cursor:wait; }
    .warning { color:#785310; font-size:11px; margin-top:8px; }
    .attribution { margin-top:14px; padding-top:9px; border-top:1px solid #eaecf0; color:#72777d; font-size:10px; line-height:1.55; }
    .attribution .source { font-size:inherit; }
    .preference-error { color:#785310; font-size:11px; padding:7px 16px 0; }
    @media(max-width:480px) { .panel { right:12px; top:12px; width:calc(100vw - 24px); height:calc(100dvh - 24px); } }
    @media print { .panel,.page-tint { display:none !important; } }
  `;
  shadow.append(style);

  // The page alert lives in article flow. The tint is visual only and never
  // intercepts article links, selection, scrolling, or keyboard input.
  const alertHost = el("div");
  alertHost.id = "wikipaidia-article-alert";
  alertHost.hidden = true;
  const alertShadow = alertHost.attachShadow({ mode: "open" });
  const alertStyleSheet = el("style");
  alertStyleSheet.textContent = `
    :host { all:initial; display:block; margin:8px 0 16px; font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color-scheme:light; }
    :host([hidden]) { display:none !important; }
    * { box-sizing:border-box; }
    .launcher { display:flex; align-items:center; gap:9px; width:100%; padding:9px 12px; border:1px solid var(--alert-border,#d4b46e); border-radius:4px; background:var(--alert-background,#fff7e2); color:#263442; cursor:pointer; font:inherit; text-align:left; }
    .launcher:hover { background:var(--alert-hover,#fff0cc); }
    .launcher:focus-visible { outline:3px solid #517da0; outline-offset:3px; }
    .mark { display:inline-grid; flex:none; place-items:center; width:20px; height:20px; border-radius:50%; background:var(--alert-color,#eaaa2b); color:var(--alert-icon-text,#000); font-weight:750; font-size:13px; }
    .launcher-copy { font-weight:600; }
    .launcher-action { margin-left:auto; font-size:12px; white-space:nowrap; }
    :host([data-mode="tint"]) { margin:6px 0 10px; }
    :host([data-mode="tint"]) .launcher { display:inline-flex; width:auto; padding:5px; border-radius:50%; background:var(--alert-background,#fff7e2); }
    :host([data-mode="tint"]) .launcher-copy,:host([data-mode="tint"]) .launcher-action { display:none; }
    @media print { :host { display:none !important; } }
  `;
  const launcher = el("button", "launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Paid involvement disclosed. View evidence.");
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");
  const mark = el("span", "mark", "!");
  mark.setAttribute("aria-hidden", "true");
  const launcherCopy = el("span", "launcher-copy", "Paid involvement disclosed");
  const launcherAction = el("span", "launcher-action", "View evidence →");
  launcherAction.setAttribute("aria-hidden", "true");
  launcher.append(mark, launcherCopy, launcherAction);
  alertShadow.append(alertStyleSheet, launcher);
  const contentAnchor = document.querySelector("#mw-content-text");
  const headingAnchor = document.querySelector(".vector-page-titlebar") || document.querySelector("#firstHeading");
  if (contentAnchor) contentAnchor.before(alertHost);
  else if (headingAnchor) headingAnchor.after(alertHost);
  else document.body.prepend(alertHost);

  const tint = el("div", "page-tint");
  tint.hidden = true;
  tint.setAttribute("aria-hidden", "true");
  const announcer = el("span");
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  announcer.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
  const panel = el("section", "panel");
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "Wikipaidia evidence");
  const topbar = el("header", "topbar");
  const closeButton = el("button", "close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");
  const headerControls = el("div", "header-controls");
  const stylePicker = el("select", "alert-style-picker");
  stylePicker.setAttribute("aria-label", "Alert style");
  for (const [value, label] of [["top", "Banner"], ["tint", "Page Tint"]]) {
    const option = el("option", "", label);
    option.value = value;
    stylePicker.append(option);
  }
  stylePicker.addEventListener("change", () => setAlertStyle(stylePicker.value, true));
  const colorPicker = el("input", "alert-color-picker");
  colorPicker.type = "color";
  colorPicker.setAttribute("aria-label", "Alert color");
  colorPicker.title = "Alert color";
  colorPicker.addEventListener("input", () => setAlertColor(colorPicker.value));
  colorPicker.addEventListener("change", () => setAlertColor(colorPicker.value, true));
  headerControls.append(stylePicker, colorPicker);
  topbar.append(el("span", "brand", "Wikipaidia"), headerControls, closeButton);
  const scroll = el("div", "scroll");
  const preferenceError = el("p", "preference-error");
  preferenceError.hidden = true;
  preferenceError.setAttribute("role", "status");
  panel.append(topbar, preferenceError, scroll);
  shadow.append(tint, announcer, panel);
  document.body.append(host);

  let result = null;
  let loading = false;
  let error = "";
  let deep = false;
  let augmenting = false;
  let augmentationError = "";
  let previousFocus = null;
  let alertStyle = "top";
  const DEFAULT_ALERT_COLOR = "#eaaa2b";
  let alertColor = DEFAULT_ALERT_COLOR;
  const preferenceGeneration = { style: 0, color: 0 };
  const editStates = new Map();
  const userStates = new Map();

  function hasPaidEvidence() {
    return result?.evidence?.some(item => item.kind === "paid-disclosure" || item.kind === "paid-notice") === true;
  }

  function updatePageAlert() {
    const found = hasPaidEvidence();
    alertHost.hidden = !found;
    alertHost.dataset.mode = alertStyle;
    tint.hidden = !found || alertStyle !== "tint";
    announcer.textContent = found ? "Paid involvement disclosed." : "";
  }

  function savePreference(values) {
    preferenceError.hidden = true;
    (async () => {
      try {
        if (!webExtension.storage?.local) throw new Error("Storage unavailable");
        await webExtension.storage.local.set(values);
      } catch {
        preferenceError.textContent = "Couldn’t save preference.";
        preferenceError.hidden = false;
      }
    })();
  }

  function setAlertStyle(value, persist = false) {
    preferenceGeneration.style++;
    alertStyle = value === "tint" ? "tint" : "top";
    stylePicker.value = alertStyle;
    updatePageAlert();
    if (persist) savePreference({ alertStyle });
  }

  function setAlertColor(value, persist = false) {
    preferenceGeneration.color++;
    alertColor = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : DEFAULT_ALERT_COLOR;
    colorPicker.value = alertColor;
    const rgb = [1, 3, 5].map(index => Number.parseInt(alertColor.slice(index, index + 2), 16));
    const blend = amount => `rgb(${rgb.map(channel => Math.round(channel * amount + 255 * (1 - amount))).join(", ")})`;
    const linear = rgb.map(channel => {
      const fraction = channel / 255;
      return fraction <= .04045 ? fraction / 12.92 : ((fraction + .055) / 1.055) ** 2.4;
    });
    const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    const iconText = 1.05 / (luminance + .05) >= (luminance + .05) / .05 ? "#fff" : "#000";
    for (const target of [host, alertHost]) {
      target.style.setProperty("--alert-color", alertColor);
      target.style.setProperty("--alert-background", blend(.15));
      target.style.setProperty("--alert-hover", blend(.23));
      target.style.setProperty("--alert-border", blend(.55));
      target.style.setProperty("--alert-icon-text", iconText);
      target.style.setProperty("--alert-tint", `rgba(${rgb.join(", ")}, 0.13)`);
    }
    updatePageAlert();
    if (persist) savePreference({ alertColor });
  }

  function openPanel(opener = document.activeElement) {
    if (!panel.hidden) return;
    previousFocus = opener;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    closeButton.focus();
    startAutomaticEdits();
  }

  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    const canRestore = previousFocus?.isConnected && previousFocus !== document.body
      && previousFocus !== document.documentElement && !panel.contains(previousFocus)
      && !(alertHost.hidden && alertShadow.contains(previousFocus));
    if (canRestore) {
      previousFocus.focus?.({ preventScroll: true });
      if (document.activeElement === previousFocus || alertShadow.activeElement === previousFocus) return;
    }
    const heading = document.querySelector("#firstHeading");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
        heading.addEventListener("blur", () => {
          if (heading.getAttribute("tabindex") === "-1") heading.removeAttribute("tabindex");
        }, { once: true });
      }
      heading.focus({ preventScroll: true });
    }
  }

  launcher.addEventListener("click", () => panel.hidden ? openPanel(launcher) : closePanel());
  closeButton.addEventListener("click", closePanel);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) { event.preventDefault(); closePanel(); }
  });

  function formatDate(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  }

  function safeSource(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "en.wikipedia.org" && !url.port && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  function sourceLink(label, value) {
    const href = safeSource(value);
    if (!href) return null;
    const link = el("a", "source", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function editDate(value) {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"
    }) : "Date unavailable";
  }

  let paragraphSequence = 0;
  function appendSegments(node, segments) {
    node.replaceChildren();
    for (const segment of segments) {
      if (segment.type === "remove" || segment.type === "add") {
        const mark = el(segment.type === "remove" ? "del" : "ins", `diff-highlight diff-${segment.type}`, segment.text);
        node.append(mark);
      } else if (segment.type === "ellipsis") node.append(el("span", "diff-ellipsis", segment.text));
      else node.append(document.createTextNode(segment.text));
    }
  }

  function unifiedChange(change) {
    const block = el("div", "change");
    const { segments, precise } = diffModel.buildUnifiedDiff(change);
    if (!precise) {
      block.append(el("p", "edit-note", "Inline preview unavailable. Open the diff link."));
      return block;
    }
    if (!segments.some(segment => segment.type !== "equal")) {
      block.append(el("p", "edit-note", "No visible text changes."));
      return block;
    }
    const compact = diffModel.contextualize(segments, { context: 55 });
    const paragraph = el("div", "change-unified");
    const text = el("div", "change-text");
    text.id = `wikipaidia-paragraph-${++paragraphSequence}`;
    appendSegments(text, compact);
    paragraph.append(text);
    block.append(paragraph);
    if (compact.some(segment => segment.type === "ellipsis")) {
      let expanded = false;
      const toggle = el("button", "paragraph-toggle", "See More...");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", text.id);
      toggle.addEventListener("click", () => {
        expanded = !expanded;
        appendSegments(text, expanded ? segments : compact);
        toggle.textContent = expanded ? "See Less..." : "See More...";
        toggle.setAttribute("aria-expanded", String(expanded));
      });
      paragraph.append(toggle);
    }
    return block;
  }

  function preserveReadingPosition(update) {
    const position = scroll.scrollTop;
    const edge = scroll.getBoundingClientRect().top;
    const candidates = [...scroll.querySelectorAll(".edit-row,.card,.actions")];
    const visible = node => node.getBoundingClientRect().bottom > edge + 4;
    const anchor = candidates.find(node => node.classList.contains("edit-row") && visible(node)) || candidates.find(visible);
    const top = anchor?.getBoundingClientRect().top;
    update();
    if (position > 0) scroll.scrollTop = position + (anchor?.isConnected ? anchor.getBoundingClientRect().top - top : 0);
  }

  function historyPlaceholder() {
    const placeholder = el("div", "edits-placeholder");
    placeholder.setAttribute("aria-busy", "true");
    placeholder.setAttribute("aria-label", "Loading recent article edits");
    for (let i = 0; i < 3; i++) {
      const row = el("div", "skeleton-edit");
      row.setAttribute("aria-hidden", "true");
      row.append(el("div", "skeleton-line short"), el("div", "skeleton-preview"));
      placeholder.append(row);
    }
    return placeholder;
  }

  function editorStatus(contributor) {
    const region = el("div", "editor-status");
    region.hidden = true;
    let state = userStates.get(contributor);
    if (!state) {
      state = { loading: false, result: null, error: "", generation: 0, views: new Set() };
      userStates.set(contributor, state);
      state.start = async () => {
        if (state.loading || state.result || state.error || panel.hidden || ![...state.views].some(view => view.region.isConnected)) return;
        state.loading = true;
        const generation = state.generation;
        try {
          const response = await webExtension.runtime.sendMessage({ type: "GET_USER_STATUS", title, contributor });
          if (!response?.ok || typeof response.result?.blocked !== "boolean") throw new Error("Block status unavailable.");
          if (generation !== state.generation) return;
          state.result = response.result;
        } catch { if (generation === state.generation) state.error = "Block status unavailable."; }
        finally {
          if (generation === state.generation) {
            state.loading = false;
            preserveReadingPosition(() => {
              for (const view of state.views) {
                if (view.region.isConnected) view.draw();
                else state.views.delete(view);
              }
            });
          }
        }
      };
    }
    function draw() {
      region.replaceChildren();
      region.classList.toggle("unavailable", Boolean(state.error));
      region.hidden = !state.error && !state.result?.blocked;
      if (state.error) { region.append(el("span", "", state.error)); return; }
      const block = state.result?.block;
      if (!state.result?.blocked || !block) return;
      region.append(el("span", "block-badge", "User Blocked"));
      const reason = el("p", "block-reason");
      const reasonText = block.reason || "No plain-text reason provided.";
      const reasonLink = sourceLink(reasonText, block.reasonUrl);
      if (reasonLink) reason.append(reasonLink);
      else reason.textContent = reasonText;
      region.append(reason);
      const metadata = el("div", "block-meta");
      const indefinite = /^(?:infinite|indefinite|infinity|never)$/i.test(block.expiry || "");
      const expiry = formatDate(block.expiry);
      const since = formatDate(block.timestamp);
      if (since) metadata.append(el("span", "block-on", `On: ${since}`));
      metadata.append(el("span", "block-duration", `Duration: ${indefinite ? "Indefinite" : expiry ? editDate(block.expiry) : "Unavailable"}`));
      if (block.partial) metadata.append(el("span", "block-scope", "Scope: Partial"));
      region.append(metadata);
    }
    state.views.add({ region, draw });
    draw();
    queueMicrotask(startAutomaticEdits);
    return region;
  }

  function startAutomaticEdits() {
    if (panel.hidden) return;
    for (const state of editStates.values()) {
      if ([...state.views].some(view => view.region.isConnected)) state.start();
    }
    for (const state of userStates.values()) state.start();
  }

  function articleEdits(item) {
    const region = el("div", "article-edits");
    region.title = "Article edits by this account; payment for individual revisions is not verified.";
    const key = `${result?.title || title}:${item.contributor}`;
    let state = editStates.get(key);
    if (!state) {
      state = { loading: false, error: "", result: null, expanded: false, diffs: new Map(), diffErrors: new Map(), diffLoading: new Set(), views: new Set() };
      editStates.set(key, state);
      state.notify = () => {
        preserveReadingPosition(() => {
          for (const view of state.views) {
            if (!view.region.isConnected) { view.disconnect(); state.views.delete(view); }
            else view.draw();
          }
        });
      };
      state.paint = revid => {
        preserveReadingPosition(() => {
          for (const view of state.views) if (view.region.isConnected) view.paint(revid);
        });
      };
      state.loadDiff = async (edit, retry = false) => {
        if (panel.hidden || ![...state.views].some(view => view.region.isConnected)
          || state.diffs.has(edit.revid) || state.diffLoading.has(edit.revid) || (!retry && state.diffErrors.has(edit.revid))) return;
        state.diffLoading.add(edit.revid);
        state.diffErrors.delete(edit.revid);
        state.paint(edit.revid);
        try {
          const response = await webExtension.runtime.sendMessage({ type: "GET_EDIT_DIFF", title: result?.title || title, contributor: item.contributor, revid: edit.revid });
          if (!response?.ok || !Array.isArray(response.result?.changes)) throw new Error(response?.error || "Could not load changes.");
          state.diffs.set(edit.revid, response.result);
        } catch (error) { state.diffErrors.set(edit.revid, String(error?.message || "Could not load changes.")); }
        finally { state.diffLoading.delete(edit.revid); state.paint(edit.revid); }
      };
      state.loadHistory = async continuation => {
        if (state.loading) return;
        state.loading = true;
        state.error = "";
        state.notify();
        try {
          const message = { type: "GET_CONTRIBUTOR_EDITS", title: result?.title || title, contributor: item.contributor };
          if (continuation) message.continuation = continuation;
          const response = await webExtension.runtime.sendMessage(message);
          if (!response?.ok || !Array.isArray(response.result?.edits)) throw new Error(response?.error || "Could not load article edits.");
          const combined = new Map((state.result?.edits || []).map(edit => [edit.revid, edit]));
          for (const edit of response.result.edits) combined.set(edit.revid, edit);
          const edits = [...combined.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.revid - a.revid);
          state.result = { ...response.result, edits, totalCount: response.result.hasMore ? null : edits.length };
        } catch (error) { state.error = String(error?.message || "Could not load article edits."); }
        finally {
          state.loading = false;
          state.notify();
          const count = state.expanded && state.result?.edits.length <= 30 ? state.result.edits.length : 3;
          for (const edit of state.result?.edits.slice(0, count) || []) state.loadDiff(edit);
        }
      };
      state.start = () => {
        if (!state.result && !state.loading && !state.error) state.loadHistory();
        else for (const edit of state.result?.edits.slice(0, 3) || []) state.loadDiff(edit);
      };
    }
    const outputs = new Map();
    let observer = null;
    function drawDiff(diff, output) {
      output.replaceChildren();
      if (!diff.changes.length) output.append(el("p", "edit-note", "No visible text changes."));
      for (const change of diff.changes) output.append(unifiedChange(change));
      if (diff.truncated) output.append(el("p", "edit-note", "Preview shortened. Open the Wikipedia diff for the full change."));
    }
    function paint(edit, output) {
      if (state.diffs.has(edit.revid)) { drawDiff(state.diffs.get(edit.revid), output); return; }
      output.replaceChildren();
      if (state.diffErrors.has(edit.revid)) {
        output.append(el("p", "edit-note", state.diffErrors.get(edit.revid)));
        const retry = el("button", "action", "Retry changes");
        retry.addEventListener("click", () => state.loadDiff(edit, true));
        output.append(retry);
      } else {
        const placeholder = el("div", "diff-placeholder", "Loading changes…");
        placeholder.setAttribute("aria-busy", "true");
        output.append(placeholder);
      }
    }
    function draw() {
      observer?.disconnect();
      outputs.clear();
      region.replaceChildren();
      if (!state.result) {
        if (state.error) {
          region.append(el("p", "edit-note", state.error));
          const retry = el("button", "action", "Retry article edits");
          retry.addEventListener("click", () => state.loadHistory());
          region.append(retry);
        } else region.append(historyPlaceholder());
        return;
      }
      if (!state.result.edits.length) region.append(el("p", "edit-note", "No direct article edits found."));
      const visible = state.result.edits.slice(0, state.expanded ? undefined : 3);
      if (typeof IntersectionObserver === "function") observer = new IntersectionObserver(entries => {
        if (panel.hidden) return;
        for (const entry of entries) if (entry.isIntersecting) {
          const pair = outputs.get(Number(entry.target.dataset.revid));
          if (pair) state.loadDiff(pair.edit);
        }
      }, { root: scroll, rootMargin: "160px" });
      for (const edit of visible) {
        const row = el("div", "edit-row");
        row.dataset.revid = String(edit.revid);
        const date = el("p", "edit-date", editDate(edit.timestamp));
        date.title = edit.timestamp || "";
        const metadata = el("div", "edit-meta");
        metadata.append(date);
        const link = sourceLink(`Diff ${edit.revid}`, edit.diffUrl);
        if (link) metadata.append(link);
        row.append(metadata, el("p", "edit-comment", edit.comment || "No edit summary"));
        const output = el("div", "edit-changes");
        outputs.set(edit.revid, { edit, output });
        paint(edit, output);
        row.append(output);
        region.append(row);
        observer?.observe(row);
        if (!observer && state.expanded) queueMicrotask(() => state.loadDiff(edit));
      }
      const remaining = Math.max(0, state.result.edits.length - 3);
      if (state.expanded || remaining || state.result.hasMore) {
        const toggle = el("button", "action see-edits", state.expanded ? "See fewer edits" : state.result.hasMore ? "Load more edits" : `See ${remaining} more edit${remaining === 1 ? "" : "s"}`);
        toggle.addEventListener("click", () => {
          state.expanded = !state.expanded;
          state.notify();
          if (state.expanded && state.result.hasMore) state.loadHistory(state.result.continuation);
          else if (state.expanded && state.result.edits.length <= 30) for (const edit of state.result.edits) state.loadDiff(edit);
        });
        region.append(toggle);
      }
      if (state.expanded && state.result.hasMore) {
        const more = el("button", "action", state.loading ? "Loading edits…" : "Load more edits");
        more.disabled = state.loading;
        more.addEventListener("click", () => state.loadHistory(state.result.continuation));
        region.append(more);
      }
      if (state.error) {
        region.append(el("p", "edit-note", state.error));
        const retry = el("button", "action", "Retry article edits");
        retry.addEventListener("click", () => state.loadHistory(state.result.continuation));
        region.append(retry);
      }
    }
    const view = { region, draw, disconnect: () => observer?.disconnect(), paint: revid => {
      const pair = outputs.get(revid);
      if (pair) paint(pair.edit, pair.output);
    } };
    state.views.add(view);
    draw();
    queueMicrotask(startAutomaticEdits);
    return region;
  }

  function statusFor(evidence) {
    const paid = evidence.filter(item => item.kind === "paid-disclosure" || item.kind === "paid-notice").length;
    if (paid) return { tone: "paid", title: "Paid involvement disclosed", detail: `${paid} disclosure${paid === 1 ? "" : "s"}` };
    if (evidence.some(item => item.kind === "concern")) return { tone: "concern", title: "Payment concern", detail: "Wikipedia notice; payment unverified." };
    if (evidence.some(item => item.kind === "coi")) return { tone: "coi", title: "COI notice", detail: "Payment not established." };
    return { tone: "neutral", title: "No disclosure found", detail: "In checked sources only." };
  }

  function coiRequest(request) {
    const row = el("div", "coi-request");
    const label = request.topicTitle || request.sectionTitle || "COI edit request";
    const discussion = sourceLink(label, request.sectionUrl || request.sourceUrl);
    row.append(discussion || el("p", "", label));
    const statuses = { declined: "Marked declined", answered: "Marked answered; article change unverified", partial: "Marked partly answered", "under-review": "Marked under review", proceed: "Marked to proceed with discussion", open: "Marked open" };
    row.append(el("p", "coi-request-status", statuses[request.requestStatus] || "Outcome not specified"));
    const explicit = request.requestSummaryExplicit ?? (request.requestSummary !== request.sectionTitle && request.requestSummary !== "COI edit request");
    if (explicit && request.requestSummary) row.append(el("p", "coi-request-summary", `Proposed change: ${request.requestSummary}`));
    else if (request.contextExcerpt) row.append(el("p", "coi-request-summary", `Discussion excerpt: ${request.contextExcerpt}`));
    if (request.requestReason) row.append(el("p", "coi-request-reason", `Response: ${request.requestReason}`));
    return row;
  }

  function evidenceSourceLabel(item) {
    const description = item.kind === "paid-disclosure" ? "disclosure"
      : item.kind === "paid-notice" ? "paid-content notice"
      : item.kind === "concern" ? "concern"
      : item.kind === "coi" && item.coiType === "edit-request-group" ? "edit requests"
      : item.kind === "coi" && item.coiType === "edit-request" ? "edit request"
      : item.kind === "coi" ? "COI notice" : "evidence";
    return `View ${item.sourceRole === "archive" ? "archived " : ""}${description} on ${item.sourceTitle || "Wikipedia"}`;
  }

  function evidenceCard(item) {
    const card = el("details", "card");
    card.open = true;
    card.dataset.kind = item.kind;
    let kindLabel = { "paid-disclosure": "Paid disclosure", "paid-notice": "Paid-content notice", coi: "COI notice", concern: "Community concern" }[item.kind] || "Evidence";
    if (item.kind === "coi" && item.coiType === "connected-contributor") kindLabel = "Connected contributor";
    if (item.kind === "coi" && item.coiType === "edit-request") kindLabel = "COI edit request";
    if (item.kind === "coi" && item.coiType === "edit-request-group") kindLabel = `COI edit requests · ${item.requestCount || item.requests?.length || 0}`;
    card.append(el("summary", "card-label", kindLabel));
    const body = el("div", "card-body");
    const facts = el("dl", "facts");
    let editorUrl = "";
    if (typeof item.contributor === "string" && item.contributor.trim()) {
      const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(item.contributor) || /^[0-9a-f:]+$/i.test(item.contributor) && item.contributor.includes(":");
      editorUrl = isIp
        ? `https://en.wikipedia.org/wiki/Special:Contributions/${encodeURIComponent(item.contributor)}`
        : `https://en.wikipedia.org/wiki/${encodeURIComponent(`User:${item.contributor.replaceAll("_", " ")}`.replaceAll(" ", "_"))}`;
      const editor = sourceLink(item.contributor, editorUrl);
      if (editor) {
        editor.classList.add("editor-link");
        const value = el("dd");
        value.append(editor, editorStatus(item.contributor));
        facts.append(el("dt", "", "Editor:"), value);
      }
    }
    for (const [label, value, explicitUrl, className] of [
      ["Employer:", item.employer, item.employerUrl, "employer-link"],
      ["Client:", item.client, item.clientUrl, "client-link"]
    ]) {
      if (label === "Client:" && value === item.employer) continue;
      if (typeof value !== "string" || !value.trim()) continue;
      const supplied = safeSource(explicitUrl);
      const href = supplied || `https://en.wikipedia.org/w/index.php?title=Special%3ASearch&search=${encodeURIComponent(value)}`;
      const link = sourceLink(value, href);
      link.classList.add(className);
      if (!supplied) link.title = `Search Wikipedia for ${value}`;
      const field = el("dd");
      field.append(link);
      facts.append(el("dt", "", label), field);
    }
    if (facts.childElementCount) body.append(facts);
    if (item.kind === "coi") {
      const archived = item.sourceRole === "archive";
      body.append(el("p", "coi-origin", archived ? `Archived discussion · ${item.sourceTitle}` : "Current Wikipedia notice"));
      const explanation = item.coiType === "connected-contributor"
        ? item.connection || "The notice lists a possible personal or professional connection; the relationship is not specified."
        : item.coiType === "edit-request" || item.coiType === "edit-request-group"
          ? "Proposed changes submitted through the COI review process. Payment and implementation are not established."
          : item.connection || item.summary || "A conflict-of-interest notice is recorded. The specific relationship is not stated.";
      body.append(el("p", "coi-explanation", explanation));
      if (item.coiType === "connected-contributor") body.append(el("p", "coi-request-status", "This notice alone does not establish payment."));
      if (item.coiType === "edit-request") body.append(coiRequest(item));
      if (item.coiType === "edit-request-group" && Array.isArray(item.requests)) {
        const requests = el("details", "coi-requests");
        requests.append(el("summary", "", `View ${item.requests.length} requests`));
        for (const request of item.requests) requests.append(coiRequest(request));
        body.append(requests);
      }
    }
    const sources = el("div", "card-sources");
    const sourceUrl = sourceLocator?.buildUrl({ ...item, articles: [result?.title || title] }) || item.sourceUrl;
    const source = sourceLink(evidenceSourceLabel(item), sourceUrl);
    if (source) {
      source.classList.add("evidence-source");
      const date = formatDate(item.sourceTimestamp);
      source.title = `${item.sourceTitle || "Wikipedia"}${item.sourceRevision ? ` · Revision ${item.sourceRevision}` : ""}${date ? ` · Source page updated ${date}` : ""}`;
      const entry = el("div", "evidence-source-entry");
      entry.append(source);
      if (date) entry.append(el("p", "evidence-source-date", `Source page updated ${date}`));
      sources.append(entry);
    }
    if (Array.isArray(item.disclosureLinks)) {
      for (const value of item.disclosureLinks) {
        const link = sourceLink(value.label || "Disclosure", value.url);
        if (link && link.href !== source?.href && link.href !== safeSource(item.sourceUrl) && link.href !== editorUrl) sources.append(link);
      }
    }
    if (sources.childElementCount) body.append(sources);
    if (item.kind === "paid-disclosure" && item.contributor) body.append(articleEdits(item));
    card.append(body);
    return card;
  }

  // Keep the panel scaffold and evidence cards alive while requests settle.
  const articleTitle = el("h1", "", title);
  const statusBox = el("div", "status");
  statusBox.setAttribute("role", "status");
  const statusTitle = el("p", "status-title");
  const statusDetail = el("p", "status-detail");
  statusBox.append(statusTitle, statusDetail);
  const historical = el("p", "warning", "Older article revision; disclosure sources are current.");
  historical.hidden = !currentUrl.searchParams.has("oldid");
  const cards = el("div", "evidence");
  const cardViews = new Map();
  const actions = el("div", "actions");
  const moreButton = el("button", "action", "Check more sources");
  moreButton.title = "Checks up to 5 talk-page archives and 8 public user pages of named or recent editors.";
  moreButton.addEventListener("click", augmentSources);
  const refreshButton = el("button", "action", "Refresh");
  refreshButton.addEventListener("click", () => scan(deep, true));
  actions.append(moreButton, refreshButton);
  const sourceError = el("p", "warning");
  sourceError.setAttribute("role", "status");
  const attribution = el("p", "attribution");
  attribution.hidden = true;
  attribution.append("Wikipedia text is generally available under ",
    sourceLink("CC BY-SA 4.0", "https://en.wikipedia.org/wiki/Wikipedia:Text_of_the_Creative_Commons_Attribution-ShareAlike_4.0_International_License"),
    ". See sources for authors, history, and exceptions. Excerpts and edit previews may be shortened or reformatted.");
  scroll.append(articleTitle, statusBox, historical, cards, actions, sourceError, attribution);

  function evidenceKey(item) {
    return item.id || `${item.kind}:${item.sourceTitle}:${item.sourceRevision}:${item.contributor || ""}:${item.coiType || ""}`;
  }

  function evidenceSignature(item) {
    // Storage and runtime transports may reorder object keys or normalize
    // absent fields. Compare content, rather than its serialization order.
    const normalize = value => {
      if (Array.isArray(value)) return value.map(normalize);
      if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
        .filter(key => value[key] != null).map(key => [key, normalize(value[key])]));
      return value;
    };
    return JSON.stringify(normalize(item));
  }

  function render() {
    preserveReadingPosition(() => {
      const evidence = Array.isArray(result?.evidence) ? result.evidence : [];
      const status = statusFor(evidence);
      updatePageAlert();
      articleTitle.textContent = result?.title || title;
      statusBox.dataset.tone = status.tone;
      statusDetail.textContent = "";
      if (loading && !result) statusTitle.textContent = "Checking…";
      else if (error) { statusTitle.textContent = "Check unavailable"; statusDetail.textContent = error; }
      else if (result?.complete === false && !evidence.length) { statusTitle.textContent = "Check incomplete"; statusDetail.textContent = "Some sources were unavailable."; }
      else { statusTitle.textContent = status.title; statusDetail.textContent = `${status.detail}${result?.complete === false ? " · Check incomplete" : ""}`; }
      statusDetail.hidden = !statusDetail.textContent;
      const wanted = new Set(evidence.map(evidenceKey));
      for (const [key, view] of cardViews) {
        if (!wanted.has(key)) { view.node.remove(); cardViews.delete(key); }
      }
      for (const item of evidence) {
        const key = evidenceKey(item);
        const signature = evidenceSignature(item);
        const existing = cardViews.get(key);
        if (existing?.signature === signature) continue;
        const node = evidenceCard(item);
        if (existing) node.open = existing.node.open;
        if (existing) existing.node.replaceWith(node);
        else cards.append(node);
        cardViews.set(key, { node, signature });
      }
      moreButton.hidden = deep || Boolean(error);
      moreButton.disabled = loading || augmenting;
      moreButton.textContent = augmenting ? "Checking…" : "Check more sources";
      refreshButton.disabled = loading || augmenting;
      refreshButton.textContent = error ? "Retry" : loading ? "Refreshing…" : "Refresh";
      sourceError.textContent = augmentationError;
      sourceError.hidden = !augmentationError;
      attribution.hidden = evidence.length === 0;
    });
    startAutomaticEdits();
  }

  function requestError(caught) {
    const message = String(caught?.message || "Could not reach Wikipedia.");
    return /context invalidated|receiving end does not exist|extension.*(?:reload|invalid)/i.test(message) ? "Reload this tab to reconnect the extension." : message;
  }

  async function augmentSources() {
    if (loading || augmenting || deep) return;
    if (!result) return scan(true);
    augmenting = true;
    augmentationError = "";
    render();
    try {
      const response = await webExtension.runtime.sendMessage({ type: "SCAN_ARTICLE", title, deep: true, refresh: false });
      if (!response?.ok || !response.result) throw new Error(response?.error || "No response. Try again.");
      // The scanner retains its baseline when reusable. If it had to read a new
      // snapshot, let removed notices disappear. Keyed rendering keeps every
      // unchanged card and its open views alive in either case.
      result = response.result;
      deep = true;
    } catch (caught) { augmentationError = requestError(caught); }
    finally { augmenting = false; render(); }
  }

  async function scan(useDeep = false, refresh = false) {
    if (loading || augmenting) return;
    loading = true;
    error = "";
    augmentationError = "";
    render();
    try {
      const response = await webExtension.runtime.sendMessage({ type: "SCAN_ARTICLE", title, deep: useDeep, refresh });
      if (!response?.ok || !response.result) throw new Error(response?.error || "No response. Try again.");
      result = response.result;
      deep = useDeep;
      if (refresh) for (const state of userStates.values()) {
        state.generation++;
        state.loading = false;
        state.result = null;
        state.error = "";
      }
    } catch (caught) { error = requestError(caught); }
    finally { loading = false; render(); }
  }

  webExtension.runtime.onMessage.addListener(message => {
    if (message?.type === "TOGGLE_PANEL") { if (panel.hidden) openPanel(); else closePanel(); }
  });
  webExtension.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.alertStyle) setAlertStyle(changes.alertStyle.newValue);
    if (changes.alertColor) setAlertColor(changes.alertColor.newValue);
  });
  setAlertStyle("top");
  setAlertColor(DEFAULT_ALERT_COLOR);
  render();
  const generation = { ...preferenceGeneration };
  (async () => {
    try {
      const preference = await webExtension.storage?.local?.get(["alertStyle", "alertColor"]);
      if (generation.style === preferenceGeneration.style) setAlertStyle(preference?.alertStyle);
      if (generation.color === preferenceGeneration.color) setAlertColor(preference?.alertColor);
    } catch { /* Default top alert when preference storage is unavailable. */ }
    scan();
  })();
})();
