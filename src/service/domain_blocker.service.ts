import { DomainBlocker } from "../domain_blocker.ts";

export async function domain_blocker(): Promise<void> {
  const blocker = new DomainBlocker();

  try {
    await blocker.initialize();

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

    // Check status
    console.log("Blocked domains:", blocker.getBlockedDomains());
    console.log(
      "Is facebook.com blocked?",
      blocker.isDomainBlocked("facebook.com"),
    );

    // Unblock domain
    // await blocker.unblockDomain('facebook.com');
  } catch (error) {
    console.error("Error:", error);
  }
}

export async function remove_blocks(): Promise<void> {
  const blocker = new DomainBlocker();

  try {
    await blocker.initialize();

    // Unblock multiple domains
    await blocker.clearAllBlocks();
    console.log(`Successfully unblocked`);
  } catch (error) {
    console.error("Error removing blocks:", error);
    throw error;
  }
}
