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

/* =========================================================
   HopGoal Ads (Paths fixed for /public root)

   Dosyalar public/ kökünde:
   /banner-970x90.gif
   /banner-970x90-2.gif
   /sidebar-300x250.gif
   /floating-300x250.gif
   /interstitial-900x500.gif
   /native-600x200.gif
   /native-600x200-2.gif
   /bg-left-600x1400.jpg
   /bg-right-600x1400.jpg
   /preroll-800x450.gif
   ========================================================= */
/* =========================================================
   HopGoal Ads (FIXED PATHS => /ads/...)

   Senin dosyaların burada:
   public/ads/*.gif, *.jpg

   O yüzden tüm yollar:
   /ads/xxxxx.gif  veya  /ads/xxxxx.jpg
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

  const ADS = {
    top_banner: {
      label: "Banner",
      creatives: [
        { image: "/ads/banner-970x90.gif", clickUrl: "https://example.com/banner1", alt: "Top Banner 1" },
        { image: "/ads/banner-970x90-2.gif", clickUrl: "https://example.com/banner2", alt: "Top Banner 2" }
      ]
    },

    sidebar_rectangle: {
      label: "Sidebar",
      creatives: [
        { image: "/ads/sidebar-300x250.gif", clickUrl: "https://example.com/sidebar", alt: "Sidebar Ad" }
      ]
    },

floating: {
  label: "Bottom Dock",
  showAfterMs: 1200,
  creatives: [
    { image: "/ads/banner-970x90.gif", clickUrl: "https://example.com/bottom1", alt: "Bottom Banner" },
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

    // ✅ Arka plan skin
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

    // ✅ Liste içi native
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

    // ✅ Player preroll
    preroll: {
      enabled: true,
      durationSeconds: 15,
      skippableLastSeconds: 5,
      creatives: [
        { image: "/ads/preroll-800x450.gif", clickUrl: "https://example.com/preroll", alt: "PreRoll" }
      ]
    },

    // Pop-up kapalı
    popup: { enabled: false }
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
    el.innerHTML = `
      <div class="ad-label">${s.label || "Reklam"}</div>
      <a class="ad-link" href="${c.clickUrl || "#"}" target="_blank" rel="sponsored noopener noreferrer">
        <img class="ad-img" src="${c.image || ""}" alt="${c.alt || "Reklam"}" loading="lazy">
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

  // Kullanıcı bu sayfada kapattıysa tekrar gösterme
  if (sessionStorage.getItem(LS.floatingClosed) === "1") return;

  setTimeout(() => {
    // ✅ Önce kabuğu bas: X + içerik alanı
    wrap.innerHTML = `
      <!-- [BOTTOM BANNER CLOSE] Alt banner kapatma butonu -->
      <button id="adFloatingClose" class="ad-close" type="button" aria-label="Kapat">✕</button>

      <!-- [BOTTOM BANNER BODY] Reklam görseli buraya basılır -->
      <div class="ad-body"></div>
    `;
    // ✅ Reklamı ad-body içine bas (wrap’in içini ezmesin)
    const body = wrap.querySelector(".ad-body");
    renderSlot(body, "floating");

    // ✅ Göster
    wrap.classList.remove("hidden");
      sessionStorage.setItem(LS.floatingClosed, "1");
    });
  }

  function init() {
    document.querySelectorAll("[data-ad-slot]").forEach((el) => {
      const slot = el.getAttribute("data-ad-slot");
      if (slot === "floating") return;
      renderSlot(el, slot);
    });
  }, slot.showAfterMs || 2500);
}
    setupInterstitial();
    setupFloating();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/* Alt banner X butonu görünür olsun */
#adFloatingClose{
  display: grid !important;
  place-items: center !important;
  z-index: 10000 !important;
}
