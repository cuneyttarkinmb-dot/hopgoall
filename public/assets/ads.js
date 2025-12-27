/* =========================================================
   HopGoal Ads (SAFE + BG ADS + PREROLL)

   Slotlar:
   - top_banner
   - sidebar_rectangle
   - floating
   - interstitial
   - bg_left / bg_right   (arka plan sağ-sol)
   - native[]             (liste içine)
   - preroll              (video başlamadan önce reklam)

   NOT: popup/popunder KAPALI (siteyi bozmasın)
   ========================================================= */

(function () {
  const LS = {
    interstitial: "hg_ad_interstitial_last",
    floatingClosed: "hg_ad_floating_closed",
  };

  function minutesSince(ts) {
    const n = Number(ts || 0);
    if (!n) return Infinity;
    return (Date.now() - n) / 60000;
  }

  /* =========================================================
     [REKLAM AYARLARI] Buradan değiştir
     ========================================================= */
  const ADS = {
    /* ÜST BANNER */
    top_banner: {
      label: "Banner",
      creatives: [
        { image: "/banner-970x90.gif", clickUrl: "https://example.com/banner1", alt: "Top Banner 1" },
        { image: "/banner-970x90-2.gif", clickUrl: "https://example.com/banner2", alt: "Top Banner 2" },
      ],
    },

    /* SAĞ PANEL (SIDEBAR) */
    sidebar_rectangle: {
      label: "Sidebar",
      creatives: [
        { image: "/sidebar-300x250.gif", clickUrl: "https://example.com/sidebar", alt: "Sidebar Ad" },
      ],
    },

    /* SAĞ-ALT FLOATING */
    floating: {
      label: "Floating",
      showAfterMs: 2500,
      creatives: [
        { image: "/floating-300x250.gif", clickUrl: "https://example.com/floating", alt: "Floating Ad" },
      ],
    },

    /* AÇILIŞTA INTERSTITIAL */
    interstitial: {
      label: "Interstitial",
      showAfterMs: 1200,
      frequencyMinutes: 60,
      creatives: [
        { image: "/interstitial-900x500.gif", clickUrl: "https://example.com/interstitial", alt: "Interstitial Ad" },
      ],
    },

    /* SAĞ-SOL ARKA PLAN REKLAMLARI (WALLPAPER) */
    bg_left: {
      label: "BG Left",
      creatives: [
        // İstersen buraya daha uzun görseller koy: örn /bg-left.jpg
        { image: "/interstitial-900x500.gif", clickUrl: "https://example.com/bg-left", alt: "BG Left" },
      ],
    },
    bg_right: {
      label: "BG Right",
      creatives: [
        { image: "/interstitial-900x500.gif", clickUrl: "https://example.com/bg-right", alt: "BG Right" },
      ],
    },

    /* LİSTE İÇİ NATIVE */
    native: [
      {
        id: "native-1",
        tab: "match",
        after: 1,
        title: "Native Reklam: Özel Teklif",
        text: "Tıkla, kampanyayı gör.",
        image: "/native-600x200.gif",
        clickUrl: "https://example.com/native1",
      },
      {
        id: "native-2",
        tab: "channel",
        after: 2,
        title: "Native Reklam: Sponsor",
        text: "Detaylar için tıkla.",
        image: "/native-600x200-2.gif",
        clickUrl: "https://example.com/native2",
      }
    ],

    /* PREROLL (YAYIN SEÇİNCE PLAYER İÇİNDE REKLAM) */
    preroll: {
      enabled: true,

      // ✅ SÜRE AYARI (İSTEDİĞİN GİBİ DEĞİŞTİR)
      durationSeconds: 15,

      // ✅ SON KAÇ SANİYE KALINCA "GEÇ" AÇILSIN
      skippableLastSeconds: 5,

      creatives: [
        // İstersen ayrı dosya koy: /preroll-800x450.gif
        { image: "/interstitial-900x500.gif", clickUrl: "https://example.com/preroll", alt: "PreRoll Ad" },
      ],
    },

    /* POPUP/POPUNDER KAPALI */
    popup: { enabled: false },
  };

  window.HOPGOAL_ADS = ADS;

  function pick(slot) {
    const s = ADS[slot];
    if (!s || !Array.isArray(s.creatives) || s.creatives.length === 0) return null;
    return s.creatives[Math.floor(Math.random() * s.creatives.length)];
  }

  function renderSlot(el, slotName) {
    const s = ADS[slotName];
    if (!s) return;

    const c = pick(slotName) || {};
    const imgSrc = c.image || "";
    const clickUrl = c.clickUrl || "#";
    const alt = c.alt || "Reklam";

    el.innerHTML = `
      <div class="ad-label">${s.label || "Reklam"}</div>
      <a class="ad-link" href="${clickUrl}" target="_blank" rel="sponsored noopener noreferrer">
        <img class="ad-img" src="${imgSrc}" alt="${alt}">
      </a>
    `;
  }

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

  function setupFloating() {
    const slot = ADS.floating;
    const wrap = document.getElementById("adFloating");
    if (!slot || !wrap) return;

    if (sessionStorage.getItem(LS.floatingClosed) === "1") return;

    setTimeout(() => {
      renderSlot(wrap, "floating");
      wrap.classList.remove("hidden");
    }, slot.showAfterMs || 2500);

    const closeBtn = document.getElementById("adFloatingClose");
    closeBtn && closeBtn.addEventListener("click", () => {
      wrap.classList.add("hidden");
      sessionStorage.setItem(LS.floatingClosed, "1");
    });
  }

  function init() {
    // data-ad-slot olan her şeyi bas
    document.querySelectorAll("[data-ad-slot]").forEach((el) => {
      const slot = el.getAttribute("data-ad-slot");
      if (slot === "floating") return; // floating özel
      renderSlot(el, slot);
    });

    setupInterstitial();
    setupFloating();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
