"use strict";

const $ = (s) => document.querySelector(s);

const state = {
  all: [],
  tab: "match",
  onlyLive: true,
  activeId: null,
  debug: new URLSearchParams(location.search).get("debug") === "1",
  uiHideTimer: null,

  prerollTimer: null,
  prerollRemaining: 0,
  prerollItem: null,
};

/* =========================
   HLS (m3u8) SUPPORT
========================= */
function isHlsUrl(u) {
  return /\.m3u8($|\?)/i.test(String(u || ""));
}

function stopAllPlayers() {
  const iframe = document.getElementById("player");
  const video = document.getElementById("hlsPlayer");

  // HLS instance temizle
  if (window.__hlsInstance) {
    try { window.__hlsInstance.destroy(); } catch {}
    window.__hlsInstance = null;
  }

  // iframe durdur
  if (iframe) iframe.src = "about:blank";

  // video durdur
  if (video) {
    try { video.pause(); } catch {}
    video.removeAttribute("src");
    video.load();
  }
}

function playHls(url) {
  const video = document.getElementById("hlsPlayer");
  const iframe = document.getElementById("player");
  if (!video || !iframe) return;

  stopAllPlayers();

  // iframe gizle, video göster
  iframe.classList.add("hidden");
  video.classList.remove("hidden");

  // Safari native HLS
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.play().catch(() => {});
    return;
  }

  // Diğerleri: hls.js
  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls({
      lowLatencyMode: true,
      backBufferLength: 30,
    });
    window.__hlsInstance = hls;

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });

    // debug: CORS/403 vs burada görünür
    hls.on(window.Hls.Events.ERROR, (ev, data) => {
      if (state.debug) console.warn("HLS ERROR:", data);
    });

    return;
  }

  console.warn("HLS desteklenmiyor:", url);
}

function playIframe(url) {
  const iframe = document.getElementById("player");
  const video = document.getElementById("hlsPlayer");
  if (!iframe) return;

  stopAllPlayers();

  // video gizle, iframe göster
  if (video) video.classList.add("hidden");
  iframe.classList.remove("hidden");

  iframe.src = url || "about:blank";
}

function playFromItem(item) {
  const src = buildEmbedUrl(item);
  if (isHlsUrl(src)) return playHls(src);
  return playIframe(src);
}

/* =========================
   UTILS
========================= */
function safeText(s) { return String(s ?? "").trim(); }

function isRowEnabled(v) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim().toLowerCase();
  if (s === "") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return true;
}

function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1) return true;
  if (v === 0) return false;
  const t = String(v ?? "").trim().toLowerCase();
  if (t === "1") return true;
  if (t === "0") return false;
  if (t === "true" || t === "yes" || t === "y" || t === "on") return true;
  if (t === "false" || t === "no" || t === "n" || t === "off") return false;
  return false;
}

// ✅ Sheets'ten gelen sayı alanları boş gelebilir
function toNum(v, def) {
  const s = String(v ?? "").trim();
  if (s === "") return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

/* =========================
   PROVIDERS
========================= */
function twitchEmbedUrl(channel) {
  const parent = encodeURIComponent(location.hostname);
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true`;
}

function youtubeToEmbedUrl(raw) {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.hostname.includes("youtu.be")) {
      const vid = u.pathname.replace("/", "");
      if (!vid) return "";
      return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&playsinline=1&rel=0`;
    }
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&playsinline=1&rel=0`;
    if (u.pathname.startsWith("/embed/")) {
      const parts = u.pathname.split("/");
      const vid = parts[2] || "";
      if (!vid) return "";
      return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&playsinline=1&rel=0`;
    }
    return raw;
  } catch {
    return raw;
  }
}

function b64UrlEncode(str) {
  try {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch {
    return "";
  }
}

function shouldProxyEmbed(url) {
  const u = String(url || "");
  // m3u8 kesinlikle proxy yapma (HLS video kendisi çekecek)
  if (isHlsUrl(u)) return false;

  // html embed sayfaları vs proxylenebilir
  return /trycloudflare\.com/i.test(u) || /\/myplayer\.html/i.test(u) || /\.html(\?|#|$)/i.test(u);
}

function wrapPlayerProxy(embedUrl) {
  const token = b64UrlEncode(embedUrl);
  if (!token) return embedUrl || "";
  return `/api/player?u=${encodeURIComponent(token)}`;
}

function buildEmbedUrl(item) {
  if (item.provider === "youtube") {
    const raw = item.youtubeEmbedUrl || item.youtubeUrl || item.embedUrl || item.url || "";
    return youtubeToEmbedUrl(raw);
  }
  if (item.provider === "twitch") return item.twitchChannel ? twitchEmbedUrl(item.twitchChannel) : "";

  const raw = item.embedUrl || "";
  return shouldProxyEmbed(raw) ? wrapPlayerProxy(raw) : raw;
}

/* =========================
   LOGO OVERLAY (Sheets)
   - live.html'de: #logoLayer + #logoImg
   - normal + fullscreen ayrı ayarlar
========================= */
function isPlayerFullscreen() {
  // Fullscreen'e aldığımız element: .player-frame
  const el = document.fullscreenElement;
  return !!(el && el.classList && el.classList.contains("player-frame"));
}

function applyLogo(item) {
  const layer = document.getElementById("logoLayer");
  const img = document.getElementById("logoImg");
  if (!layer || !img) return;

  const hasLogo = item && item.logoUrl && String(item.logoUrl).trim() !== "";
  if (!hasLogo) {
    layer.classList.add("hidden");
    img.src = "";
    return;
  }

  const fs = isPlayerFullscreen();

  // fullscreen kolonları doluysa onları kullan, değilse normal
  const useFs = fs && item.fsLogoPos && String(item.fsLogoPos).trim() !== "";

  const pos = (useFs ? item.fsLogoPos : item.logoPos) || "tr";
  const x = useFs ? item.fsLogoX : item.logoX;
  const y = useFs ? item.fsLogoY : item.logoY;
  const w = useFs ? item.fsLogoW : item.logoW;
  const op = useFs ? item.fsLogoOpacity : item.logoOpacity;

  img.src = String(item.logoUrl).trim();

  // boyut/opaklık
  img.style.width = `${toNum(w, 140)}px`;
  img.style.opacity = String(toNum(op, 1));

  // reset konum
  img.style.left = "auto";
  img.style.right = "auto";
  img.style.top = "auto";
  img.style.bottom = "auto";

  const xx = toNum(x, 16);
  const yy = toNum(y, 16);

  // tr / tl / br / bl (default tr)
  if (pos === "tl") { img.style.left = `${xx}px`; img.style.top = `${yy}px`; }
  else if (pos === "br") { img.style.right = `${xx}px`; img.style.bottom = `${yy}px`; }
  else if (pos === "bl") { img.style.left = `${xx}px`; img.style.bottom = `${yy}px`; }
  else { img.style.right = `${xx}px`; img.style.top = `${yy}px`; }

  layer.classList.remove("hidden");
}

function clearLogo() {
  const layer = document.getElementById("logoLayer");
  const img = document.getElementById("logoImg");
  if (layer) layer.classList.add("hidden");
  if (img) img.src = "";
}

/* =========================
   NORMALIZE + FILTER
========================= */
function normalize(item) {
  const rawKind = safeText(item.kind || item.type || "channel").toLowerCase();
  const kind = (rawKind === "match") ? "match" : "channel";

  return {
    ...item,
    enabled: isRowEnabled(item.enabled),
    kind,
    id: safeText(item.id),
    title: safeText(item.title),
    category: safeText(item.category || "Other"),
    league: safeText(item.league || ""),
    time: safeText(item.time || ""),
    isLive: toBool(item.isLive),
    provider: safeText(item.provider || "embed"),
    embedUrl: safeText(item.embedUrl || ""),
    sourceUrl: safeText(item.sourceUrl || ""),

    // ✅ LOGO alanları (Apps Script JSON'undan gelir)
    logoUrl: safeText(item.logoUrl || ""),
    logoPos: safeText(item.logoPos || "tr"),
    logoX: toNum(item.logoX, 16),
    logoY: toNum(item.logoY, 16),
    logoW: toNum(item.logoW, 140),
    logoOpacity: toNum(item.logoOpacity, 1),

    fsLogoPos: safeText(item.fsLogoPos || ""),
    fsLogoX: toNum(item.fsLogoX, 16),
    fsLogoY: toNum(item.fsLogoY, 16),
    fsLogoW: toNum(item.fsLogoW, 140),
    fsLogoOpacity: toNum(item.fsLogoOpacity, 1),
  };
}

function filteredList() {
  const qEl = $("#q");
  const q = safeText(qEl ? qEl.value : "").toLowerCase();

  let list = state.all.filter(x => x.kind === state.tab);
  if (state.onlyLive) list = list.filter(x => x.isLive);

  if (q) {
    list = list.filter(x => {
      const blob = [x.title, x.category, x.league, x.time].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }
  return list;
}

/* =========================
   PREROLL
========================= */
function getPrerollConfig() {
  const cfg = window.HOPGOAL_ADS && window.HOPGOAL_ADS.preroll ? window.HOPGOAL_ADS.preroll : null;
  if (!cfg || !cfg.enabled) return null;

  const duration = Number(cfg.durationSeconds ?? 15);
  const last = Number(cfg.skippableLastSeconds ?? 5);

  const creatives = Array.isArray(cfg.creatives) ? cfg.creatives : [];
  const creative = creatives.length ? creatives[Math.floor(Math.random() * creatives.length)] : null;

  return {
    durationSeconds: Math.max(3, duration),
    skippableLastSeconds: Math.max(0, Math.min(last, duration)),
    creative: creative || { image: "", clickUrl: "#", alt: "Reklam" },
  };
}

function stopPreroll() {
  if (state.prerollTimer) clearInterval(state.prerollTimer);
  state.prerollTimer = null;
  state.prerollRemaining = 0;
  state.prerollItem = null;
  const pr = $("#preRoll");
  if (pr) pr.classList.add("hidden");
}

function finishPrerollPlay(item) {
  stopPreroll();
  playFromItem(item);
}

function startPrerollThenPlay(item) {
  const cfg = getPrerollConfig();
  if (!cfg) {
    playFromItem(item);
    return;
  }

  stopPreroll();
  stopAllPlayers(); // preroll başlamadan her şeyi durdur

  const pr = $("#preRoll");
  const img = $("#preRollImg");
  const link = $("#preRollClick");
  const countdown = $("#preRollCountdown");
  const skipBtn = $("#preRollSkip");

  if (!pr || !img || !link || !countdown || !skipBtn) {
    playFromItem(item);
    return;
  }

  img.src = cfg.creative.image || "";
  img.alt = cfg.creative.alt || "Reklam";
  link.href = cfg.creative.clickUrl || "#";

  state.prerollItem = item;
  state.prerollRemaining = cfg.durationSeconds;

  pr.classList.remove("hidden");
  countdown.textContent = String(state.prerollRemaining);

  const enableSkipAt = cfg.skippableLastSeconds;
  function updateSkipText() {
    if (state.prerollRemaining <= enableSkipAt) {
      skipBtn.disabled = false;
      skipBtn.textContent = "Reklamı geç";
    } else {
      const wait = state.prerollRemaining - enableSkipAt;
      skipBtn.disabled = true;
      skipBtn.textContent = `${wait} sn sonra geç`;
    }
  }
  updateSkipText();

  skipBtn.onclick = () => {
    if (skipBtn.disabled) return;
    finishPrerollPlay(item);
  };

  state.prerollTimer = setInterval(() => {
    state.prerollRemaining -= 1;
    if (state.prerollRemaining < 0) state.prerollRemaining = 0;

    countdown.textContent = String(state.prerollRemaining);
    updateSkipText();

    if (state.prerollRemaining <= 0) finishPrerollPlay(item);
  }, 1000);
}

/* =========================
   PLAYER SELECT
========================= */
function setActive(item) {
  state.activeId = item.id;

  const pTitle = $("#pTitle");
  const pMeta = $("#pMeta");
  if (pTitle) pTitle.textContent = item.title || "Yayın";
  if (pMeta) {
    const metaBits = [item.category];
    if (item.league) metaBits.push(item.league);
    if (item.time) metaBits.push(item.time);
    pMeta.textContent = metaBits.filter(Boolean).join(" • ");
  }

  const btn = $("#btnSource");
  if (btn) {
    if (!state.debug) {
      btn.style.display = "none";
    } else {
      const src = buildEmbedUrl(item);
      btn.style.display = "";
      btn.href = item.sourceUrl || src || "#";
      btn.style.opacity = (item.sourceUrl || src) ? "1" : ".5";
      btn.style.pointerEvents = (item.sourceUrl || src) ? "auto" : "none";
    }
  }

  // ✅ Logo'yu seçilen kanala göre bas
  applyLogo(item);

  startPrerollThenPlay(item);
  render();
}

/* =========================
   RENDER
========================= */
function render() {
  const list = filteredList();
  const root = $("#list");
  const empty = $("#empty");
  if (!root) return;

  root.innerHTML = "";

  for (const item of list) {
    const el = document.createElement("div");
    el.className = "item" + (item.id === state.activeId ? " active" : "");
    el.onclick = () => setActive(item);

    const left = document.createElement("div");
    left.className = "item-left";

    const title = document.createElement("b");
    title.textContent = item.title || "Yayın";

    const sub = document.createElement("small");
    sub.textContent = [item.league, item.category].filter(Boolean).join(" | ") || " ";

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "item-right";

    const pill = document.createElement("div");
    pill.className = "pill" + (item.isLive ? " live" : "");
    pill.textContent = item.isLive ? "CANLI" : "OFFLINE";

    right.appendChild(pill);

    el.appendChild(left);
    el.appendChild(right);
    root.appendChild(el);
  }

  if (empty) empty.classList.toggle("hidden", root.children.length !== 0);
}

/* =========================
   TAB
========================= */
function setTab(tab) {
  state.tab = tab;
  const m = $("#tabMatches");
  const c = $("#tabChannels");
  if (m) m.classList.toggle("active", tab === "match");
  if (c) c.classList.toggle("active", tab === "channel");
  render();
}

/* AUTO TAB: maç yoksa kanal aç */
function autoPickInitialTab() {
  const hasMatch = state.all.some(x => x.kind === "match");
  const hasChannel = state.all.some(x => x.kind === "channel");
  if (!hasMatch && hasChannel) return "channel";
  return "match";
}

/* =========================
   LOAD
========================= */
async function load() {
  const r = await fetch("/api/streams", { cache: "no-store" });
  const j = await r.json();

  const streams = Array.isArray(j?.streams)
    ? j.streams
    : (Array.isArray(j?.data) ? j.data : (Array.isArray(j?.items) ? j.items : []));

  state.all = streams.map(normalize).filter(x => x.enabled);

  // otomatik sekme
  setTab(autoPickInitialTab());

  // ilk elemanı seç
  const first = filteredList()[0] || null;
  if (first) setActive(first);

  render();
}

/* =========================
   PLAYER CHROME AUTO-HIDE
   - CSS tarafında .player-card.ui-hidden kullanıyorsun,
     burada da aynı sınıfı basıyoruz.
========================= */
function setupPlayerChromeAutoHide() {
  const card = document.querySelector(".player-card");
  if (!card) return;

  const prerollEl = document.getElementById("preRoll");

  function hide() {
    if (prerollEl && !prerollEl.classList.contains("hidden")) return reset();
    card.classList.add("ui-hidden");
  }

  function reset() {
    card.classList.remove("ui-hidden");
    if (state.uiHideTimer) clearTimeout(state.uiHideTimer);
    state.uiHideTimer = setTimeout(hide, 2500);
  }

  ["mousemove", "touchstart", "keydown"].forEach((ev) => {
    card.addEventListener(ev, reset, { passive: true });
  });

  reset();
}

/* =========================
   WIRE UI
========================= */
function wire() {
  const tabM = $("#tabMatches");
  const tabC = $("#tabChannels");
  const q = $("#q");
  const onlyLive = $("#onlyLive");

  // ✅ live.html'de id: btnReload
  const btnReload = $("#btnReload");
  const btnClear = $("#btnClear");
  const srcBtn = $("#btnSource");

  // ✅ fullscreen butonu
  const btnFs = $("#btnFullscreen");
  const frame = document.querySelector(".player-frame");

  if (tabM) tabM.addEventListener("click", () => setTab("match"));
  if (tabC) tabC.addEventListener("click", () => setTab("channel"));
  if (q) q.addEventListener("input", render);

  if (srcBtn && !state.debug) srcBtn.style.display = "none";

  if (onlyLive) onlyLive.addEventListener("change", (e) => {
    state.onlyLive = !!e.target.checked;
    render();
  });

  setupPlayerChromeAutoHide();

  // ✅ Reload (m3u8 + iframe)
  if (btnReload) btnReload.addEventListener("click", () => {
    const current = state.all.find(x => x.id === state.activeId);
    if (!current) return;

    const src = buildEmbedUrl(current);

    // m3u8 ise HLS refresh
    if (isHlsUrl(src)) {
      playHls(src);
      return;
    }

    // iframe refresh
    const player = $("#player");
    if (!player) return;
    player.src = "about:blank";
    setTimeout(() => { player.src = src || "about:blank"; }, 80);
  });

  // ✅ Clear
  if (btnClear) btnClear.addEventListener("click", () => {
    stopPreroll();
    state.activeId = null;

    stopAllPlayers();
    clearLogo();

    const iframe = $("#player");
    const video = $("#hlsPlayer");
    if (iframe) iframe.classList.remove("hidden");
    if (video) video.classList.add("hidden");

    const t = $("#pTitle");
    const m = $("#pMeta");
    if (t) t.textContent = "Bir yayın seç";
    if (m) m.textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";
    render();
  });

  // ✅ Fullscreen: iframe değil, .player-frame tam ekran (logo da beraber gelir)
  if (btnFs && frame) {
    btnFs.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await frame.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch {}
    });

    document.addEventListener("fullscreenchange", () => {
      const current = state.all.find(x => x.id === state.activeId);
      if (current) applyLogo(current); // fsLogo* varsa otomatik geçer
    });
  }
}

wire();
load().catch((e) => {
  if (state.debug) console.warn("load failed:", e);
  const empty = $("#empty");
  if (empty) empty.classList.remove("hidden");
});
