interface SiteConfig {
  whitelistedPaths: string[];
  blocked: boolean;
}

class TestProxy {
  private blockedSites: Map<string, SiteConfig>;

  constructor() {
    this.blockedSites = new Map();
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

      console.log(`Testing: ${targetUrl}`);
      console.log(`Domain: ${domain}, Path: ${fullPath}`);

      const siteConfig = this.blockedSites.get(domain);
      if (!siteConfig || !siteConfig.blocked) {
        console.log("Not blocked (not in list)");
        return false;
      }

      // Check if path is whitelisted - FIXED VERSION
      for (const whitelistedPath of siteConfig.whitelistedPaths) {
        console.log(`Checking whitelist: ${whitelistedPath}`);
        if (
          fullPath === whitelistedPath ||
          fullPath.startsWith(whitelistedPath + "/") ||
          fullPath.startsWith(whitelistedPath + "?")
        ) {
          console.log("Whitelisted!");
          return false;
        }
      }

      console.log("BLOCKED!");
      return true;
    } catch (error) {
      console.log("Error:", (error as Error).message);
      return false;
    }
  }
}

// Test your scenario with FIXED logic
const proxy = new TestProxy();
proxy.addBlockedSite("youtube.com", ["/not"]);

console.log("=== Testing FIXED YouTube blocking scenario ===\n");

console.log("1. youtube.com/not (should be whitelisted):");
console.log("Result:", !proxy.shouldBlockUrl("https://youtube.com/not"));

console.log("\n2. youtube.com/not/some/path (should be whitelisted):");
console.log(
  "Result:",
  !proxy.shouldBlockUrl("https://youtube.com/not/some/path"),
);

console.log("\n3. youtube.com/nothing (should be blocked - BUG WAS HERE):");
console.log("Result:", proxy.shouldBlockUrl("https://youtube.com/nothing"));

console.log("\n4. youtube.com (should be blocked):");
console.log("Result:", proxy.shouldBlockUrl("https://youtube.com"));

console.log("\n5. youtube.com/watch (should be blocked):");
console.log("Result:", proxy.shouldBlockUrl("https://youtube.com/watch?v=123"));

