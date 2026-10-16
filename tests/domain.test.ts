import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/domain";
afterEach(() => vi.unstubAllGlobals());
describe("public domain routing", () => {
  it("normalizes only the app root and leaves other tools outside its scope", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const redirect = await worker.fetch(
      new Request("https://yu-zora.com/tools/madori"),
    );
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Location")).toBe(
      "https://yu-zora.com/tools/madori/",
    );
    expect(
      (
        await worker.fetch(
          new Request("https://yu-zora.com/tools/madori-extra/"),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(
          new Request("https://yu-zora.com/tools/madori/", {
            method: "POST",
            body: "private plan",
          }),
        )
      ).status,
    ).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("serves assets without passing cookies, credentials or arbitrary queries upstream", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("script", {
        headers: {
          "Content-Type": "text/javascript",
          "Set-Cookie": "secret=1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(
      new Request("https://yu-zora.com/tools/madori/sw.js?secret=private", {
        headers: { Cookie: "session=private", Authorization: "Bearer private" },
      }),
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url.href).toBe("https://yuzora-yu.github.io/madori/sw.js");
    expect(init.headers).toEqual({ Accept: "*/*" });
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Service-Worker-Allowed")).toBe(
      "/tools/madori/",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(await response.text()).toBe("script");
  });
  it("keeps redirects on the public domain and preserves missing-file responses", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 301,
        headers: { Location: "https://yuzora-yu.github.io/madori/" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(
      new Request("https://yu-zora.com/tools/madori/index.html"),
    );
    expect(response.headers.get("Location")).toBe(
      "https://yu-zora.com/tools/madori/",
    );
    fetch.mockResolvedValue(new Response("missing", { status: 404 }));
    expect(
      (
        await worker.fetch(
          new Request("https://yu-zora.com/tools/madori/missing.js"),
        )
      ).status,
    ).toBe(404);
    fetch.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.com/" },
      }),
    );
    expect(
      (await worker.fetch(new Request("https://yu-zora.com/tools/madori/")))
        .status,
    ).toBe(502);
  });
});
