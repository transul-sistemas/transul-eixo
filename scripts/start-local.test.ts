import { describe, expect, it } from "vitest";

import { comRaizDoTurbopack, contarMarcasDaNuvem, lerSupabaseLocal } from "./start-local.ts";

describe("start:local", () => {
  it("conta marcas da nuvem sem devolver o trecho", () => {
    const texto = 'a="https://abcdefghijklmnopqrst.supabase.co" b="sb_secret_xyz" c=service_role';
    const achados = contarMarcasDaNuvem(texto);
    expect(Object.values(achados).reduce((s, n) => s + n, 0)).toBe(3);
    expect(JSON.stringify(achados)).not.toContain("abcdefghijklmnopqrst");
  });

  it("build só com endereço local não tem marca da nuvem", () => {
    expect(contarMarcasDaNuvem('url="http://127.0.0.1:54321" chave="sb_publishable_x"')).toEqual(
      {},
    );
  });

  it("lê só o endereço e a chave publicável e recusa endereço que não é local", () => {
    const local =
      'API_URL="http://127.0.0.1:54321"\nPUBLISHABLE_KEY="sb_publishable_x"\nSECRET_KEY="s"';
    expect(lerSupabaseLocal(local)).toEqual({
      url: "http://127.0.0.1:54321",
      chave: "sb_publishable_x",
    });
    expect(() => lerSupabaseLocal('API_URL="https://x.supabase.co"\nPUBLISHABLE_KEY="k"')).toThrow(
      /não é local/,
    );
    expect(() => lerSupabaseLocal("")).toThrow(/ligado/);
  });

  it("põe a raiz do turbopack uma vez só", () => {
    const cfg = "const c = {\n  turbopack: {\n    rules: {},\n  },\n};";
    const novo = comRaizDoTurbopack(cfg, "C:\\proj");
    expect(novo).toContain('root: "C:/proj"');
    expect(comRaizDoTurbopack(novo, "C:\\proj")).toBe(novo);
    expect(() => comRaizDoTurbopack("const c = {};", "C:\\proj")).toThrow();
  });
});
