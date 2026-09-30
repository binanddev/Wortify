export function netlifyRedirects(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Set BACKEND_ORIGIN to the public HTTPS backend origin before building for Netlify.");
  }
  if (
    url.protocol !== "https:" || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash ||
    /\s/.test(value) ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("BACKEND_ORIGIN must be a public HTTPS origin without credentials, path, query or fragment.");
  }
  return [
    ...["api"].flatMap((path) => [
      `/${path} ${url.origin}/${path}/ 200!`,
      `/${path}/* ${url.origin}/${path}/:splat 200!`,
    ]),
    "/static/react/* /:splat 200",
    "/private_media/* /404.html 404!",
    "/assets/* /404.html 404",
    "/* /index.html 200",
    "",
  ].join("\n");
}
