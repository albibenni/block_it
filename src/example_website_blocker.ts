import { LocalProxyServer } from "./website_blocker.ts";

function main() {
  // Example usage
  if (import.meta.url === `file://${process.argv[1]}`) {
    const proxy = new LocalProxyServer(8888);

    // Block YouTube entirely except for specific paths
    proxy.addBlockedSite("youtube.com", [
      "/not",
      "/educational",
      "/watch?v=fTKqtvXjkvo",
    ]);

    // Block Facebook with no whitelisted paths (block everything)
    proxy.addBlockedSite("facebook.com");

    // Block Twitter but allow direct messages and settings
    proxy.addBlockedSite("twitter.com", ["/messages", "/settings"]);

    // Block Reddit but allow specific subreddits
    proxy.addBlockedSite("reddit.com", ["/r/programming", "/r/typescript"]);

    // Start the proxy server
    proxy.start();

    console.log("Proxy server started!");
    console.log("Configure your browser to use HTTP proxy: localhost:8888");
    console.log("");
    console.log("Blocking rules:");
    console.log("- youtube.com blocked, except /not and /educational");
    console.log("- facebook.com completely blocked");
    console.log("- twitter.com blocked, except /messages and /settings");
    console.log(
      "- reddit.com blocked, except /r/programming and /r/typescript",
    );
    console.log("");
    console.log("Press Ctrl+C to stop the server");

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.log("\nShutting down proxy server...");
      proxy.stop();
      process.exit(0);
    });
  }
}

main();
