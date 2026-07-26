import { createServer, request as createRequest } from "node:http";

const host = process.env.GIAN_GATEWAY_HOST || "127.0.0.1";
const port = Number(process.env.GIAN_GATEWAY_PORT || 3000);
const webPort = Number(process.env.GIAN_WEB_PORT || 3001);
const apiPort = Number(process.env.GIAN_API_PORT || 8787);

if (![port, webPort, apiPort].every(Number.isInteger)) {
  throw new Error("gateway, web, and API ports must be integers");
}

const gateway = createServer((incoming, outgoing) => {
  const targetPort = incoming.url?.startsWith("/api/") ? apiPort : webPort;
  const upstream = createRequest(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      method: incoming.method,
      path: incoming.url,
      headers: { ...incoming.headers, host: `127.0.0.1:${targetPort}` },
    },
    (response) => {
      outgoing.writeHead(response.statusCode || 502, response.headers);
      response.pipe(outgoing);
    },
  );

  upstream.on("error", () => {
    if (!outgoing.headersSent) {
      outgoing.writeHead(502, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      });
    }
    outgoing.end(JSON.stringify({ error: "local service is unavailable" }));
  });
  incoming.pipe(upstream);
});

gateway.listen(port, host, () => {
  console.log(
    `Gian Oral Practice gateway listening on http://${host}:${port}`,
  );
});
