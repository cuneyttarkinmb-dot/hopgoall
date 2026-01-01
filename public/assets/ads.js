/* =========================================================
   HopGoal Ads (FAST RENDER + REMOTE SHEETS)
   - İlk anda LOCAL reklamlari basar (boşluk kalmaz)
   - Remote (/api/ads) gelince sadece img src/href günceller (flicker azalır)
   - Basit preload ile görsel daha hızlı gelir
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
  // LOCAL fallback config
  // =========================
  const ADS = window.HOPGOAL_ADS || {
    top_banner: { label: "Banner", creatives: [{ image: "/ads/banner-970x90.gif", clickUrl: "#", alt: "Top Banner" }] },
    player_banner: { label: "Player Banner", creatives: [{ image: "/ads/banner-970x90-2.gif", clickUrl: "#", alt: "Player Banner" }] },
    sidebar_rectangle: { label: "Sidebar", creatives: [{ image: "/ads/sidebar-300x250.gif", clickUrl: "#", alt: "Sidebar" }] },
    floating: { label: "Bottom Banner", showAfterMs: 1200, creatives: [{ image: "/ads/banner-970x90.gif", clickUrl: "#", alt: "Bottom" }] },
    interstitial: { label: "Interstitial", showAfterMs: 1200, frequencyMinutes: 60, creatives: [{ image: "/ads/interstitial-900x500.gif", clickUrl: "#", alt: "Interstitial" }] },
    bg_left: { label: "BG Left", creatives: [{ image: "/ads/bg-left-600x1400.jpg", clickUrl: "#", alt: "BG Left" }] },
    bg_right: { label: "BG Right", creatives: [{ image: "/ads/bg-right-600x1400.jpg", clickUrl: "#", alt: "BG Right" }] },
    native: [],
    preroll: { enabled: true, durationSeconds: 15, skippableLastSeconds: 5, creatives: [{ image: "/ads/preroll-800x450.gif", clickUrl: "#", alt: "PreRoll" }] },
    popup: { enabled: false },
  };

  window.HOPGOAL_ADS = ADS;

  // =========================
  // Helpers
  // =========================
  function pick(slot) {
    const s = ADS[slot];
    if (!s || !Array.isArray(s.creatives) || s.creatives.length === 0) return null;
    return s.creatives[Math.floor(Math.random() * s.creatives.length)];
  }

  function preloadImage(url) {
    if (!url) return;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  }

  // Slot elementlerini "swap" etmek için işaretliyoruz
  function ensureSlotShell(el, slotName) {
    if (el.dataset.adReady === "1") return;

    el.innerHTML = `
      <div class="ad-label"></div>
      <a class="ad-link" href="#" target="_blank" rel="sponsored noopener noreferrer">
        <img class="ad-img" src="" alt="Reklam" loading="eager">
      </a>
    `;
    el.dataset.adReady = "1";
    el.dataset.adSlotName = slotName;
  }

  function updateSlot(el, slotName) {
    const s = ADS[slotName];
    if (!s) return;

    const c = pick(slotName) || {};
    const imgUrl = (c.image || "").trim();

    // image yoksa temizle
    if (!imgUrl) {
      el.innerHTML = "";
      return;
    }

    preloadImage(imgUrl);

    ensureSlotShell(el, slotName);

    const labelEl = el.querySelector(".ad-label");
    const linkEl = el.querySelector(".ad-link");
    const imgEl = el.querySelector(".ad-img");

    if (labelEl) labelEl.textContent = s.label || "Reklam";
    if (linkEl) linkEl.href = c.clickUrl || "#";
    if (imgEl) {
      imgEl.src = imgUrl;
      imgEl.alt = c.alt || "Reklam";
    }
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
      if (!c.image) return;

      preloadImage(c.image);

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

    if (sessionStorage.getItem(LS.floatingClosed) === "1") return;

    setTimeout(() => {
      wrap.innerHTML = `
        <button id="adFloatingClose" class="ad-close" type="button" aria-label="Kapat">✕</button>
        <div class="ad-body" data-ad-slot="floating"></div>
      `;

      const body = wrap.querySelector(".ad-body");
      if (body) updateSlot(body, "floating");

      wrap.classList.remove("hidden");

      const closeBtn = document.getElementById("adFloatingClose");
      closeBtn && closeBtn.addEventListener("click", () => {
        wrap.classList.add("hidden");
        sessionStorage.setItem(LS.floatingClosed, "1");
      });
    }, slot.showAfterMs || 1200);
  }

  // =========================
  // MAIN apply
  // =========================
  function applyAds() {
    document.querySelectorAll("[data-ad-slot]").forEach((el) => {
      const slot = el.getAttribute("data-ad-slot");
      if (!slot) return;
      if (slot === "floating") return; // özel kuruyoruz
      updateSlot(el, slot);
    });

    setupInterstitial();
    setupFloating();
  }

  window.applyAds = applyAds;

  // =========================
  // REMOTE merge (Sheets)
  // =========================
  function mergeRemoteSlots(remoteSlots) {
    if (!remoteSlots || typeof remoteSlots !== "object") return;

    Object.keys(remoteSlots).forEach((slotName) => {
      const remote = remoteSlots[slotName];
      if (!remote) return;

      const creatives = Array.isArray(remote.creatives) ? remote.creatives : null;
      const label = typeof remote.label === "string" ? remote.label : null;

      if (!ADS[slotName]) ADS[slotName] = { label: label || "Reklam", creatives: creatives || [] };
      if (label) ADS[slotName].label = label;
      if (creatives) ADS[slotName].creatives = creatives;

      // remote creatives varsa preload
      if (creatives) creatives.forEach(c => preloadImage((c.image || "").trim()));
    });
  }

  async function loadRemoteAds() {
    try {
      const r = await fetch("/api/ads", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok || !j.slots) return;

      mergeRemoteSlots(j.slots);

      // ✅ PREROLL'u da Sheets'ten al (varsa)
      if (j.preroll && typeof j.preroll === "object") {
        ADS.preroll = j.preroll;

        // preroll creative'lerini de preload et
        if (Array.isArray(ADS.preroll.creatives)) {
          ADS.preroll.creatives.forEach(c => preloadImage((c.image || "").trim()));
        }
      }

      // Remote geldikten sonra sadece güncelle
      applyAds();


       
    } catch (e) {
      console.warn("[ads.js] remote ads failed:", e);
    }
  }

  function init() {
    // İlk anda LOCAL bas
    applyAds();
    // Remote gelince sadece swap
    loadRemoteAds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
