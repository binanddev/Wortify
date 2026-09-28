// Old persisted media paths are resolved by the frontend, never Django.
export function frontendAssetPath(url) {
  return url?.startsWith("/static/react/")
    ? url.slice("/static/react".length)
    : url;
}
export function frontendAssetAliases() {
  const install = (server) =>
    server.middlewares.use((request, response, next) => {
      request.url = frontendAssetPath(request.url);
      next();
    });
  return {
    name: "wortify-frontend-asset-aliases",
    configureServer: install,
    configurePreviewServer: install,
  };
}
