"use strict";

const $ = (s) => document.querySelector(s);

const state = {
  all: [],
  tab: "match",
  onlyLive: true,
  activeId: null,
  prerollTimer: null,
  prerollRemaining: 0,
  prerollItem: null,
};

function safeText(s) { return String(s ?? "").trim(); }
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

function toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v === 1 || v === "1") return true;
  const t = String(v ?? "").trim().toLowerCase();
  return t === "true" || t === "yes" || t === "y" || t === "on";
}

function setEmpty(msgTitle, msgText) {
  const empty = $("#empty");
  if (!empty) return;
  empty.classList.remove("hidden");
  empty.innerHTML = `<b>${msgTitle}</b><div>${msgText}</div>`;
}

function hideEmptyIfListHasItems() {
  const empty = $("#empty");
  const root = $("#list");
  if (!empty || !root) return;
  empty.classList.toggle("hidden", root.children.length !== 0);
}

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

function buildEmbedUrl(item) {
  if (item.provider === "youtube") {
    const raw = item.youtubeEmbedUrl || item.youtubeUrl || item.embedUrl || item.url || "";
    return youtubeToEmbedUrl(raw);
  }
  if (item.provider === "twitch") return item.twitchChannel ? twitchEmbedUrl(item.twitchChannel) : "";
  return item.embedUrl || "";
}

function normalize(item) {
  const kindRaw = safeText(item.kind || item.type || "channel").toLowerCase();
  const kind = (kindRaw === "match") ? "match" : "channel";

  const enabled = toBool(item.enabled);
  const isLive = toBool(item.isLive);

  return {
    ...item,
    kind,
    enabled,
    isLive,
    title: safeText(item.title || "Yayın"),
    category: safeText(item.category || "Other"),
    league: safeText(item.league || ""),
    time: safeText(item.time || ""),
    sourceUrl: safeText(item.sourceUrl || ""),
    embedUrl: safeText(item.embedUrl || ""),
    provider: safeText(item.provider || "embed"),
    tags: Array.isArray(item.tags)
      ? item.tags
      : safeText(item.tags || "").split(",").map(s => safeText(s)).filter(Boolean),
  };
}

/* FILTER */
function filteredList() {
  const q = safeText($("#q")?.value || "").toLowerCase();

  // sadece enabled=1 göster
  let list = state.all.filter(x => x.enabled);

  // tab filtre
  list = list.filter(x => x.kind === state.tab);

  // sadece canlı
  if (state.onlyLive) list = list.filter(x => x.isLive);

  // arama
  if (q) {
    list = list.filter(x => {
      const blob = [
        x.title, x.category, x.league, x.time,
        Array.isArray(x.tags) ? x.tags.join(" ") : ""
      ].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }

  return list;
}

/* PREROLL */
function getPrerollConfig() {
  const cfg = window.HOPGOAL_ADS && window.HOPGOAL_ADS.preroll ? window.HOPGOAL_ADS.preroll : null;
  if (!cfg || !toBool(cfg.enabled)) return null;

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
  if (state.prerollTimer) {
    clearInterval(state.prerollTimer);
    state.prerollTimer = null;
  }
  state.prerollRemaining = 0;
  state.prerollItem = null;
  const pr = $("#preRoll");
  if (pr) pr.classList.add("hidden");
}

function finishPrerollPlay(item) {
  stopPreroll();
  const src = buildEmbedUrl(item);
  const playerEl = $("#player");
  if (playerEl) playerEl.src = src || "about:blank";
}

function startPrerollThenPlay(item) {
  const cfg = getPrerollConfig();
  const playerEl = $("#player");

  if (!cfg) {
    const src = buildEmbedUrl(item);
    if (playerEl) playerEl.src = src || "about:blank";
    return;
  }

  stopPreroll();
  if (playerEl) playerEl.src = "about:blank";

  const pr = $("#preRoll");
  const img = $("#preRollImg");
  const link = $("#preRollClick");
  const countdown = $("#preRollCountdown");
  const skipBtn = $("#preRollSkip");

  if (!pr || !img || !link || !countdown || !skipBtn) {
    const src = buildEmbedUrl(item);
    if (playerEl) playerEl.src = src || "about:blank";
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

/* PLAYER seçim */
function setActive(item) {
  state.activeId = item.id;

  const pTitle = $("#pTitle");
  const pMeta = $("#pMeta");
  if (pTitle) pTitle.textContent = item.title || "Yayın";

  const metaBits = [item.category];
  if (item.league) metaBits.push(item.league);
  if (item.time) metaBits.push(item.time);
  if (pMeta) pMeta.textContent = metaBits.filter(Boolean).join(" • ");

  const src = buildEmbedUrl(item);
  const btn = $("#btnSource");
  if (btn) {
    btn.href = item.sourceUrl || src || "#";
    btn.style.opacity = (item.sourceUrl || src) ? "1" : ".5";
    btn.style.pointerEvents = (item.sourceUrl || src) ? "auto" : "none";
  }

  startPrerollThenPlay(item);
  render();
}

/* RENDER */
function render() {
  const root = $("#list");
  if (!root) return;

  const list = filteredList();
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
    const subParts = uniq([item.league || "", item.category || ""]);
    sub.textContent = subParts.filter(Boolean).join(" | ") || " ";

    left.appendChild(title);
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "item-right";

    if (item.time) {
      const t = document.createElement("div");
      t.className = "time";
      t.textContent = item.time;
      right.appendChild(t);
    }

    const pill = document.createElement("div");
    pill.className = "pill" + (item.isLive ? " live" : "");
    pill.textContent = item.isLive ? "CANLI" : "OFFLINE";
    right.appendChild(pill);

    el.appendChild(left);
    el.appendChild(right);
    root.appendChild(el);
  }

  if (list.length === 0) {
    setEmpty("Sonuç yok", "Sheets'te yayın ekleyip enabled=1 yap.");
  } else {
    const empty = $("#empty");
    if (empty) empty.classList.add("hidden");
  }

  hideEmptyIfListHasItems();
}

/* TAB */
function setTab(tab) {
  state.tab = tab;
  $("#tabMatches")?.classList.toggle("active", tab === "match");
  $("#tabChannels")?.classList.toggle("active", tab === "channel");
  render();
}

/* LOAD */
async function load() {
  setEmpty("Yükleniyor…", "Kanallar getiriliyor…");

  // önce remote dene (sheet)
  try {
    const r = await fetch(`/api/streams?ts=${Date.now()}`, { cache: "no-store" });
    const j = await r.json();

    const streams = Array.isArray(j?.streams)
      ? j.streams
      : (Array.isArray(j?.data) ? j.data : (Array.isArray(j?.items) ? j.items : []));

    if (j && (j.ok === true || j.ok === "true") && Array.isArray(streams)) {
      state.all = streams.map(normalize);
    } else {
      throw new Error("API format hatalı");
    }
  } catch (e) {
    console.warn("streams load failed:", e);
    // fallback local (boş olabilir)
    try {
      const res = await fetch(`/streams.json?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      state.all = (Array.isArray(data.streams) ? data.streams : []).map(normalize);
    } catch {
      state.all = [];
    }
  }

  // default tab
  setTab("match");

  // ilk item varsa seç
  const first = filteredList()[0] || null;
  if (first) setActive(first);

  render();
}

/* WIRE (hata almayacak şekilde) */
function wire() {
  $("#tabMatches")?.addEventListener("click", () => setTab("match"));
  $("#tabChannels")?.addEventListener("click", () => setTab("channel"));

  $("#q")?.addEventListener("input", render);

  $("#onlyLive")?.addEventListener("change", (e) => {
    state.onlyLive = !!e.target.checked;
    render();
  });

  $("#btnRefresh")?.addEventListener("click", () => {
    const current = state.all.find(x => x.id === state.activeId);
    if (!current) return;
    const src = buildEmbedUrl(current);
    const pl = $("#player");
    if (!pl) return;
    pl.src = "about:blank";
    setTimeout(() => { pl.src = src || "about:blank"; }, 80);
  });

  $("#btnClear")?.addEventListener("click", () => {
    stopPreroll();
    state.activeId = null;
    const pl = $("#player");
    if (pl) pl.src = "about:blank";
    $("#pTitle") && ($("#pTitle").textContent = "Bir yayın seç");
    $("#pMeta") && ($("#pMeta").textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.");
    render();
  });
}

wire();
load();
