/* =========================================================
   HopGoal Live - app.js (ANA UYGULAMA DOSYASI)

   Bu dosya ne yapar?
   1) streams.json içeriğini çeker
   2) Sağ tarafta Maçlar / Kanallar listesini oluşturur
   3) Sağdan seçilen yayını soldaki player'da açar
   4) Arama + "Sadece canlı" filtresi uygular
   5) Native Ads: Sağ listedeki öğelerin arasına reklam kartı ekler
      (ads.js içindeki HOPGOAL_ADS.native alanından okur)

   ÖNEMLİ:
   - live.html içinde script sırası şöyle olmalı:
     <script src="./assets/ads.js"></script>
     <script src="./assets/app.js"></script>
   ========================================================= */
/* =========================================================
   HopGoal Live - app.js
   + Sağ liste (Maçlar/Kanallar)
   + Native ads (liste içine)
   + PREROLL: yayın seçince player içinde reklam (15sn / son 5sn geç)
   ========================================================= */

"use strict";

const $ = (s) => document.querySelector(s);

const state = {
  all: [],
  tab: "match",
  onlyLive: true,
  activeId: null,

  // PREROLL state
  prerollTimer: null,
  prerollRemaining: 0,
  prerollItem: null,
};



function safeText(s) { return String(s ?? "").trim(); }
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

function twitchEmbedUrl(channel) {
  const parent = encodeURIComponent(location.hostname);
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true`;
}

function buildEmbedUrl(item) {
  if (item.provider === "youtube") return item.youtubeEmbedUrl || "";
  if (item.provider === "twitch") return item.twitchChannel ? twitchEmbedUrl(item.twitchChannel) : "";
  return item.embedUrl || "";
}

function normalize(item) {
  const kind = safeText(item.kind || item.type || "channel");
  return {
    ...item,
    kind: (kind === "match" ? "match" : "channel"),
    title: safeText(item.title),
    category: safeText(item.category || "Other"),
    league: safeText(item.league || ""),
    time: safeText(item.time || ""),
    isLive: !!item.isLive,
    sourceUrl: safeText(item.sourceUrl || ""),
  };
}

/* =========================
   FILTER
   ========================= */
function filteredList() {
  const qEl = $("#q");
  const q = safeText(qEl ? qEl.value : "").toLowerCase();

  let list = state.all.filter(x => x.kind === state.tab);
  if (state.onlyLive) list = list.filter(x => x.isLive);

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

/* =========================================================
   PREROLL (player içinde reklam)
   ========================================================= */

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
  if (state.prerollTimer) {
    clearInterval(state.prerollTimer);
    state.prerollTimer = null;
  }
  state.prerollRemaining = 0;
  state.prerollItem = null;

  const pr = $("#preRoll");
  if (pr) pr.classList.add("hidden");
}

function startPrerollThenPlay(item) {
  const cfg = getPrerollConfig();
  const playerEl = $("#player");

  // PREROLL kapalıysa direkt oynat
  if (!cfg) {
    const src = buildEmbedUrl(item);
    if (playerEl) playerEl.src = src || "about:blank";
    return;
  }

  // önce eski preroll varsa temizle
  stopPreroll();

  // iframe’i boş bırak (reklam bitene kadar video yüklenmesin)
  if (playerEl) playerEl.src = "about:blank";

  const pr = $("#preRoll");
  const img = $("#preRollImg");
  const link = $("#preRollClick");
  const countdown = $("#preRollCountdown");
  const skipBtn = $("#preRollSkip");

  if (!pr || !img || !link || !countdown || !skipBtn) {
    // overlay yoksa direkt oynat
    const src = buildEmbedUrl(item);
    if (playerEl) playerEl.src = src || "about:blank";
    return;
  }

  // creative bas
  img.src = cfg.creative.image || "";
  img.alt = cfg.creative.alt || "Reklam";
  link.href = cfg.creative.clickUrl || "#";

  // süreyi başlat
  state.prerollItem = item;
  state.prerollRemaining = cfg.durationSeconds;

  pr.classList.remove("hidden");
  countdown.textContent = String(state.prerollRemaining);

  // skip mantığı: SON X SANİYE KALINCA aktif
  const enableSkipAt = cfg.skippableLastSeconds; // remaining <= enableSkipAt -> aktif
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

  // skip tıklanınca (son 5 saniyede aktif olacak)
  skipBtn.onclick = () => {
    if (skipBtn.disabled) return;
    finishPrerollPlay(item);
  };

  // sayaç
  state.prerollTimer = setInterval(() => {
    state.prerollRemaining -= 1;
    if (state.prerollRemaining < 0) state.prerollRemaining = 0;

    countdown.textContent = String(state.prerollRemaining);
    updateSkipText();

    if (state.prerollRemaining <= 0) {
      finishPrerollPlay(item);
    }
  }, 1000);
}

function finishPrerollPlay(item) {
  stopPreroll(); // overlay kapat + timer temizle

  const src = buildEmbedUrl(item);
  const playerEl = $("#player");
  if (playerEl) playerEl.src = src || "about:blank";
}

/* =========================
   PLAYER: seçim
   ========================= */
function setActive(item) {
  state.activeId = item.id;

  // UI (başlık/meta hemen güncellensin)
  $("#pTitle").textContent = item.title || "Yayın";

  const metaBits = [item.category];
  if (item.league) metaBits.push(item.league);
  if (item.time) metaBits.push(item.time);
  $("#pMeta").textContent = metaBits.filter(Boolean).join(" • ");

  // Kaynak butonu (video daha başlamadan link hazır)
  const src = buildEmbedUrl(item);
  const btn = $("#btnSource");
  btn.href = item.sourceUrl || src || "#";
  btn.style.opacity = (item.sourceUrl || src) ? "1" : ".5";
  btn.style.pointerEvents = (item.sourceUrl || src) ? "auto" : "none";

  // ✅ PREROLL -> sonra video
  startPrerollThenPlay(item);

  render();
}

/* =========================
   NATIVE ADS (liste içine)
   ========================= */
function getNativeAdsForTab(tab) {
  const ads = (window.HOPGOAL_ADS && Array.isArray(window.HOPGOAL_ADS.native))
    ? window.HOPGOAL_ADS.native
    : [];

  return ads
    .filter(a => (a.tab === tab || a.tab === "both"))
    .map(a => ({
      id: safeText(a.id || `native-${Math.random()}`),
      after: Number(a.after ?? 9999),
      title: safeText(a.title || "Reklam"),
      text: safeText(a.text || "Sponsorlu içerik"),
      image: safeText(a.image || ""),
      clickUrl: safeText(a.clickUrl || "#"),
    }))
    .sort((a, b) => a.after - b.after);
}

function nativeNode(ad) {
  const el = document.createElement("div");
  el.className = "item";
  el.style.borderColor = "rgba(77,225,255,.28)";
  el.onclick = () => ad.clickUrl && window.open(ad.clickUrl, "_blank", "noopener,noreferrer");

  const left = document.createElement("div");
  left.className = "item-left";

  const title = document.createElement("b");
  title.textContent = ad.title;

  const sub = document.createElement("small");
  sub.textContent = ad.text;

  left.appendChild(title);
  left.appendChild(sub);

  const right = document.createElement("div");
  right.className = "item-right";

  const pill = document.createElement("div");
  pill.className = "pill live";
  pill.textContent = "REKLAM";
  right.appendChild(pill);

  if (ad.image) {
    const img = document.createElement("img");
    img.src = ad.image;
    img.alt = "Native Reklam";
    img.style.width = "72px";
    img.style.height = "40px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.border = "1px solid rgba(255,255,255,.14)";
    right.appendChild(img);
  }

  el.appendChild(left);
  el.appendChild(right);
  return el;
}

/* =========================
   RENDER
   ========================= */
function render() {
  const list = filteredList();
  const root = $("#list");
  const empty = $("#empty");
  if (!root) return;

  const natives = getNativeAdsForTab(state.tab);
  const byAfter = new Map();
  for (const ad of natives) {
    const key = Number.isFinite(ad.after) ? ad.after : 9999;
    if (!byAfter.has(key)) byAfter.set(key, []);
    byAfter.get(key).push(ad);
  }

  root.innerHTML = "";

  // after=0 en başa
  if (byAfter.has(0)) {
    for (const ad of byAfter.get(0)) root.appendChild(nativeNode(ad));
  }

  let count = 0;
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

    count++;
    if (byAfter.has(count)) {
      for (const ad of byAfter.get(count)) root.appendChild(nativeNode(ad));
    }
  }

  // sona kalanlar
  for (const [after, ads] of byAfter.entries()) {
    if (after > count) {
      for (const ad of ads) root.appendChild(nativeNode(ad));
    }
  }

  if (empty) empty.classList.toggle("hidden", root.children.length !== 0);
}

/* =========================
   TAB
   ========================= */
function setTab(tab) {
  // =========================================================
  // [TAB SWITCH]
  // - Sekme değişince SADECE sağdaki liste değişir (Maçlar/Kanallar).
  // - Aktif yayın KAPANMAZ. (player src about:blank yapılmaz)
  // =========================================================
  state.tab = tab;

  $("#tabMatches").classList.toggle("active", tab === "match");
  $("#tabChannels").classList.toggle("active", tab === "channel");

  render();
}
/* =========================
   LOAD
   ========================= */
async function load() {
  const res = await fetch("./streams.json", { cache: "no-store" });
  const data = await res.json();
  state.all = (Array.isArray(data.streams) ? data.streams : []).map(normalize);

  setTab("match");
  const first = filteredList()[0] || null;
  if (first) setActive(first);
  render();
}

/* =========================
   WIRE
   ========================= */
function wire() {
  $("#tabMatches").addEventListener("click", () => setTab("match"));
  $("#tabChannels").addEventListener("click", () => setTab("channel"));

  $("#q").addEventListener("input", render);

  $("#onlyLive").addEventListener("change", (e) => {
    state.onlyLive = !!e.target.checked;
    render();
  });

  $("#btnRefresh").addEventListener("click", () => {
    const current = state.all.find(x => x.id === state.activeId);
    if (!current) return;
    const src = buildEmbedUrl(current);
    $("#player").src = "about:blank";
    setTimeout(() => { $("#player").src = src || "about:blank"; }, 80);
  });

  $("#btnClear").addEventListener("click", () => {

    stopPreroll();
    state.activeId = null;
    $("#player").src = "about:blank";
    $("#pTitle").textContent = "Bir yayın seç";
    $("#pMeta").textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";
    render();
  });
}
// Event’leri bağla
wire();

// Streams’i yükle (hata olursa listeyi boş göster)
load().catch((err) => {
  console.warn("[app.js] load() failed:", err);
  const empty = $("#empty");
  if (empty) empty.classList.remove("hidden");
});



