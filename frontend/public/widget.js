/**
 * TQ Chatbot #1 — embeddable widget loader.
 *
 * Usage on a client site:
 *   <script
 *     src="https://tq-demo.aquryu.space/widget.js"
 *     data-tenant-id="abc123"
 *     data-api="https://tq-api.aquryu.space"
 *     data-position="bottom-right"
 *   ></script>
 *
 * Injects a floating launcher button and an iframe pointing at /embed?tenant=ID.
 * The iframe keeps the widget fully isolated from the host page's CSS.
 */
(function () {
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    script = scripts[scripts.length - 1];
  }

  var tenantId = script.getAttribute("data-tenant-id");
  if (!tenantId) {
    console.error("[TQ widget] missing data-tenant-id");
    return;
  }

  // Origin the widget assets are served from (derived from this script's src).
  var origin = new URL(script.src).origin;
  var api = script.getAttribute("data-api") || "";
  var position = script.getAttribute("data-position") || "bottom-right";
  var primary = script.getAttribute("data-color") || "#c4c0ff";

  var sideRight = position.indexOf("left") === -1;
  var edge = sideRight ? { right: "24px" } : { left: "24px" };

  // ── Container ──
  var wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.bottom = "24px";
  if (sideRight) wrap.style.right = "24px";
  else wrap.style.left = "24px";
  wrap.style.zIndex = "2147483000";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = sideRight ? "flex-end" : "flex-start";
  wrap.style.gap = "16px";

  // ── Iframe panel ──
  var iframe = document.createElement("iframe");
  var src = origin + "/embed?tenant=" + encodeURIComponent(tenantId);
  if (api) src += "&api=" + encodeURIComponent(api);
  iframe.src = src;
  iframe.title = "Chat";
  iframe.style.width = "380px";
  iframe.style.maxWidth = "calc(100vw - 48px)";
  iframe.style.height = "560px";
  iframe.style.maxHeight = "calc(100vh - 96px)";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 20px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)";
  iframe.style.display = "none";
  iframe.style.background = "#131316";
  iframe.allow = "clipboard-write";

  // ── Launcher button ──
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open chat");
  btn.style.width = "56px";
  btn.style.height = "56px";
  btn.style.borderRadius = "9999px";
  btn.style.border = "none";
  btn.style.cursor = "pointer";
  btn.style.background = primary;
  btn.style.color = "#2000a4";
  btn.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.transition = "transform 0.15s ease";
  btn.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  btn.onmouseenter = function () { btn.style.transform = "scale(1.08)"; };
  btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };

  var open = false;
  function toggle() {
    open = !open;
    iframe.style.display = open ? "block" : "none";
    btn.innerHTML = open
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
      : '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  }
  btn.addEventListener("click", toggle);

  wrap.appendChild(iframe);
  wrap.appendChild(btn);

  function mount() {
    document.body.appendChild(wrap);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
