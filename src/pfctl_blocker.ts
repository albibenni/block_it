import { exec } from "child_process";
import { promises as fs } from "fs";
import { promises as dns } from "dns";
import { promisify } from "util";
import { handleErrorLog } from "./utils.ts";
import type { IPfctlBlocker, PfctlOptions } from "./types/interfaces.ts";

const execAsync = promisify(exec);

export class PfctlBlocker implements IPfctlBlocker {
  private readonly enableLogging: boolean;

  constructor(options: PfctlOptions = {}) {
    this.enableLogging = options.enableLogging || true;
  }

  /**
   * Resolve domain names to IP addresses
   */
  async resolveDomains(domains: string[]): Promise<string[]> {
    const ips: string[] = [];

    for (const domain of domains) {
      try {
        // Resolve both IPv4 and IPv6 addresses
        const [ipv4Addresses, ipv6Addresses] = await Promise.allSettled([
          dns.resolve4(domain),
          dns.resolve6(domain),
        ]);

        if (ipv4Addresses.status === "fulfilled") {
          ips.push(...ipv4Addresses.value);
          if (this.enableLogging) {
            console.log(
              `${domain} (IPv4) -> ${ipv4Addresses.value.join(", ")}`,
            );
          }
        }

        if (ipv6Addresses.status === "fulfilled") {
          ips.push(...ipv6Addresses.value);
          if (this.enableLogging) {
            console.log(
              `${domain} (IPv6) -> ${ipv6Addresses.value.join(", ")}`,
            );
          }
        }

        if (
          ipv4Addresses.status === "rejected" &&
          ipv6Addresses.status === "rejected"
        ) {
          console.warn(`Failed to resolve ${domain}: No IP addresses found`);
        }
      } catch (error) {
        handleErrorLog(error, "Failed to resolve ");
        console.warn(` ${domain}:`, (error as Error).message);
      }
    }

    return [...new Set(ips)]; // Remove duplicates
  }

  /**
   * Generate pfctl rules from IP addresses
   */
  private generatePfRules(ips: string[]): string {
    const timestamp = new Date().toISOString();
    const ipv4Ips = ips.filter((ip) => !ip.includes(":"));
    const ipv6Ips = ips.filter((ip) => ip.includes(":"));

    const rules = [
      `# Blocked domains - Generated at ${timestamp}`,
      "",
      ...ipv4Ips.map((ip) => `block out quick to ${ip}`),
      ...ipv6Ips.map((ip) => `block out quick to ${ip}`),
      "",
    ];

    return rules.join("\n");
  }

  /**
   * Apply pfctl rules from domains
   */
  async blockDomains(domains: string[]): Promise<void> {
    try {
      if (this.enableLogging) {
        console.log(`Blocking domains: ${domains.join(", ")}`);
      }

      // Resolve domains to IPs
      const ips = await this.resolveDomains(domains);

      if (ips.length === 0) {
        throw new Error("No IP addresses resolved from provided domains");
      }

      // Generate rules
      const rules = this.generatePfRules(ips);

      // Write rules to temporary file
      const rulesFile = "/tmp/block_rules.conf";
      await fs.writeFile(rulesFile, rules, "utf8");

      if (this.enableLogging) {
        console.log(`Rules written to ${rulesFile}`);
      }

      // Enable pfctl first
      await execAsync("sudo pfctl -e").catch(() => {
        // pfctl might already be enabled, ignore error
      });

      // Load the rules
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stdout, stderr } = await execAsync(`sudo pfctl -f ${rulesFile}`);

      if (stderr && this.enableLogging) {
        console.warn("pfctl stderr:", stderr);
      }

      if (this.enableLogging) {
        console.log("Firewall rules applied successfully");
        console.log(`Blocked ${ips.length} IP addresses`);
      }
    } catch (error) {
      throw new Error(`Failed to block domains: ${(error as Error).message}`);
    }
  }

  /**
   * Add a single IP address to existing rules
   */
  async blockIp(ip: string): Promise<void> {
    try {
      const rule = `block drop out quick to ${ip}`;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stdout, stderr } = await execAsync(
        `echo "${rule}" | sudo pfctl -f -`,
      );

      if (stderr && this.enableLogging) {
        console.warn("pfctl stderr:", stderr);
      }

      if (this.enableLogging) {
        console.log(`Blocked IP: ${ip}`);
      }
    } catch (error) {
      throw new Error(`Failed to block IP ${ip}: ${(error as Error).message}`);
    }
  }

  /**
   * Remove all pfctl rules and disable firewall
   */
  async removeAllRules(): Promise<void> {
    try {
      // Flush all rules and disable
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stdout, stderr } = await execAsync("sudo pfctl -F all -d");

      if (stderr && this.enableLogging) {
        console.warn("pfctl stderr:", stderr);
      }

      if (this.enableLogging) {
        console.log("All firewall rules cleared and pfctl disabled");
      }
    } catch (error) {
      throw new Error(`Failed to clear rules: ${(error as Error).message}`);
    }
  }

  /**
   * Check if pfctl is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("sudo pfctl -s info");
      return stdout.includes("Status: Enabled");
    } catch (error) {
      handleErrorLog(error, "Failed to check pfctl status");
      return false;
    }
  }

  /**
   * Get current pfctl status and rules
   */
  async getStatus(): Promise<{ enabled: boolean; rules: string }> {
    try {
      const [infoResult, rulesResult] = await Promise.allSettled([
        execAsync("sudo pfctl -s info"),
        execAsync("sudo pfctl -s rules"),
      ]);

      const enabled =
        infoResult.status === "fulfilled" &&
        infoResult.value.stdout.includes("Status: Enabled");

      const rules =
        rulesResult.status === "fulfilled"
          ? rulesResult.value.stdout
          : "Unable to fetch rules";

      return { enabled, rules };
    } catch (error) {
      throw new Error(
        `Failed to get pfctl status: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Refresh blocked domains (re-resolve IPs and update rules)
   */
  async refreshBlockedDomains(domains: string[]): Promise<void> {
    if (this.enableLogging) {
      console.log("Refreshing blocked domains...");
    }

    await this.blockDomains(domains);
  }
}
