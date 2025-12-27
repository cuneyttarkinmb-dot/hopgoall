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

"use strict";

/* =========================
   [HELPERS] Kısayollar
   ========================= */
const $ = (s) => document.querySelector(s);

const state = {
  all: [],                 // streams.json'dan gelen tüm kayıtlar (match + channel)
  tab: "match",            // aktif sekme: "match" | "channel"
  onlyLive: true,          // sadece canlı filtre
  activeId: null,          // seçili yayın id
};

function safeText(s) { return String(s ?? "").trim(); }
function uniq(arr) { return [...new Set(arr)].filter(Boolean); }

/* =========================
   [EMBED URL] Twitch / YouTube
   ========================= */
function twitchEmbedUrl(channel) {
  // Twitch embed "parent" ister (domain). Cloudflare Pages domainin burada kullanılır.
  const parent = encodeURIComponent(location.hostname);
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true`;
}

function buildEmbedUrl(item) {
  if (item.provider === "youtube") return item.youtubeEmbedUrl || "";
  if (item.provider === "twitch") return item.twitchChannel ? twitchEmbedUrl(item.twitchChannel) : "";
  return item.embedUrl || "";
}

/* =========================
   [NORMALIZE] streams.json kaydını standarda çevir
   - kind: "match" | "channel"
   ========================= */
function normalize(item) {
  const kind = safeText(item.kind || item.type || "channel"); // yoksa channel say
  return {
    ...item,
    kind: (kind === "match" ? "match" : "channel"),
    title: safeText(item.title),
    category: safeText(item.category || "Other"),
    league: safeText(item.league || ""),   // maç için opsiyonel
    time: safeText(item.time || ""),       // maç için opsiyonel
    isLive: !!item.isLive,
    sourceUrl: safeText(item.sourceUrl || ""),
  };
}

/* =========================
   [FILTER] Sağ liste filtreleri
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

/* =========================
   [PLAYER] Soldaki player'ı güncelle
   ========================= */
function setActive(item) {
  state.activeId = item.id;

  const titleEl = $("#pTitle");
  const metaEl = $("#pMeta");
  const playerEl = $("#player");
  const sourceBtn = $("#btnSource");

  if (titleEl) titleEl.textContent = item.title || "Yayın";

  const metaBits = [item.category];
  if (item.league) metaBits.push(item.league);
  if (item.time) metaBits.push(item.time);
  if (metaEl) metaEl.textContent = metaBits.filter(Boolean).join(" • ");

  const src = buildEmbedUrl(item);
  if (playerEl) playerEl.src = src || "about:blank";

  if (sourceBtn) {
    sourceBtn.href = item.sourceUrl || src || "#";
    const ok = !!(item.sourceUrl || src);
    sourceBtn.style.opacity = ok ? "1" : ".5";
    sourceBtn.style.pointerEvents = ok ? "auto" : "none";
  }

  render(); // aktif satır highlight için
}

/* =========================================================
   [NATIVE ADS] Liste içine reklam kartı ekleme
   - Kaynak: ads.js -> window.HOPGOAL_ADS.native
   - Her native ad:
     {
       id, tab: "match"|"channel"|"both", after: 2,
       title, text, image, clickUrl, fallback
     }
   ========================================================= */

function getNativeAdsForTab(tab) {
  const ads = (window.HOPGOAL_ADS && Array.isArray(window.HOPGOAL_ADS.native))
    ? window.HOPGOAL_ADS.native
    : [];

  // tab filtrele + normalize
  return ads
    .filter(a => (a.tab === tab || a.tab === "both"))
    .map(a => ({
      id: safeText(a.id || `native-${Math.random()}`),
      after: Number(a.after ?? 9999), // after=2 => 2 öğeden sonra
      title: safeText(a.title || "Reklam"),
      text: safeText(a.text || "Sponsorlu içerik"),
      image: safeText(a.image || ""),
      fallback: safeText(a.fallback || ""),
      clickUrl: safeText(a.clickUrl || "#"),
    }))
    .sort((a, b) => a.after - b.after);
}

function nativeNode(ad) {
  // .item stilini kullanıyoruz (senin UI ile uyumlu)
  const el = document.createElement("div");
  el.className = "item";
  el.style.borderColor = "rgba(77,225,255,.28)";
  el.style.cursor = "pointer";

  el.addEventListener("click", () => {
    if (ad.clickUrl && ad.clickUrl !== "#") {
      window.open(ad.clickUrl, "_blank", "noopener,noreferrer");
    }
  });

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

  const imgSrc = ad.image || ad.fallback;
  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
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
   [RENDER] Sağ listedeki kartları bas
   - normal yayınlar + native ads birlikte
   ========================= */
function render() {
  const root = $("#list");
  const empty = $("#empty");
  if (!root) return;

  const list = filteredList();
  const natives = getNativeAdsForTab(state.tab);

  root.innerHTML = "";

  // Native reklamları "after" değerine göre araya serpiştir
  // after=0 => en başa
  // after=2 => 2 normal öğeden sonra
  const byAfter = new Map();
  for (const ad of natives) {
    const key = Number.isFinite(ad.after) ? ad.after : 9999;
    if (!byAfter.has(key)) byAfter.set(key, []);
    byAfter.get(key).push(ad);
  }

  // 0. sıraya native ekle (varsa)
  if (byAfter.has(0)) {
    for (const ad of byAfter.get(0)) root.appendChild(nativeNode(ad));
  }

  let count = 0; // normal öğe sayacı
  for (const item of list) {
    // normal kart
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

    // normal öğe sayacı
    count++;

    // bu sayıya denk gelen native reklamları ekle
    if (byAfter.has(count)) {
      for (const ad of byAfter.get(count)) root.appendChild(nativeNode(ad));
    }
  }

  // normal öğeler bitti, after daha büyük olan native'leri sona bas
  const maxAfter = count;
  for (const [after, ads] of byAfter.entries()) {
    if (after > maxAfter) {
      for (const ad of ads) root.appendChild(nativeNode(ad));
    }
  }

  // Empty state: root içinde hiç çocuk yoksa göster
  if (empty) empty.classList.toggle("hidden", root.children.length !== 0);
}

/* =========================
   [TAB] Maçlar / Kanallar geçişi
   ========================= */
function setTab(tab) {
  state.tab = tab;

  const m = $("#tabMatches");
  const c = $("#tabChannels");
  if (m) m.classList.toggle("active", tab === "match");
  if (c) c.classList.toggle("active", tab === "channel");

  // tab değişince seçili yayın yoksa temizle
  const list = filteredList();
  if (!list.some(x => x.id === state.activeId)) {
    state.activeId = null;

    const playerEl = $("#player");
    const titleEl = $("#pTitle");
    const metaEl = $("#pMeta");

    if (playerEl) playerEl.src = "about:blank";
    if (titleEl) titleEl.textContent = "Bir yayın seç";
    if (metaEl) metaEl.textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";
  }

  render();
}

/* =========================
   [LOAD] streams.json çek
   ========================= */
async function load() {
  const res = await fetch("./streams.json", { cache: "no-store" });
  const data = await res.json();

  state.all = (Array.isArray(data.streams) ? data.streams : []).map(normalize);

  // açılışta: maç tabı
  setTab("match");

  // ilk görünen öğeyi otomatik seç (varsa)
  const first = filteredList()[0] || null;
  if (first) setActive(first);

  render();
}

/* =========================
   [WIRE] Event listenerlar
   ========================= */
function wire() {
  const tabM = $("#tabMatches");
  const tabC = $("#tabChannels");
  const q = $("#q");
  const onlyLive = $("#onlyLive");
  const btnRefresh = $("#btnRefresh");
  const btnClear = $("#btnClear");

  if (tabM) tabM.addEventListener("click", () => setTab("match"));
  if (tabC) tabC.addEventListener("click", () => setTab("channel"));

  if (q) q.addEventListener("input", render);

  if (onlyLive) {
    // sayfa açılışında checkbox state.onlyLive ile senkron kalsın
    onlyLive.checked = !!state.onlyLive;
    onlyLive.addEventListener("change", (e) => {
      state.onlyLive = !!e.target.checked;
      render();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      const current = state.all.find(x => x.id === state.activeId);
      if (!current) return;

      const src = buildEmbedUrl(current);
      const playerEl = $("#player");
      if (!playerEl) return;

      playerEl.src = "about:blank";
      setTimeout(() => { playerEl.src = src || "about:blank"; }, 80);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      state.activeId = null;

      const playerEl = $("#player");
      const titleEl = $("#pTitle");
      const metaEl = $("#pMeta");

      if (playerEl) playerEl.src = "about:blank";
      if (titleEl) titleEl.textContent = "Bir yayın seç";
      if (metaEl) metaEl.textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";

      render();
    });
  }
}

/* =========================
   [BOOT] Başlat
   ========================= */
wire();
load().catch(() => {
  const empty = $("#empty");
  if (empty) empty.classList.remove("hidden");
});
