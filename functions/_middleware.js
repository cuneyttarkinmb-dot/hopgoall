export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // maintenance açık mı?
  const on = String(env.MAINTENANCE || "0") === "1";

  // bazı yollar açık kalsın (bakım sayfası, assetler vs)
  const allow =
    url.pathname === "/maintenance.html" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/api/");

  if (on && !allow) {
    // bakım sayfasını göster
    return fetch(new URL("/maintenance.html", url.origin).toString());
  }

  return next();
}
