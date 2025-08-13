export type PfctlOptions = {
  enableLogging?: boolean;
};

// Status return type
export interface PfctlStatus {
  enabled: boolean;
  rules: string;
}

export interface IPfctlBlocker {
  /**
   * Block multiple domains by resolving them to IP addresses and applying pfctl rules
   * @param domains Array of domain names to block
   * @throws Error if no IP addresses can be resolved or pfctl fails
   */
  blockDomains(domains: string[]): Promise<void>;

  /**
   * Block a specific IP address
   * @param ip IP address to block (IPv4 or IPv6)
   * @throws Error if pfctl command fails
   */
  blockIp(ip: string): Promise<void>;

  /**
   * Remove all pfctl rules and disable the firewall
   * @throws Error if pfctl command fails
   */
  removeAllRules(): Promise<void>;

  /**
   * Check if pfctl firewall is currently enabled
   * @returns Promise resolving to true if enabled, false otherwise
   */
  isEnabled(): Promise<boolean>;

  /**
   * Get current pfctl status and rules
   * @returns Promise resolving to status object with enabled state and rules
   * @throws Error if unable to fetch status
   */
  getStatus(): Promise<PfctlStatus>;

  /**
   * Refresh blocked domains by re-resolving IPs and updating rules
   * @param domains Array of domain names to refresh blocking for
   * @throws Error if refresh operation fails
   */
  refreshBlockedDomains(domains: string[]): Promise<void>;
}
