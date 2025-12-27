const $ = (s) => document.querySelector(s);

const state = {
  streams: [],
  categories: [],
  onlyLive: true,
};

function uniq(arr) {
  return [...new Set(arr)].filter(Boolean);
}

function safeText(s) {
  return String(s ?? "").trim();
}

function twitchEmbedUrl(channel) {
  // Twitch embed "parent" param ister. Biz de dinamik olarak hostname kullanıyoruz.
  const parent = encodeURIComponent(location.hostname);
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true`;
}

function buildEmbedUrl(item) {
  if (item.provider === "youtube") return item.youtubeEmbedUrl;
  if (item.provider === "twitch") return twitchEmbedUrl(item.twitchChannel);
  return item.embedUrl || "";
}

function renderCategories() {
  const sel = $("#cat");
  sel.innerHTML = `<option value="all">Tüm kategoriler</option>`;
  state.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
}

function card(item) {
  const title = safeText(item.title);
  const category = safeText(item.category || "Other");
  const provider = safeText(item.provider || "embed");
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const isLive = !!item.isLive;

  const el = document.createElement("article");
  el.className = "card";

  const badges = document.createElement("div");
  badges.className = "badges";

  const b1 = document.createElement("span");
  b1.className = "badge";
  b1.textContent = category;
  badges.appendChild(b1);

  const b2 = document.createElement("span");
  b2.className = "badge";
  b2.textContent = provider.toUpperCase();
  badges.appendChild(b2);

  if (isLive) {
    const bl = document.createElement("span");
    bl.className = "badge live";
    bl.textContent = "● CANLI";
    badges.appendChild(bl);
  }

  const h = document.createElement("h3");
  h.className = "title";
  h.textContent = title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = tags.length ? `Etiketler: ${tags.join(", ")}` : " ";

  const row = document.createElement("div");
  row.className = "row";

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.type = "button";
  btn.textContent = "▶ İzle";
  btn.onclick = () => openPlayer(item);

  const src = document.createElement("a");
  src.className = "btn";
  src.href = item.sourceUrl || "#";
  src.target = "_blank";
  src.rel = "noreferrer";
  src.textContent = "↗ Kaynak";
  if (!item.sourceUrl) {
    src.style.opacity = ".5";
    src.style.pointerEvents = "none";
  }

  row.appendChild(btn);
  row.appendChild(src);

  el.appendChild(badges);
  el.appendChild(h);
  el.appendChild(meta);
  el.appendChild(row);

  return el;
}

function applyFilters() {
  const q = safeText($("#q").value).toLowerCase();
  const cat = $("#cat").value;
  const onlyLive = state.onlyLive;

  let filtered = state.streams.slice();

  if (onlyLive) filtered = filtered.filter((s) => !!s.isLive);
  if (cat !== "all") filtered = filtered.filter((s) => (s.category || "Other") === cat);

  if (q) {
    filtered = filtered.filter((s) => {
      const t = safeText(s.title).toLowerCase();
      const c = safeText(s.category).toLowerCase();
      const tags = (Array.isArray(s.tags) ? s.tags.join(" ") : "").toLowerCase();
      return t.includes(q) || c.includes(q) || tags.includes(q);
    });
  }

  const grid = $("#grid");
  grid.innerHTML = "";
  filtered.forEach((s) => grid.appendChild(card(s)));

  $("#empty").classList.toggle("hidden", filtered.length !== 0);
}

function openPlayer(item) {
  const url = buildEmbedUrl(item);
  const frame = $("#frame");

  $("#mTitle").textContent = safeText(item.title);
  $("#mMeta").textContent = `${safeText(item.category || "Other")} • ${safeText(item.provider || "embed").toUpperCase()}`;

  $("#openSource").href = item.sourceUrl || url || "#";
  $("#openSource").style.opacity = (item.sourceUrl || url) ? "1" : ".5";
  $("#openSource").style.pointerEvents = (item.sourceUrl || url) ? "auto" : "none";

  // iframe src set
  frame.src = url || "about:blank";

  $("#modal").classList.remove("hidden");
}

function closePlayer() {
  $("#modal").classList.add("hidden");
  // stop playback
  $("#frame").src = "about:blank";
}

async function load() {
  const res = await fetch("./streams.json", { cache: "no-store" });
  const data = await res.json();

  state.streams = Array.isArray(data.streams) ? data.streams : [];
  state.categories = uniq(state.streams.map((s) => s.category || "Other")).sort();

  state.onlyLive = !!(data.site && data.site.defaultOnlyLive);

  $("#onlyLive").setAttribute("aria-pressed", String(state.onlyLive));
  renderCategories();
  applyFilters();
}

function wire() {
  $("#q").addEventListener("input", applyFilters);
  $("#cat").addEventListener("change", applyFilters);

  $("#onlyLive").addEventListener("click", () => {
    state.onlyLive = !state.onlyLive;
    $("#onlyLive").setAttribute("aria-pressed", String(state.onlyLive));
    $("#onlyLive").textContent = state.onlyLive ? "Sadece canlı" : "Tümü";
    applyFilters();
  });

  $("#modalClose").addEventListener("click", closePlayer);
  $("#modalX").addEventListener("click", closePlayer);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePlayer();
  });

  $("#copyLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("#copyLink").textContent = "Kopyalandı ✅";
      setTimeout(() => ($("#copyLink").textContent = "Sayfa linkini kopyala"), 1200);
    } catch {
      // ignore
    }
  });
}

wire();
load().catch(() => {
  $("#empty").classList.remove("hidden");
});

