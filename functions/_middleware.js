export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const on = String(env.MAINTENANCE || "0") === "1";

  // Bakım sayfası + statik assetler hariç her şeyi kapat
  const allow =
    url.pathname === "/maintenance.html" ||
    url.pathname.startsWith("/assets/");

  if (on && !allow) {
    return fetch(new URL("/maintenance.html", url.origin).toString(), {
      headers: { "cache-control": "no-store" },
    });
  }

  return next();
}
