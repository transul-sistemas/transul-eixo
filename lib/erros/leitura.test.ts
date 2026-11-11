import { describe, expect, it, vi } from "vitest";
import {
  classificarFalha,
  detalheRegistrado,
  ErroDeLeitura,
  falhaDeLeitura,
  lerDigest,
  montarDigest,
} from "./leitura";

// Mensagens fictícias no formato real do PostgREST e do supabase-js.
describe("classificarFalha", () => {
  it("função ausente (PGRST202), com o nome da função", () => {
    expect(
      classificarFalha({
        code: "PGRST202",
        message: "Could not find the function nucleo.funcao_ficticia(p_mes) in the schema cache",
      }),
    ).toEqual({ causa: "funcao_ausente", funcao: "funcao_ficticia", codigo: "PGRST202" });
  });
  it("função ausente (42883, undefined_function)", () => {
    expect(
      classificarFalha({ code: "42883", message: "function nucleo.x() does not exist" }).causa,
    ).toBe("funcao_ausente");
  });
  it("consulta lenta (57014 e statement timeout)", () => {
    expect(
      classificarFalha({ code: "57014", message: "canceling statement due to statement timeout" }),
    ).toEqual({ causa: "lenta", codigo: "57014" });
    expect(classificarFalha({ message: "statement timeout" }).causa).toBe("lenta");
    expect(classificarFalha({ status: 504, message: "Gateway Timeout" }).causa).toBe("lenta");
  });
  it("sem permissão (42501, PGRST301, 401, 403)", () => {
    expect(
      classificarFalha({ code: "42501", message: "permission denied for function x" }).causa,
    ).toBe("sem_permissao");
    expect(classificarFalha({ code: "PGRST301", message: "JWT expired" }).causa).toBe(
      "sem_permissao",
    );
    expect(classificarFalha({ status: 401, message: "x" }).causa).toBe("sem_permissao");
    expect(classificarFalha({ status: 403, message: "x" }).causa).toBe("sem_permissao");
  });
  it("banco fora do ar (fetch failed, ECONNREFUSED, 503)", () => {
    expect(classificarFalha({ message: "TypeError: fetch failed" }).causa).toBe("banco_fora");
    expect(classificarFalha({ message: "connect ECONNREFUSED 127.0.0.1:54321" }).causa).toBe(
      "banco_fora",
    );
    expect(classificarFalha({ status: 503, message: "Service Unavailable" }).causa).toBe(
      "banco_fora",
    );
  });
  it("o resto é erro inesperado, e valor que não é erro também", () => {
    expect(classificarFalha({ code: "23505", message: "duplicate key" })).toEqual({
      causa: "inesperado",
      codigo: "23505",
    });
    expect(classificarFalha(undefined).causa).toBe("inesperado");
    expect(classificarFalha("texto solto").causa).toBe("inesperado");
  });
});

describe("digest do erro de leitura", () => {
  it("vai e volta com a causa e o id", () => {
    expect(lerDigest(montarDigest("lenta", "ab12cd34"))).toEqual({
      causa: "lenta",
      id: "ab12cd34",
    });
  });
  it("digest do Next (hash numérico), ausente ou de causa desconhecida: nulo", () => {
    expect(lerDigest("2093847561")).toBeNull();
    expect(lerDigest(undefined)).toBeNull();
    expect(lerDigest("eixo-leitura:outra:abcd")).toBeNull();
    expect(lerDigest("eixo-leitura:lenta")).toBeNull();
  });
});

describe("falhaDeLeitura", () => {
  it("devolve o erro com o digest e a mensagem de sempre, registra o detalhe e só loga função, causa e código", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const e = falhaDeLeitura("tarefas_do_usuario", {
      code: "PGRST202",
      message: "Could not find the function nucleo.tarefas_do_usuario in the schema cache",
    });
    expect(e).toBeInstanceOf(ErroDeLeitura);
    expect(e.message).toContain("tarefas_do_usuario: Could not find");
    const lido = lerDigest(e.digest);
    expect(lido?.causa).toBe("funcao_ausente");
    expect(detalheRegistrado(lido?.id ?? "")).toEqual({
      funcao: "tarefas_do_usuario",
      codigo: "PGRST202",
    });
    expect(log.mock.calls[0]?.[0]).toBe(
      "leitura falhou: função tarefas_do_usuario, causa funcao_ausente, código PGRST202",
    );
    log.mockRestore();
  });
});
