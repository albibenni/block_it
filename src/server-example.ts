import { PfctlBlocker } from "./pfctl_blocker.ts";
import http from "node:http";
import url from "node:url";
import {
  domain_blocker,
  remove_blocks,
} from "./service/domain_blocker.service.ts";
import type { DomainBlocker } from "./domain_blocker.ts";

type AsyncRequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => Promise<void>;

function createServerAsync(
  requestHandler: AsyncRequestHandler,
): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requestHandler(req, res).catch((error) => {
        console.error("Request handler error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      });
    });

    resolve(server);
  });
}

function listenAsync(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => resolve());
  });
}

async function startServer() {
  try {
    let block: DomainBlocker | undefined = undefined;
    const server = await createServerAsync(async (req, res) => {
      const parsedUrl = url.parse(req.url || "", true);
      if (req.method === "GET" && parsedUrl.pathname === "/") {
        const updatedStatus = await block!.macOSblocker!.getStatus();
        const domains = block?.getBlockedDomains();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            message: `Block domains providing /v2/act/yt or /v2/act/net - deactivate via /v2/deact`,
            domains: domains,
            status: updatedStatus,
          }),
        );
      }
      if (req.method === "GET" && parsedUrl.pathname === "/v2/act/yt") {
        block = await domain_blocker([
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "music.youtube.com",
          "youtubei.googleapis.com",
          "youtube.googleapis.com",
          "youtu.be",
          "ytimg.com",
          "googlevideo.com",
          "yt3.ggpht.com",
          "youtube-nocookie.com",
        ]);
      }
      if (req.method === "GET" && parsedUrl.pathname === "/v2/act/net") {
        block = await domain_blocker([
          "netflix.com",
          "www.netflix.com",
          "movies.netflix.com",
          "ichnaea.netflix.com",
          "nflxvideo.net",
          "cdn1.nflxext.com",
          "netflix.net",
          "netflixdnstest0.com",
          "netflixdnstest1.com",
          "netflixdnstest2.com",
          "netflixdnstest3.com",
          "netflixdnstest4.com",
          "netflixdnstest5.com",
          "netflixdnstest6.com",
          "netflixdnstest7.com",
          "netflixdnstest8.com",
          "netflixdnstest9.com",
        ]);
      }
      if (req.method === "GET" && parsedUrl.pathname === "/v2/deact") {
        await remove_blocks(block);
      }

      if (req.method === "GET" && parsedUrl.pathname === "/activate") {
        const blockera = new PfctlBlocker({
          enableLogging: true,
        });

        // Block domains - comprehensive YouTube blocking
        await blockera.blockDomains([
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "music.youtube.com",
          "youtubei.googleapis.com",
          "youtube.googleapis.com",
          "youtu.be",
          "ytimg.com",
          "googlevideo.com",
          "yt3.ggpht.com",
          "youtube-nocookie.com",
          "bad-site.com",
        ]);

        // Get current status
        const status = await blockera.getStatus();
        console.log("Enabled:", status.enabled);

        // Check if domains parameter is provided for blocking
        const domainsParam = parsedUrl.query.domains;
        if (domainsParam) {
          const domains =
            typeof domainsParam === "string"
              ? domainsParam.split(",").map((d) => d.trim())
              : [];

          if (domains.length > 0) {
            await blockera.blockDomains(domains);
            const updatedStatus = await blockera.getStatus();

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                message: `Blocked ${domains.length} domains`,
                domains: domains,
                status: updatedStatus,
              }),
            );
            return;
          }
        }

        // Return current status
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status }));
      } else if (req.method === "GET" && parsedUrl.pathname === "/remove") {
        const blocker = new PfctlBlocker({ enableLogging: true });
        await blocker.removeAllRules();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "All rules removed" }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    });

    await listenAsync(server, 8080);
    console.log("Server started on port 8080");
  } catch (error) {
    console.error("Server failed to start:", error);
  }
}

// Call with void operator if linter requires it
void startServer();

// const server: http.Server = http.createServer((req, res) => {
//   const parsedUrl = url.parse(req.url || "", true);
//   let blocker: PfctlBlocker | null = null;
//
//   if (req.method === "GET" && parsedUrl.pathname === "/activate") {
//     void (async () => {
//       try {
//         blocker = new PfctlBlocker({
//           enableLogging: true,
//         });
//
//         // Block domains
//         await blocker.blockDomains([
//           "youtube.com",
//           "example.com",
//           "bad-site.com",
//         ]);
//
//         // Get current status
//         const status = await blocker.getStatus();
//         console.log("Enabled:", status.enabled);
//
//         // Check if domains parameter is provided for blocking
//         const domainsParam = parsedUrl.query.domains;
//         if (domainsParam) {
//           const domains =
//             typeof domainsParam === "string"
//               ? domainsParam.split(",").map((d) => d.trim())
//               : [];
//
//           if (domains.length > 0) {
//             await blocker.blockDomains(domains);
//             const updatedStatus = await blocker.getStatus();
//
//             res.writeHead(200, { "Content-Type": "application/json" });
//             res.end(
//               JSON.stringify({
//                 message: `Blocked ${domains.length} domains`,
//                 domains: domains,
//                 status: updatedStatus,
//               }),
//             );
//             return;
//           }
//         }
//
//         // Return current status
//         res.writeHead(200, { "Content-Type": "application/json" });
//         res.end(JSON.stringify({ status }));
//       } catch (error) {
//         res.writeHead(500, { "Content-Type": "application/json" });
//         res.end(
//           JSON.stringify({
//             error: "Failed to get status or block domains",
//             details: (error as Error).message,
//           }),
//         );
//       }
//     })();
//     if (req.method === "GET" && parsedUrl.pathname === "/activate") {
//       if (blocker) {
//         await blocker.removeAllRules();
//       }
//     }
//   } else {
//     res.writeHead(404, { "Content-Type": "application/json" });
//     res.end(JSON.stringify({ error: "Not Found" }));
//   }
// });
//
// // // Start server
// // const PORT = process.env.PORT || 3000;
// // server.listen(PORT, () => {
// //   console.log(`Server running on port ${PORT}`);
// //   console.log(`GET /status - Check firewall status`);
// //   console.log(
// //     `GET /status?domains=example.com,youtube.com - Block domains and get status`,
// //   );
// // });
