import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDoSankhya, criarClienteSankhya, mascarar } from "./cliente.ts";

// O cliente da ponte S0 contra um servidor HTTP falso em 127.0.0.1: nada de rede real no CI.

type Pedido = {
  metodo: string;
  url: string;
  cabecalhos: IncomingMessage["headers"];
  corpo: string;
};
type Resposta = { status: number; corpo: unknown; atrasoMs?: number };

let servidor: Server;
let baseUrl: string;
let pedidos: Pedido[];
let respostas: ((p: Pedido) => Resposta)[];

const SEGREDO = "segredo-de-teste-que-nao-pode-vazar";
const X_TOKEN = "xtoken-de-teste-que-nao-pode-vazar";

const RESPOSTA_DA_CONSULTA = {
  status: "1",
  responseBody: {
    fieldsMetadata: [
      { name: "CODVEICULO", userType: "I" },
      { name: "NUMEIXOS", userType: "I" },
    ],
    rows: [
      [10, 3],
      [11, null],
    ],
  },
};

const autenticacao = (expiresIn = 300, token = "token-1"): Resposta => ({
  status: 200,
  corpo: { access_token: token, expires_in: expiresIn },
});

beforeEach(async () => {
  pedidos = [];
  respostas = [];
  servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    let corpo = "";
    req.on("data", (parte: Buffer) => (corpo += parte.toString("utf8")));
    req.on("end", () => {
      const pedido = {
        metodo: req.method ?? "",
        url: req.url ?? "",
        cabecalhos: req.headers,
        corpo,
      };
      pedidos.push(pedido);
      const proxima = respostas.shift();
      const r = proxima
        ? proxima(pedido)
        : { status: 500, corpo: { erro: "sem resposta preparada" } };
      setTimeout(() => {
        res.writeHead(r.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(r.corpo));
      }, r.atrasoMs ?? 0);
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  baseUrl = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(async () => {
  servidor.closeAllConnections();
  await new Promise<void>((ok) => servidor.close(() => ok()));
});

const cliente = (extra: { agora?: () => number; tempoMaximoMs?: number } = {}) =>
  criarClienteSankhya({
    baseUrl,
    clientId: "cliente-de-teste",
    clientSecret: SEGREDO,
    xToken: X_TOKEN,
    ...extra,
  });

describe("cliente do Sankhya", () => {
  it("autentica por client_credentials com X-Token e consulta pelo DbExplorerSP.executeQuery", async () => {
    respostas.push(
      () => autenticacao(),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA }),
    );
    const resultado = await cliente().consultar("SELECT V.CODVEICULO, V.NUMEIXOS FROM TGFVEI V");

    const [auth, consulta] = pedidos;
    expect(auth?.metodo).toBe("POST");
    expect(auth?.url).toBe("/authenticate");
    expect(auth?.cabecalhos["x-token"]).toBe(X_TOKEN);
    expect(auth?.cabecalhos["content-type"]).toContain("application/x-www-form-urlencoded");
    const form = new URLSearchParams(auth?.corpo);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("client_id")).toBe("cliente-de-teste");
    expect(form.get("client_secret")).toBe(SEGREDO);

    expect(consulta?.metodo).toBe("POST");
    expect(consulta?.url).toBe(
      "/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json",
    );
    expect(consulta?.cabecalhos.authorization).toBe("Bearer token-1");
    expect(JSON.parse(consulta?.corpo ?? "{}")).toEqual({
      serviceName: "DbExplorerSP.executeQuery",
      requestBody: { sql: "SELECT V.CODVEICULO, V.NUMEIXOS FROM TGFVEI V" },
    });

    expect(resultado).toEqual({
      colunas: [
        { nome: "CODVEICULO", tipo: "I" },
        { nome: "NUMEIXOS", tipo: "I" },
      ],
      linhas: [
        [10, 3],
        [11, null],
      ],
    });
  });

  it("reaproveita o token válido e renova quando falta menos de um minuto", async () => {
    let agora = 1_000_000;
    const c = cliente({ agora: () => agora });
    respostas.push(
      () => autenticacao(300, "token-1"),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA }),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA }),
      () => autenticacao(300, "token-2"),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA }),
    );
    await c.consultar("SELECT 1 AS X FROM DUAL");
    agora += 200_000;
    await c.consultar("SELECT 1 AS X FROM DUAL");
    agora += 50_000;
    await c.consultar("SELECT 1 AS X FROM DUAL");

    expect(pedidos.map((p) => p.url.split("?")[0])).toEqual([
      "/authenticate",
      "/gateway/v1/mge/service.sbr",
      "/gateway/v1/mge/service.sbr",
      "/authenticate",
      "/gateway/v1/mge/service.sbr",
    ]);
    expect(pedidos[4]?.cabecalhos.authorization).toBe("Bearer token-2");
  });

  it("com 401 na consulta, autentica de novo uma vez e repete", async () => {
    respostas.push(
      () => autenticacao(300, "token-1"),
      () => ({ status: 401, corpo: { erro: "expirado" } }),
      () => autenticacao(300, "token-2"),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA }),
    );
    const resultado = await cliente().consultar("SELECT 1 AS X FROM DUAL");
    expect(resultado.linhas).toHaveLength(2);
    expect(pedidos[3]?.cabecalhos.authorization).toBe("Bearer token-2");
  });

  it("401 de novo depois de renovar é erro, sem laço", async () => {
    respostas.push(
      () => autenticacao(),
      () => ({ status: 401, corpo: {} }),
      () => autenticacao(),
      () => ({ status: 401, corpo: {} }),
    );
    await expect(cliente().consultar("SELECT 1 AS X FROM DUAL")).rejects.toBeInstanceOf(
      ErroDoSankhya,
    );
    expect(pedidos).toHaveLength(4);
  });

  it("o erro do Sankhya (status 0) vira erro com a mensagem dele", async () => {
    respostas.push(
      () => autenticacao(),
      () => ({
        status: 200,
        corpo: { status: "0", statusMessage: "ORA-00942: tabela não existe" },
      }),
    );
    await expect(cliente().consultar("SELECT 1 AS X FROM DUAL")).rejects.toThrow(
      "ORA-00942: tabela não existe",
    );
  });

  it("falha de autenticação e erro HTTP nunca mostram o segredo, o X-Token nem o token", async () => {
    respostas.push(() => ({ status: 401, corpo: { erro: `recusado ${SEGREDO} ${X_TOKEN}` } }));
    const erro = (await cliente()
      .consultar("SELECT 1 AS X FROM DUAL")
      .catch((e: unknown) => e)) as ErroDoSankhya;
    expect(erro).toBeInstanceOf(ErroDoSankhya);
    expect(erro.message).toContain("Autenticação no Sankhya falhou (HTTP 401)");
    expect(erro.message).not.toContain(SEGREDO);
    expect(erro.message).not.toContain(X_TOKEN);

    respostas.push(
      () => autenticacao(300, "token-secreto-123"),
      () => ({ status: 500, corpo: { eco: "Bearer token-secreto-123" } }),
    );
    const erro2 = (await cliente()
      .consultar("SELECT 1 AS X FROM DUAL")
      .catch((e: unknown) => e)) as ErroDoSankhya;
    expect(erro2.message).toContain("HTTP 500");
    expect(erro2.message).not.toContain("token-secreto-123");
  });

  it("mascarar troca qualquer Bearer, mesmo de token desconhecido, e cada segredo conhecido", () => {
    expect(mascarar('{"eco":"Bearer abc.def-123"}', [])).toBe('{"eco":"Bearer ***"}');
    expect(mascarar(`chave ${SEGREDO} fim`, [SEGREDO])).toBe("chave *** fim");
  });

  it("estoura o tempo máximo e avisa", async () => {
    respostas.push(
      () => autenticacao(),
      () => ({ status: 200, corpo: RESPOSTA_DA_CONSULTA, atrasoMs: 1_000 }),
    );
    await expect(
      cliente({ tempoMaximoMs: 100 }).consultar("SELECT 1 AS X FROM DUAL"),
    ).rejects.toThrow("A consulta passou do tempo máximo (100 ms).");
  });

  it("resposta sem fieldsMetadata é erro (nunca tabela vazia calada)", async () => {
    respostas.push(
      () => autenticacao(),
      () => ({ status: 200, corpo: { status: "1", responseBody: {} } }),
    );
    await expect(cliente().consultar("SELECT 1 AS X FROM DUAL")).rejects.toThrow(
      "sem a lista de colunas",
    );
  });
});
