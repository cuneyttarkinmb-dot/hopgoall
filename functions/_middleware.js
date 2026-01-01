export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const on = String(env.MAINTENANCE || "0") === "1";

  // Sadece bakım sayfası ve assetler açık
  const allow =
    url.pathname === "/maintenance.html" ||
    url.pathname.startsWith("/assets/");

  if (on && !allow) {
    // Direkt file serve
    return context.env.ASSETS.fetch(new Request(new URL("/maintenance.html", url.origin)));
  }

  return next();
}
