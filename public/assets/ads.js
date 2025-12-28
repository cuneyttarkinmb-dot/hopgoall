/* =========================================================
   HopGoal Ads (SAFE + BG ADS + PREROLL + REMOTE SHEETS)

   Slotlar:
   - top_banner
   - sidebar_rectangle
   - floating
   - interstitial
   - bg_left / bg_right
   - native[] (liste içine)
   - preroll (video başlamadan önce)

   REMOTE (Google Sheets):
   - /api/ads endpoint’inden JSON gelir
   - ok:true ve slots varsa, ADS içindeki slotların creatives’ini override eder
   - Böylece GitHub’a girmeden banner değiştirebilirsin
   ========================================================= */

(function () {
  "use strict";

  const LS = {
    interstitial: "hg_ad_interstitial_last",
    floatingClosed: "hg_ad_floating_closed",
  };

  function minutesSince(ts) {
    const n = Number(ts || 0);
    if (!n) return Infinity;
    return (Date.now() - n) / 60000;
  }

  // =========================
  // LOCAL (fallback) ADS config
  // =========================
  const ADS = {
    top_banner: {
      label: "Banner",
      creatives: [
        { image: "/ads/banner-970x90.gif", clickUrl: "https://example.com/banner1", alt: "Top Banner" },
        { image: "/ads/banner-970x90-2.gif", clickUrl: "https://example.com/banner2", alt: "Top Banner 2" }
      ]
    },

    // (Eski 4’lü grid slotları: sayfada yoksa zaten basılmaz)
    top_banner_1: { label: "Banner", creatives: [{ image: "/ads/banner-970x90.gif",   clickUrl: "https://example.com/top1", alt: "Top Banner 1" }] },
    top_banner_2: { label: "Banner", creatives: [{ image: "/ads/banner-970x90-2.gif", clickUrl: "https://example.com/top2", alt: "Top Banner 2" }] },
    top_banner_3: { label: "Banner", creatives: [{ image: "/ads/banner-970x90.gif",   clickUrl: "https://example.com/top3", alt: "Top Banner 3" }] },
    top_banner_4: { label: "Banner", creatives: [{ image: "/ads/banner-970x90-2.gif", clickUrl: "https://example.com/top4", alt: "Top Banner 4" }] },

    // Player altı banner
    player_banner: {
      label: "Player Banner",
      creatives: [
        { image: "/ads/banner-970x90.gif", clickUrl: "https://example.com/playerbanner1", alt: "Player Banner" }
      ]
    },

    sidebar_rectangle: {
      label: "Sidebar",
      creatives: [
        { image: "/ads/sidebar-300x250.gif", clickUrl: "https://example.com/sidebar", alt: "Sidebar Ad" }
      ]
    },

    // Alt sabit banner (floating slot’u basacak)
    floating: {
      label: "Bottom Banner",
      showAfterMs: 1200,
      creatives: [
        { image: "/ads/banner-970x90.gif",   clickUrl: "https://example.com/bottom1", alt: "Bottom Banner 1" },
        { image: "/ads/banner-970x90-2.gif", clickUrl: "https://example.com/bottom2", alt: "Bottom Banner 2" }
      ]
    },

    interstitial: {
      label: "Interstitial",
      showAfterMs: 1200,
      frequencyMinutes: 60,
      creatives: [
        { image: "/ads/interstitial-900x500.gif", clickUrl: "https://example.com/interstitial", alt: "Interstitial Ad" }
      ]
    },

    bg_left: {
      label: "BG Left",
      creatives: [
        { image: "/ads/bg-left-600x1400.jpg", clickUrl: "https://example.com/bg-left", alt: "BG Left" }
      ]
    },

    bg_right: {
      label: "BG Right",
      creatives: [
        { image: "/ads/bg-right-600x1400.jpg", clickUrl: "https://example.com/bg-right", alt: "BG Right" }
      ]
    },

    // liste içine native reklamlar (app.js bunu okuyor)
    native: [
      {
        id: "native-1",
        tab: "match",
        after: 1,
        title: "Native Reklam: Özel Teklif",
        text: "Tıkla, kampanyayı gör.",
        image: "/ads/native-600x200.gif",
        clickUrl: "https://example.com/native1"
      },
      {
        id: "native-2",
        tab: "channel",
        after: 2,
        title: "Native Reklam: Sponsor",
        text: "Detaylar için tıkla.",
        image: "/ads/native-600x200-2.gif",
        clickUrl: "https://example.com/native2"
      }
    ],

    // preroll (app.js bunu okuyor)
    preroll: {
      enabled: true,
      durationSeconds: 15,
      skippableLastSeconds: 5,
      creatives: [
        { image: "/ads/preroll-800x450.gif", clickUrl: "https://example.com/preroll", alt: "PreRoll" }
      ]
    },

    popup: { enabled: false }
  };

  // Dışarıya expose ediyoruz ki app.js okuyor
  window.HOPGOAL_ADS = ADS;

  // =========================
  // Helpers
  // =========================
  function pick(slot) {
    const s = ADS[slot];
    if (!s || !Array.isArray(s.creatives) || s.creatives.length === 0) return null;
    return s.creatives[Math.floor(Math.random() * s.creatives.length)];
  }

  function renderSlot(el, slotName) {
    const s = ADS[slotName];
    if (!s) return;

    const c = pick(slotName) || {};
    const img = c.image || "";
    const href = c.clickUrl || "#";
    const alt = c.alt || "Reklam";
    const label = s.label || "Reklam";

    // image boşsa slot’u boş bırak (UI bozulmasın)
    if (!img) {
      el.innerHTML = "";
      return;
    }

    el.innerHTML = `
      <div class="ad-label">${label}</div>
      <a class="ad-link" href="${href}" target="_blank" rel="sponsored noopener noreferrer">
        <img class="ad-img" src="${img}" alt="${alt}" loading="lazy">
      </a>
    `;
  }

  // =========================
  // Interstitial
  // =========================
  function setupInterstitial() {
    const slot = ADS.interstitial;
    const wrap = document.getElementById("adInterstitial");
    if (!slot || !wrap) return;

    const last = localStorage.getItem(LS.interstitial);
    if (minutesSince(last) < (slot.frequencyMinutes || 60)) return;

    setTimeout(() => {
      const c = pick("interstitial") || {};
      const img = wrap.querySelector("img");
      const a = wrap.querySelector("a");
      if (img) { img.src = c.image || ""; img.alt = c.alt || "Interstitial"; }
      if (a) a.href = c.clickUrl || "#";
      wrap.classList.remove("hidden");
      localStorage.setItem(LS.interstitial, String(Date.now()));
    }, slot.showAfterMs || 1200);

    const closeBtn = document.getElementById("adInterstitialClose");
    const backdrop = document.getElementById("adInterstitialBackdrop");
    [closeBtn, backdrop].forEach((x) => x && x.addEventListener("click", () => wrap.classList.add("hidden")));
  }

  // =========================
  // Floating bottom banner + X
  // =========================
  function setupFloating() {
    const slot = ADS.floating;
    const wrap = document.getElementById("adFloating");
    if (!slot || !wrap) return;

    // kullanıcı bu sekmede kapattıysa gösterme
    if (sessionStorage.getItem(LS.floatingClosed) === "1") return;

    setTimeout(() => {
      // kabuk: X + body
      wrap.innerHTML = `
        <button id="adFloatingClose" class="ad-close" type="button" aria-label="Kapat">✕</button>
        <div class="ad-body"></div>
      `;

      // reklamı body'ye bas
      const body = wrap.querySelector(".ad-body");
      if (body) renderSlot(body, "floating");

      // göster
      wrap.classList.remove("hidden");

      // kapat
      const closeBtn = document.getElementById("adFloatingClose");
      closeBtn && closeBtn.addEventListener("click", () => {
        wrap.classList.add("hidden");
        sessionStorage.setItem(LS.floatingClosed, "1");
      });
    }, slot.showAfterMs || 1200);
  }

  // =========================
  // MAIN RENDER (tekrar çağrılabilir)
  // =========================
  function applyAds() {
    // sayfadaki tüm slotları bas
    document.querySelectorAll("[data-ad-slot]").forEach((el) => {
      const slot = el.getAttribute("data-ad-slot");
      if (!slot) return;
      if (slot === "floating") return; // floating'i özel kuruyoruz
      renderSlot(el, slot);
    });

    setupInterstitial();
    setupFloating();
  }

  // Dışarıya aç (gerekirse başka yerden de çağırırsın)
  window.applyAds = applyAds;

  // =========================
  // REMOTE (Google Sheets -> /api/ads)
  // =========================
  function mergeRemoteSlots(remoteSlots) {
    // remoteSlots formatı:
    // { top_banner:{label, creatives:[{image,clickUrl,alt}]}, ... }
    // Biz sadece label+creatives’i override ediyoruz, diğer ayarlar (showAfterMs vs) localden kalsın.
    if (!remoteSlots || typeof remoteSlots !== "object") return;

    Object.keys(remoteSlots).forEach((slotName) => {
      const remote = remoteSlots[slotName];
      if (!remote) return;

      // remote.creatives varsa kullan
      const creatives = Array.isArray(remote.creatives) ? remote.creatives : null;
      const label = typeof remote.label === "string" ? remote.label : null;

      if (!ADS[slotName]) {
        // localde yoksa minimal slot aç
        ADS[slotName] = { label: label || "Reklam", creatives: creatives || [] };
        return;
      }

      if (label) ADS[slotName].label = label;
      if (creatives) ADS[slotName].creatives = creatives;
    });
  }

  async function loadRemoteAds() {
    try {
      const r = await fetch("/api/ads", { cache: "no-store" });
      const j = await r.json();

      // Apps Script payload’ı:
      // { ok:true, updatedAt:"...", slots:{...} }
      if (!j || !j.ok || !j.slots) return;

      mergeRemoteSlots(j.slots);

      // Remote geldiyse tekrar bas (anında güncellenir)
      applyAds();
    } catch (e) {
      console.warn("[ads.js] remote ads failed:", e);
    }
  }

  // =========================
  // INIT
  // =========================
  function init() {
    applyAds();
    // Remote'u arkadan çek, gelirse override et
    loadRemoteAds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
