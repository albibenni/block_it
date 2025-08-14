import http from "http";
import url from "url";
import net from "net";

interface SiteConfig {
  whitelistedPaths: string[];
  blocked: boolean;
}

export class LocalProxyServer {
  private port: number;
  private blockedSites: Map<string, SiteConfig>;
  private server: http.Server | null;

  constructor(port: number = 8888) {
    this.port = port;
    this.blockedSites = new Map();
    this.server = null;
  }

  addBlockedSite(domain: string, whitelistedPaths: string[] = []): void {
    this.blockedSites.set(domain, {
      whitelistedPaths: whitelistedPaths.map((path) => path.toLowerCase()),
      blocked: true,
    });
  }

  shouldBlockUrl(targetUrl: string): boolean {
    try {
      const urlObj = new URL(targetUrl);
      const domain = urlObj.hostname.replace(/^www\./, "");
      const pathname = urlObj.pathname.toLowerCase();
      const search = urlObj.search.toLowerCase();
      const fullPath = pathname + search;

      const siteConfig = this.blockedSites.get(domain);
      if (!siteConfig || !siteConfig.blocked) {
        return false;
      }

      // Check if path is whitelisted
      for (const whitelistedPath of siteConfig.whitelistedPaths) {
        if (
          fullPath === whitelistedPath ||
          fullPath.startsWith(whitelistedPath + "/") ||
          fullPath.startsWith(whitelistedPath + "?")
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  start(): void {
    this.server = http.createServer((req, res) => {
      if (!req.url || !req.headers.host) {
        res.writeHead(400);
        res.end("Bad Request");
        return;
      }

      const targetUrl = req.url.startsWith("http")
        ? req.url
        : `http://${req.headers.host}${req.url}`;

      if (this.shouldBlockUrl(targetUrl)) {
        this.sendBlockedResponse(res, targetUrl);
        return;
      }

      this.forwardRequest(req, res);
    });

    // Handle HTTPS CONNECT method for SSL tunneling
    this.server.on("connect", (req, clientSocket, head) => {
      if (!req.url) {
        clientSocket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        clientSocket.end();
        return;
      }

      const targetUrl = `https://${req.url}`;

      if (this.shouldBlockUrl(targetUrl)) {
        clientSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        clientSocket.end();
        return;
      }

      this.handleConnect(req, clientSocket as net.Socket, head);
    });

    this.server.listen(this.port, () => {
      console.log(`Proxy server running on port ${this.port}`);
      console.log(`Set your browser's HTTP proxy to: localhost:${this.port}`);
    });
  }

  sendBlockedResponse(res: http.ServerResponse, blockedUrl: string): void {
    const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Site Blocked</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
                        .blocked { color: #d32f2f; font-size: 24px; }
                        .url { color: #666; font-style: italic; }
                    </style>
                </head>
                <body>
                    <div class="blocked">🚫 Site Blocked</div>
                    <p>Access to <span class="url">${blockedUrl}</span> has been blocked.</p>
                    <p>This page was blocked by your Node.js website filter.</p>
                </body>
            </html>
        `;

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Length": html.length,
    });
    res.end(html);
  }

  forwardRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!req.headers.host || !req.url) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    const hostParts = req.headers.host.split(":");
    const options = {
      hostname: hostParts[0],
      port: parseInt(hostParts[1] || "80"),
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxy, { end: true });

    proxy.on("error", (err) => {
      console.error("Proxy error:", err);
      res.writeHead(500);
      res.end("Proxy Error");
    });
  }

  handleConnect(
    req: http.IncomingMessage,
    clientSocket: net.Socket,
    head: Buffer,
  ): void {
    if (!req.url) {
      clientSocket.end();
      return;
    }

    const { hostname, port } = url.parse(`http://${req.url}`);
    const portNumber = port ? parseInt(port) : 443;
    const serverSocket = net.connect(portNumber, hostname as string, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on("error", (err) => {
      console.error("Server socket error:", err);
      clientSocket.end();
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
    }
  }
}
