import { z } from "zod/v4";

export type ObjectValues<T> = T[keyof T];

export const PLATFORM = {
  MAC: "darwin",
  LINUX: "linux",
  WINDOWS: "win32",
} as const;

export const platformSchema = z.enum([
  PLATFORM.MAC,
  PLATFORM.LINUX,
  PLATFORM.WINDOWS,
]);

//export type IOs = ObjectValues<typeof OS>;
export type IPlatform = z.infer<typeof platformSchema>;
