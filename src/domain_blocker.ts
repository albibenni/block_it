import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as os from "os";
import { handleErrorLog } from "./utils.ts";

const execAsync = promisify(exec);

export type BlockingRule = {
  domain: string;
  ports: number[];
  protocol: "tcp" | "udp";
};

export class DomainBlocker {
  private blockedDomains: Set<string> = new Set();
  private readonly persistentRulesFile = "/etc/iptables/rules.v4";
  private readonly isMacOS = os.platform() === "darwin";

  /**
   * Block a domain using string matching in iptables
   */
  async blockDomain(domain: string): Promise<void> {
    try {
      // Validate domain format
      if (!this.isValidDomain(domain)) {
        throw new Error(`Invalid domain format: ${domain}`);
      }

      // Check if already blocked
      if (this.blockedDomains.has(domain)) {
        console.log(`Domain ${domain} is already blocked`);
        return;
      }

      const rules = this.generateBlockingRules(domain);

      // Apply each rule
      for (const rule of rules) {
        await execAsync(rule);
        console.log(`Applied rule: ${rule}`);
      }

      this.blockedDomains.add(domain);
      console.log(`Successfully blocked domain: ${domain}`);

      // Make rules persistent
      await this.persistRules();
    } catch (error) {
      console.error(`Failed to block domain ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Unblock a domain by removing iptables rules
   */
  async unblockDomain(domain: string): Promise<void> {
    try {
      const rules = this.generateBlockingRules(domain, true); // Generate removal rules

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

      await this.persistRules();
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
      domains.map((domain) => this.blockDomain(domain)),
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
   * Generate platform-specific rules for domain blocking
   */
  private generateBlockingRules(domain: string, remove = false): string[] {
    if (this.isMacOS) {
      return this.generateMacOSRules(domain, remove);
    } else {
      return this.generateLinuxRules(domain, remove);
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
   * Generate pfctl rules for macOS domain blocking
   */
  private generateMacOSRules(domain: string, remove = false): string[] {
    const rules: string[] = [];
    const ruleFile = `/tmp/block_${domain.replace(/\./g, "_")}.conf`;

    if (remove) {
      // Remove domain-specific rules by recreating rules file without this domain
      rules.push(`sudo rm -f ${ruleFile}`);
      // Reload pfctl with base configuration
      rules.push("sudo pfctl -f /etc/pf.conf");
      rules.push("sudo pfctl -e");
    } else {
      // Create pfctl rules that block DNS resolution for the specific domain
      const pfRules = [
        `# Block ${domain}`,
        `block drop out quick proto {tcp,udp} to any port 53 user {$(id -u)}`,
        `block drop out quick proto {tcp,udp} from any to any port {80,443} user {$(id -u)}`,
        `# End block for ${domain}`,
      ];

      // Write rules to temp file and load them
      rules.push(`echo '${pfRules.join("\\n")}' | sudo tee ${ruleFile}`);
      rules.push(`sudo pfctl -f ${ruleFile}`);
      rules.push("sudo pfctl -e");
    }

    return rules;
  }

  /**
   * Make rules persistent across reboots
   */
  private async persistRules(): Promise<void> {
    if (this.isMacOS) {
      await this.persistMacOSRules();
    } else {
      await this.persistLinuxRules();
    }
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
   * Make pfctl rules persistent across reboots (macOS)
   */
  private async persistMacOSRules(): Promise<void> {
    try {
      // Create a consolidated pfctl rules file with all blocked domains
      const consolidatedRules = `/etc/pf.anchors/block_domains`;
      const allRules: string[] = [];

      // Add header
      allRules.push("# Domain blocking rules generated by DomainBlocker");

      // Add rules for each blocked domain
      for (const domain of this.blockedDomains) {
        allRules.push(`# Block ${domain}`);
        allRules.push(
          `block drop out quick proto {tcp,udp} to any port 53 user {$(id -u)}`,
        );
        allRules.push(
          `block drop out quick proto {tcp,udp} from any to any port {80,443} user {$(id -u)}`,
        );
      }

      // Write consolidated rules
      await fs.writeFile(consolidatedRules, allRules.join("\n"));

      // Update main pf.conf to include our anchor
      const pfConfPath = "/etc/pf.conf";
      const anchorLine =
        'load anchor "block_domains" from "/etc/pf.anchors/block_domains"';

      try {
        const pfConf = await fs.readFile(pfConfPath, "utf8");
        if (!pfConf.includes(anchorLine)) {
          const updatedConf = pfConf + "\n" + anchorLine + "\n";
          await fs.writeFile(pfConfPath + ".backup", pfConf);
          await fs.writeFile(pfConfPath, updatedConf);
        }

        console.log("pfctl rules made persistent in /etc/pf.conf");
      } catch (error) {
        handleErrorLog(
          error,
          "Note: Could not automatically update /etc/pf.conf. Add this line manually:",
        );
        console.log(`  ${anchorLine}`);
      }
    } catch (error) {
      handleErrorLog(error, "Failed to persist pfctl rules");
      console.log("Rules are active for current session only");
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
   * Validate domain name format
   */
  private isValidDomain(domain: string): boolean {
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
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
    const domains = Array.from(this.blockedDomains);

    for (const domain of domains) {
      await this.unblockDomain(domain);
    }

    console.log("All domain blocks cleared");
  }

  /**
   * Initialize blocker and restore previous state
   */
  async initialize(): Promise<void> {
    try {
      if (this.isMacOS) {
        // Check if pfctl is available on macOS
        await execAsync("sudo pfctl -s info");
        console.log("pfctl is available for domain blocking");
      } else {
        // Check if iptables supports string matching on Linux
        await execAsync("sudo iptables -m string --help");
        console.log("iptables string matching module is available");
      }
    } catch (error) {
      handleErrorLog(error, "Network filtering tool check failed:");
      const tool = this.isMacOS ? "pfctl" : "iptables";
      const instruction = this.isMacOS
        ? "pfctl should be available by default on macOS"
        : "Install iptables-extensions";
      throw new Error(
        `${tool} not available or properly configured. ${instruction}.`,
      );
    }
  }
}
