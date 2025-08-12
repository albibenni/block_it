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
