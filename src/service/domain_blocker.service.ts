import { DomainBlocker } from "../domain_blocker.ts";

export async function domain_blocker(
  domains: string[],
): Promise<DomainBlocker | undefined> {
  try {
    const blocker = new DomainBlocker(domains);

    // Block multiple domains
    await blocker.blockDomains([
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtubei.googleapis.com",
      "youtube.googleapis.com",
      "youtu.be",
      "ytimg.com",
      "googlevideo.com",
      "yt3.ggpht.com",
      "youtube-nocookie.com",
      "bad-site.com",
      "facebook.com",
      "twitter.com",
      "instagram.com",
      "youtube.com",
    ]);

    return blocker;
  } catch (error) {
    console.error("Error:", error);
  }
}

export async function remove_blocks(
  blocker: DomainBlocker | undefined,
): Promise<void> {
  if (blocker === undefined) {
    console.error("DomainBlocker is undefined");
    return;
  }
  try {
    // Unblock multiple domains
    await blocker.clearAllBlocks();
    console.log(`Successfully unblocked`);
  } catch (error) {
    console.error("Error removing blocks:", error);
    throw error;
  }
}
