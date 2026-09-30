export default async () => {
  if (process.env.BACKEND_PING_ENABLED !== "1") return;
  const origin = new URL(process.env.BACKEND_ORIGIN);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("BACKEND_ORIGIN must be an HTTPS origin.");
  }
  const response = await fetch(new URL("/api/health/check/", origin), {
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok || (await response.json()).ok !== true) {
    throw new Error("Backend health check failed.");
  }
  console.log("Backend health check succeeded.");
};
