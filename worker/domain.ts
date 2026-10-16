const PREFIX = "/tools/madori";
const UPSTREAM = "https://yuzora-yu.github.io/madori";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`))
      return new Response("Not Found", { status: 404 });
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    if (url.pathname === PREFIX) {
      url.pathname += "/";
      return Response.redirect(url.href, 308);
    }
    const upstream = new URL(UPSTREAM + url.pathname.slice(PREFIX.length));
    // Only public static files cross this boundary; never forward site cookies or credentials.
    const response = await fetch(upstream, {
      method: request.method,
      headers: { Accept: request.headers.get("Accept") || "*/*" },
      redirect: "manual",
    });
    const headers = new Headers(response.headers);
    headers.delete("Set-Cookie");
    const location = headers.get("Location");
    if (location) {
      const target = new URL(location, upstream);
      if (
        target.origin !== upstream.origin ||
        !target.pathname.startsWith("/madori/")
      )
        return new Response("Invalid upstream redirect", { status: 502 });
      url.pathname = PREFIX + target.pathname.slice("/madori".length);
      url.search = target.search;
      headers.set("Location", url.href);
    }
    headers.set("Referrer-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    if (url.pathname.endsWith("/sw.js"))
      headers.set("Service-Worker-Allowed", `${PREFIX}/`);
    if (!/\/assets\/[^/]+-[\w-]+\.(js|css)$/.test(url.pathname))
      headers.set("Cache-Control", "no-cache");
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
