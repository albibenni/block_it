import * as fs from "fs/promises";
import * as os from "os";
import { execAsync, handleErrorLog } from "./utils.ts";
import type { IPlatform } from "./types/types.ts";
import { PLATFORM } from "./types/types.ts";
import PfctlBlocker from "./pfctl_blocker.ts";

export type BlockingRule = {
  domain: string;
  ports: number[];
  protocol: "tcp" | "udp";
};

export class DomainBlocker {
  private blockedDomains: Set<string> = new Set();
  private platform: IPlatform = PLATFORM.LINUX;
  private readonly persistentRulesFile = "/etc/iptables/rules.v4";
  macOSblocker: PfctlBlocker | undefined = undefined;

  constructor(domains: string[]) {
    this.platform = os.platform() as IPlatform;
    if (this.platform === PLATFORM.MAC && this.macOSblocker === undefined) {
      this.macOSblocker = new PfctlBlocker({
        enableLogging: true,
      });
      void this.macOSblocker.blockDomains(domains);
    } else if (this.platform === PLATFORM.LINUX) {
      //TODO:
    } else {
      throw new Error("Bad choice choosing windows");
    }
  }

  /**
   * Unblock a domain by removing iptables rules
   */
  async unblockDomain(domain: string): Promise<void> {
    try {
      const rules = this.generateLinuxRules(domain, true); // Generate removal rules

      for (const rule of rules) {
        try {
          await execAsync(rule);
        } catch (error) {
          // Rule might not exist, continue
          handleErrorLog(error, `Rule removal failed (may not exist): ${rule}`);
        }
      }

      this.blockedDomains.delete(domain);
      console.log(`Successfully unblocked domain: ${domain}`);

      await this.persistLinuxRules();
    } catch (error) {
      console.error(`Failed to unblock domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Block multiple domains at once
   */
  async blockDomains(domains: string[]): Promise<void> {
    const results = await Promise.allSettled(
      domains.map((domain) => this.generateLinuxRules(domain)),
    );

    const failures = results
      .map((result, index) => ({ result, domain: domains[index] }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ domain, result }) => ({
        domain,
        error: (result as PromiseRejectedResult).reason as unknown,
      }));

    if (failures.length > 0) {
      console.error("Some domains failed to block:", failures);
    }
  }

  /**
   * Generate iptables rules for Linux domain blocking
   */
  private generateLinuxRules(domain: string, remove = false): string[] {
    const action = remove ? "-D" : "-A";
    const rules: string[] = [];

    // Block HTTP traffic (port 80)
    rules.push(
      `sudo iptables ${action} OUTPUT -p tcp --dport 80 -m string --string "Host: ${domain}" --algo bmp -j DROP`,
    );

    // Block HTTPS traffic (port 443)
    rules.push(
      `sudo iptables ${action} OUTPUT -p tcp --dport 443 -m string --string "${domain}" --algo bmp -j DROP`,
    );

    // Also block www subdomain variant
    if (!domain.startsWith("www.")) {
      rules.push(
        `sudo iptables ${action} OUTPUT -p tcp --dport 80 -m string --string "Host: www.${domain}" --algo bmp -j DROP`,
      );
      rules.push(
        `sudo iptables ${action} OUTPUT -p tcp --dport 443 -m string --string "www.${domain}" --algo bmp -j DROP`,
      );
    }

    return rules;
  }

  /**
   * Make iptables rules persistent across reboots (Linux)
   */
  private async persistLinuxRules(): Promise<void> {
    try {
      const { stdout } = await execAsync("sudo iptables-save");
      await fs.writeFile(this.persistentRulesFile, stdout);
      console.log("Rules saved to persistent storage");
    } catch (error) {
      console.error("Failed to persist rules:", error);
      // Try alternative persistence methods
      await this.tryAlternativePersistence();
    }
  }

  /**
   * Alternative persistence methods for different distributions
   */
  private async tryAlternativePersistence(): Promise<void> {
    const methods = [
      "sudo netfilter-persistent save",
      "sudo service iptables save",
      "sudo /etc/init.d/iptables save",
    ];

    for (const method of methods) {
      try {
        await execAsync(method);
        console.log(`Rules persisted using: ${method}`);
        return;
      } catch (error) {
        handleErrorLog(error, "Failed persistence method:");
        continue;
      }
    }

    console.warn("Could not find a method to persist iptables rules");
  }

  /**
   * List currently blocked domains
   */
  getBlockedDomains(): string[] {
    return Array.from(this.blockedDomains);
  }

  /**
   * Check if domain is currently blocked
   */
  isDomainBlocked(domain: string): boolean {
    return this.blockedDomains.has(domain);
  }

  /**
   * Clear all domain blocking rules
   */
  async clearAllBlocks(): Promise<void> {
    if (this.platform === PLATFORM.MAC) {
      if (this.macOSblocker === undefined) throw new Error("Blocker undefined");
      await this.macOSblocker.removeAllRules();
    } else if (this.platform === PLATFORM.LINUX) {
      const domains = Array.from(this.blockedDomains);

      for (const domain of domains) {
        await this.unblockDomain(domain);
      }

      console.log("All domain blocks cleared");
    }
  }

  /**
   * Initialize blocker and restore previous state
   */
  async initializeLinux(): Promise<void> {
    try {
      // Check if iptables supports string matching on Linux
      await execAsync("sudo iptables -m string --help");
      console.log("iptables string matching module is available");
    } catch (error) {
      handleErrorLog(error, "Network filtering tool check failed:");
      const tool = "iptables";
      const instruction = "Install iptables-extensions";
      throw new Error(
        `${tool} not available or properly configured. ${instruction}.`,
      );
    }
  }
}
