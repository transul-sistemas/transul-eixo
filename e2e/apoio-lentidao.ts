import type { Page } from "@playwright/test";

/**
 * Deixa o navegador mais lento, como uma máquina fraca ou o runner do CI: CPU `taxa` vezes mais
 * lenta (e, se pedido, a rede). Só o Chromium tem isso (CDP); os projetos de tela usam Chrome.
 */
export async function deixarLento(
  page: Page,
  { cpu, redeMs = 0 }: { cpu: number; redeMs?: number },
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  if (redeMs > 0) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: redeMs,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }
}
