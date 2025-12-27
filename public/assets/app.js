const $ = (s) => document.querySelector(s);

const state = {
  all: [],
  tab: "match", // match | channel
  onlyLive: true,
  activeId: null,
};

function safeText(s){ return String(s ?? "").trim(); }
function uniq(arr){ return [...new Set(arr)].filter(Boolean); }

function twitchEmbedUrl(channel) {
  const parent = encodeURIComponent(location.hostname);
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${parent}&autoplay=true`;
}

function buildEmbedUrl(item) {
  if (item.provider === "youtube") return item.youtubeEmbedUrl || "";
  if (item.provider === "twitch") return item.twitchChannel ? twitchEmbedUrl(item.twitchChannel) : "";
  return item.embedUrl || "";
}

function normalize(item){
  // kind: "match" | "channel"  (yoksa channel say)
  const kind = safeText(item.kind || item.type || "channel");
  return {
    ...item,
    kind: (kind === "match" ? "match" : "channel"),
    title: safeText(item.title),
    category: safeText(item.category || "Other"),
    league: safeText(item.league || ""),      // maçlar için opsiyonel
    time: safeText(item.time || ""),          // maçlar için opsiyonel (örn: 16:00)
    isLive: !!item.isLive,
    sourceUrl: safeText(item.sourceUrl || ""),
  };
}

function filteredList(){
  const q = safeText($("#q").value).toLowerCase();
  let list = state.all.filter(x => x.kind === state.tab);

  if (state.onlyLive) list = list.filter(x => x.isLive);

  if (q){
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

function setActive(item){
  state.activeId = item.id;

  // UI
  $("#pTitle").textContent = item.title || "Yayın";
  const metaBits = [item.category];
  if (item.league) metaBits.push(item.league);
  if (item.time) metaBits.push(item.time);
  $("#pMeta").textContent = metaBits.filter(Boolean).join(" • ");

  const src = buildEmbedUrl(item);
  $("#player").src = src || "about:blank";

  const btn = $("#btnSource");
  btn.href = item.sourceUrl || src || "#";
  btn.style.opacity = (item.sourceUrl || src) ? "1" : ".5";
  btn.style.pointerEvents = (item.sourceUrl || src) ? "auto" : "none";

  render(); // active highlight
}

function render(){
  const list = filteredList();
  const root = $("#list");
  root.innerHTML = "";

  list.forEach(item => {
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

    if (item.time){
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
  });

  $("#empty").classList.toggle("hidden", list.length !== 0);
}

function setTab(tab){
  state.tab = tab;

  $("#tabMatches").classList.toggle("active", tab === "match");
  $("#tabChannels").classList.toggle("active", tab === "channel");

  // tab değişince aktif seçimi korumuyorsa kapat
  const list = filteredList();
  if (!list.some(x => x.id === state.activeId)){
    state.activeId = null;
    $("#player").src = "about:blank";
    $("#pTitle").textContent = "Bir yayın seç";
    $("#pMeta").textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";
  }

  render();
}

async function load(){
  const res = await fetch("./streams.json", { cache: "no-store" });
  const data = await res.json();
  state.all = (Array.isArray(data.streams) ? data.streams : []).map(normalize);

  // sayfa açılınca: maç tabı + ilk canlı varsa seç
  setTab("match");
  const first = filteredList()[0] || null;
  if (first) setActive(first);
  render();
}

function wire(){
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
    state.activeId = null;
    $("#player").src = "about:blank";
    $("#pTitle").textContent = "Bir yayın seç";
    $("#pMeta").textContent = "Sağdaki listeden bir maç/kanal seçince burada açılır.";
    render();
  });
}

wire();
load().catch(() => {
  $("#empty").classList.remove("hidden");
});
