import { exec } from "node:child_process";
import { promisify } from "node:util";

export const execAsync = promisify(exec);
/**
 * Logs an error message to the console based on the type of error.
 *
 * This utility function handles different error types:
 * - If the error is a string, it logs the uppercase string
 * - If the error is an Error object, it logs the error message
 *
 * @param {unknown} e - The error to be logged, can be of any type
 * @returns {void} This function doesn't return anything
 *
 * @example
 * // Logs "ERROR MESSAGE" to console
 * handleErrorLog("error message");
 *
 * @example
 * // Logs "Error details" to console
 * handleErrorLog(new Error("Error details"));
 */
export function handleErrorLog(e: unknown, other?: string): void {
  if (typeof e === "string") {
    console.log((other ? other + " " : "") + e.toUpperCase()); // works, `e` narrowed to string
  } else if (e instanceof Error) {
    console.log((other ? other + " " : "") + e.message); // works, `e` narrowed to Error
  }
}

/**
 * Retrieves all IP addresses associated with a domain name using the dig command.
 *
 * This function executes the `dig +short` command to resolve a domain name
 * to its IP addresses. It returns the raw output from the dig command, which
 * typically contains one or more IP addresses separated by newlines.
 *
 * @param {string} domainName - The domain name to resolve (e.g., "example.com")
 * @returns {Promise<string>} A promise that resolves to a string containing
 *                           the IP addresses returned by dig, separated by newlines
 *
 * @throws Will log stderr output if the dig command produces errors, but continues execution
 *
 * @example
 * // Get IP addresses for a domain
 * const ips = await getAllIpsFromDomain("google.com");
 * console.log(ips); // "142.250.191.14\n2607:f8b0:4004:c1b::65\n"
 *
 * @example
 * // Handle domains with multiple A records
 * const ips = await getAllIpsFromDomain("cloudflare.com");
 * const ipList = ips.trim().split('\n');
 */
export async function getAllIpsFromDomain(domainName: string): Promise<string> {
  const { stdout, stderr } = await execAsync(`dig +short ${domainName}`);
  if (stderr) {
    // console.warn("dig stderr:", stderr);
    handleErrorLog(stderr, "dig command stderr");
  }
  return stdout;
}
