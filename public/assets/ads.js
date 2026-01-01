/* =========================================================
   HopGoal Ads (FAST RENDER + REMOTE SHEETS)
   - LOCAL fallback ile boşluk bırakmaz
   - Remote (/api/ads) gelince günceller
   - enabled=0 olan slotları GÖSTERMEZ (preroll dahil)
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

  // enabled yorumlama:
  // - 0 / "0" / false => kapalı
  // - boş / undefined => açık (geriye dönük uyum)
  function isEnabled(v) {
    if (v === undefined || v === null) return true;
    const s = String(v).trim().toLowerCase();
    if (s === "") return true;
    if (s === "0" || s === "false" || s === "no") return false;
    return true;
  }

  function asNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // =========================
  // LOCAL fallback config
  // =========================
  const ADS = window.HOPGOAL_ADS || {
    top_banner: { label: "Banner", enabled: true, creatives: [{ image: "/ads/banner-970x90.gif", clickUrl: "#", alt: "Top Banner" }] },
    player_banner: { label: "Player Banner", enabled: true, creatives: [{ image: "/ads/banner-970x90-2.gif", clickUrl: "#", alt: "Player Banner" }] },
    sidebar_rectangle: { label: "Sidebar", enabled: true, creatives: [{ image: "/ads/sidebar-300x250.gif", clickUrl: "#", alt: "Sidebar" }] },
    floating: { label: "Bottom Banner", enabled: true, showAfterMs: 1200, creatives: [{ image: "/ads/banner-970x90.gif", clickUrl: "#", alt: "Bottom" }] },
    interstitial: { label: "Interstitial", enabled: true, showAfterMs: 1200, frequencyMinutes: 60, creatives: [{ image: "/ads/interstitial-900x500.gif", clickUrl: "#", alt: "Interstitial" }] },
    bg_left: { label: "BG Left", enabled: true, creatives: [{ image: "/ads/bg-left-600x1400.jpg", clickUrl: "#", alt: "BG Left" }] },
    bg_right: { label: "BG Right", enabled: true, creatives: [{ image: "/ads/bg-right-600x1400.jpg", clickUrl: "#", alt: "BG Right" }] },
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

  function clearSlot(el) {
    el.innerHTML = "";
    el.dataset.adReady = "0";
  }

  function updateSlot(el, slotName) {
    const s = ADS[slotName];
    if (!s) return;

    // enabled=0 ise slotu temizle
    if (!isEnabled(s.enabled)) {
      clearSlot(el);
      return;
    }

    const c = pick(slotName) || {};
    const imgUrl = (c.image || "").trim();

    if (!imgUrl) {
      clearSlot(el);
     AlignedSandboxedAds??;
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
    if (!isEnabled(slot.enabled)) return;

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
    if (!isEnabled(slot.enabled)) return;

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
      if (slot === "floating") return;
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

      if (!ADS[slotName]) ADS[slotName] = { label: "Reklam", enabled: true, creatives: [] };

      // label
      if (typeof remote.label === "string") ADS[slotName].label = remote.label;

      // enabled (0/1)
      if ("enabled" in remote) ADS[slotName].enabled = remote.enabled;

      // creatives
      if (Array.isArray(remote.creatives)) {
        ADS[slotName].creatives = remote.creatives;
        remote.creatives.forEach((c) => preloadImage((c.image || "").trim()));
      }

      // preroll / timing / frequency / showAfter gibi alanlar (varsa)
      if ("durationSeconds" in remote) ADS[slotName].durationSeconds = asNum(remote.durationSeconds, ADS[slotName].durationSeconds);
      if ("skippableLastSeconds" in remote) ADS[slotName].skippableLastSeconds = asNum(remote.skippableLastSeconds, ADS[slotName].skippableLastSeconds);
      if ("showAfterMs" in remote) ADS[slotName].showAfterMs = asNum(remote.showAfterMs, ADS[slotName].showAfterMs);
      if ("frequencyMinutes" in remote) ADS[slotName].frequencyMinutes = asNum(remote.frequencyMinutes, ADS[slotName].frequencyMinutes);
    });
  }

  async function loadRemoteAds() {
    try {
      const r = await fetch("/api/ads", { cache: "no-store" });
      const j = await r.json();
      if (!j || !j.ok || !j.slots) return;
      mergeRemoteSlots(j.slots);
      applyAds();
    } catch (e) {
      console.warn("[ads.js] remote ads failed:", e);
    }
  }

  function init() {
    applyAds();
    loadRemoteAds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
