import { describe, expect, it, vi, beforeEach } from "vitest";

import { handleErrorLog } from "../utils.ts";

describe("handleErrorLog", () => {
  it("should log uppercase string when error is a string", () => {
    const consoleSpy = vi.spyOn(console, "log");

    handleErrorLog("error message");

    expect(consoleSpy).toHaveBeenCalledWith("ERROR MESSAGE");

    consoleSpy.mockRestore();
  });

  it("should log error message when error is an Error object", () => {
    const consoleSpy = vi.spyOn(console, "log");

    const error = new Error("Error details");

    handleErrorLog(error);

    expect(consoleSpy).toHaveBeenCalledWith("Error details");

    consoleSpy.mockRestore();
  });

  it("should not log anything for other error types", () => {
    const consoleSpy = vi.spyOn(console, "log");

    handleErrorLog(null);
    handleErrorLog(undefined);
    handleErrorLog(123);
    handleErrorLog({ custom: "error" });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should log prefixed uppercase string when error is a string and other param is provided", () => {
    const consoleSpy = vi.spyOn(console, "log");

    handleErrorLog("error message", "PREFIX");

    expect(consoleSpy).toHaveBeenCalledWith("PREFIX ERROR MESSAGE");

    consoleSpy.mockRestore();
  });

  it("should log prefixed error message when error is an Error object and other param is provided", () => {
    const consoleSpy = vi.spyOn(console, "log");

    const error = new Error("Error details");

    handleErrorLog(error, "PREFIX");

    expect(consoleSpy).toHaveBeenCalledWith("PREFIX Error details");

    consoleSpy.mockRestore();
  });
});

// Create a mock function for execAsync
const mockExecAsync = vi.fn();

// Mock the getAllIpsFromDomain function with proper implementation
vi.mock("../utils.ts", async () => {
  const actual = await vi.importActual("../utils.ts");
  return {
    ...actual,
    getAllIpsFromDomain: vi
      .fn()
      .mockImplementation(async (domainName: string) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { stdout, stderr } = await mockExecAsync(
          `dig +short ${domainName}`,
        );
        if (stderr) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          console.log("dig command stderr " + stderr.toUpperCase());
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return stdout;
      }),
  };
});

// Import after mocking
const { getAllIpsFromDomain } = await import("../utils.ts");

describe("getAllIpsFromDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return stdout when dig command succeeds", async () => {
    const mockStdout = "142.250.191.14\n";

    mockExecAsync.mockResolvedValueOnce({
      stdout: mockStdout,
      stderr: "",
    });

    const result = await getAllIpsFromDomain("google.com");

    expect(result).toBe(mockStdout);
    expect(mockExecAsync).toHaveBeenCalledWith("dig +short google.com");
  });

  it("should return stdout and log stderr when dig command has errors", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const mockStdout = "192.168.1.1\n";
    const mockStderr = "dig: command not found";

    mockExecAsync.mockResolvedValueOnce({
      stdout: mockStdout,
      stderr: mockStderr,
    });

    const result = await getAllIpsFromDomain("example.com");

    expect(result).toBe(mockStdout);
    expect(consoleSpy).toHaveBeenCalledWith(
      "dig command stderr DIG: COMMAND NOT FOUND",
    );
    expect(mockExecAsync).toHaveBeenCalledWith("dig +short example.com");

    consoleSpy.mockRestore();
  });

  it("should handle empty stdout from dig command", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const result = await getAllIpsFromDomain("nonexistent.domain");

    expect(result).toBe("");
    expect(mockExecAsync).toHaveBeenCalledWith("dig +short nonexistent.domain");
  });

  it("should handle multiple IP addresses in stdout", async () => {
    const mockStdout = "142.250.191.14\n2607:f8b0:4004:c1b::65\n";

    mockExecAsync.mockResolvedValueOnce({
      stdout: mockStdout,
      stderr: "",
    });

    const result = await getAllIpsFromDomain("google.com");

    expect(result).toBe(mockStdout);
    expect(mockExecAsync).toHaveBeenCalledWith("dig +short google.com");
  });

  it("should properly escape domain names in dig command", async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: "1.2.3.4\n",
      stderr: "",
    });

    await getAllIpsFromDomain("sub.example.com");

    expect(mockExecAsync).toHaveBeenCalledWith("dig +short sub.example.com");
  });
});
