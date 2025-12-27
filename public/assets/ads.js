/* =========================================================
   HopGoal Custom Ads (NO Google Ads)
   - Banner / Sidebar / Floating / Interstitial / Popup(Pop-under style) / Native
   - Slot açıklamaları HTML comment olarak live.html içinde
   - Görselleri/GIFleri: public/ads/ klasörüne koyup path'i değiştir
   ========================================================= */

(function () {
  const LS = {
    interstitial: "hg_ad_interstitial_last",
    popup: "hg_ad_popup_last",
    floatingClosed: "hg_ad_floating_closed",
  };

  // Basit placeholder (dosya yoksa bile görüntü olsun diye)
  function placeholderDataUri(text, w = 970, h = 90) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#4de1ff" stop-opacity=".25"/><stop offset="1" stop-color="#a855f7" stop-opacity=".22"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="rgba(255,255,255,0.04)" />` +
      `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="url(#g)" stroke="rgba(255,255,255,0.18)"/>` +
      `<text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="rgba(234,242,255,0.9)" font-family="system-ui,Segoe UI,Arial" font-size="18">${text}</text>` +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // ====== KENDİ REKLAMLARINI BURADAN YÖNETECEKSİN ======
  // image: kendi GIF/JPG/PNG path'in
  // clickUrl: tıklanınca gidecek adres
  // label: sitede küçük "Reklam" etiketi için
  // NOT: Linkleri kendi sitelerine göre değiştir.
  const ADS = {
    // Banner (üst)
    top_banner: {
      label: "Banner",
      sizeHint: "970x90",
      creatives: [
        {
          image: "./ads/banner-970x90.gif",
          clickUrl: "https://example.com/banner1",
          alt: "Banner Reklam 1",
        },
        {
          image: "./ads/banner-970x90-2.gif",
          clickUrl: "https://example.com/banner2",
          alt: "Banner Reklam 2",
        },
      ],
      fallback: placeholderDataUri("TOP BANNER (970x90) - kendi GIF'ini koy", 970, 90),
    },

    // Sidebar / rectangle
    sidebar_rectangle: {
      label: "Sidebar",
      sizeHint: "300x250",
      creatives: [
        {
          image: "./ads/sidebar-300x250.gif",
          clickUrl: "https://example.com/sidebar1",
          alt: "Sidebar Reklam",
        },
      ],
      fallback: placeholderDataUri("SIDEBAR (300x250)", 300, 250),
    },

    // Floating (sağ alt)
    floating: {
      label: "Floating",
      sizeHint: "300x250",
      showAfterMs: 2500,
      creatives: [
        {
          image: "./ads/floating-300x250.gif",
          clickUrl: "https://example.com/floating",
          alt: "Floating Reklam",
        },
      ],
      fallback: placeholderDataUri("FLOATING (300x250)", 300, 250),
    },

    // Interstitial (sayfa açılınca full ekran)
    interstitial: {
      label: "Interstitial",
      sizeHint: "900x500",
      showAfterMs: 1200,
      frequencyMinutes: 60, // 60 dk’da 1 kez
      creatives: [
        {
          image: "./ads/interstitial-900x500.gif",
          clickUrl: "https://example.com/interstitial",
          alt: "Interstitial Reklam",
        },
      ],
      fallback: placeholderDataUri("INTERSTITIAL (900x500)", 900, 500),
    },

    // Popup/Pop-under tarzı (tarayıcı engelleyebilir)
    popup: {
      enabled: true,
      frequencyMinutes: 180, // 3 saatte 1
      // pop-under garantisi yok; biz kullanıcı tıklamasıyla yeni sekme açıyoruz
      creatives: [
        {
          clickUrl: "https://example.com/popup",
        },
      ],
    },

    // Native ads (liste içine girer)
    // tab: "match" veya "channel" veya "both"
    // after: kaçıncı öğeden sonra eklensin
    native: [
      {
        id: "native-1",
        tab: "match",
        after: 2,
        title: "Native Reklam: Özel Teklif",
        text: "Tıkla, kampanyayı gör.",
        image: "./ads/native-600x200.gif",
        clickUrl: "https://example.com/native1",
        fallback: placeholderDataUri("NATIVE (600x200)", 600, 200),
      },
      {
        id: "native-2",
        tab: "channel",
        after: 3,
        title: "Native Reklam: Sponsor",
        text: "Detaylar için tıkla.",
        image: "./ads/native-600x200-2.gif",
        clickUrl: "https://example.com/native2",
        fallback: placeholderDataUri("NATIVE (600x200)", 600, 200),
      },
    ],
  };

  // Global erişim (app.js native reklamları buradan okuyacak)
  window.HOPGOAL_ADS = ADS;

  function pickCreative(slot) {
    const s = ADS[slot];
    if (!s || !Array.isArray(s.creatives) || s.creatives.length === 0) return null;
    return s.creatives[Math.floor(Math.random() * s.creatives.length)];
  }

  function renderSlot(el, slotName) {
    const slot = ADS[slotName];
    if (!slot) return;

    const creative = pickCreative(slotName) || {};
    const imgSrc = creative.image || slot.fallback;
    const clickUrl = creative.clickUrl || "#";
    const alt = creative.alt || slot.label || "Reklam";

    el.innerHTML = `
      <div class="ad-label">${slot.label || "Reklam"}</div>
      <a class="ad-link" href="${clickUrl}" target="_blank" rel="sponsored noopener noreferrer">
        <img class="ad-img" src="${imgSrc}" alt="${alt}">
      </a>
    `;
  }

  function minutesSince(ts) {
    const n = Number(ts || 0);
    if (!n) return Infinity;
    return (Date.now() - n) / 60000;
  }

  function setupInterstitial() {
    const slot = ADS.interstitial;
    const wrap = document.getElementById("adInterstitial");
    if (!slot || !wrap) return;

    const last = localStorage.getItem(LS.interstitial);
    if (minutesSince(last) < (slot.frequencyMinutes || 60)) return;

    setTimeout(() => {
      // render creative
      const creative = pickCreative("interstitial") || {};
      const imgSrc = creative.image || slot.fallback;
      const clickUrl = creative.clickUrl || "#";
      const alt = creative.alt || "Interstitial Reklam";

      const img = wrap.querySelector("img");
      const a = wrap.querySelector("a");
      img.src = imgSrc;
      img.alt = alt;
      a.href = clickUrl;

      wrap.classList.remove("hidden");

      localStorage.setItem(LS.interstitial, String(Date.now()));
    }, slot.showAfterMs || 1200);

    // close handlers
    const closeBtn = document.getElementById("adInterstitialClose");
    const backdrop = document.getElementById("adInterstitialBackdrop");
    [closeBtn, backdrop].forEach((x) => x && x.addEventListener("click", () => wrap.classList.add("hidden")));
  }

  function setupFloating() {
    const slot = ADS.floating;
    const wrap = document.getElementById("adFloating");
    if (!slot || !wrap) return;

    // kapatıldıysa bir daha gösterme (session)
    if (sessionStorage.getItem(LS.floatingClosed) === "1") return;

    setTimeout(() => {
      // slot render
      renderSlot(wrap, "floating");
      wrap.classList.remove("hidden");
    }, slot.showAfterMs || 2500);

    const closeBtn = document.getElementById("adFloatingClose");
    closeBtn && closeBtn.addEventListener("click", () => {
      wrap.classList.add("hidden");
      sessionStorage.setItem(LS.floatingClosed, "1");
    });
  }

  function setupPopup() {
    const slot = ADS.popup;
    if (!slot || !slot.enabled) return;

    const last = localStorage.getItem(LS.popup);
    if (minutesSince(last) < (slot.frequencyMinutes || 180)) return;

    const creative = (slot.creatives && slot.creatives[0]) || null;
    if (!creative || !creative.clickUrl) return;

    // TARAYICI ENGELLEMESİN diye "ilk kullanıcı tıklaması" ile açıyoruz
    const handler = () => {
      try {
        const w = window.open(creative.clickUrl, "_blank", "noopener,noreferrer");
        // pop-under denemesi: odağı geri al
        window.focus();
        if (w) w.blur();
      } catch {}
      localStorage.setItem(LS.popup, String(Date.now()));
      window.removeEventListener("click", handler, true);
    };

    window.addEventListener("click", handler, true);
  }

  function init() {
    // Normal slotlar
    document.querySelectorAll("[data-ad-slot]").forEach((el) => {
      const slot = el.getAttribute("data-ad-slot");
      if (slot === "floating") return; // floating özel
      renderSlot(el, slot);
    });

    setupInterstitial();
    setupFloating();
    setupPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
