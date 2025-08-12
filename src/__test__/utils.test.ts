import { describe, expect, it, vi } from "vitest";
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
});
