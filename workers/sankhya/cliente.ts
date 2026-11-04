// O cliente da ponte com o Sankhya (fatia S0, somente leitura). O contrato foi conferido no cliente da
// v1 (consultas_api/_sankhya_client.py, só leitura do código, nenhuma credencial copiada):
//  * POST {base}/authenticate, OAuth2 client_credentials no corpo (formulário) e o cabeçalho X-Token;
//    a resposta traz access_token e expires_in (segundos). O token é renovado um minuto antes de vencer.
//  * POST {base}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json,
//    com Bearer e {serviceName, requestBody: {sql}}. Um 401 renova o token uma vez e repete.
//  * A resposta traz responseBody.fieldsMetadata (name, userType) e responseBody.rows; status "0" com
//    statusMessage é erro do Sankhya.
// Nenhuma mensagem de erro carrega o segredo, o X-Token ou o token: tudo passa por mascarar().

export interface ConfiguracaoDoSankhya {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  xToken: string;
  /** Tempo máximo de cada chamada, em milissegundos (padrão: 120 s). */
  tempoMaximoMs?: number;
  /** Relógio em milissegundos (testes). */
  agora?: () => number;
}

export interface ColunaDoResultado {
  nome: string;
  tipo: string;
}

export interface ResultadoDaConsulta {
  colunas: ColunaDoResultado[];
  linhas: unknown[][];
}

export class ErroDoSankhya extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDoSankhya";
  }
}

const SERVICO = "DbExplorerSP.executeQuery";
const MARGEM_DO_TOKEN_MS = 60_000;
const TEMPO_MAXIMO_PADRAO_MS = 120_000;

/** Troca cada segredo conhecido (e qualquer Bearer) por ***. */
export function mascarar(texto: string, segredos: readonly string[]): string {
  let saida = texto.replace(/Bearer\s+[^\s"',}]+/gi, "Bearer ***");
  for (const segredo of segredos) {
    if (segredo.length >= 4) saida = saida.split(segredo).join("***");
  }
  return saida;
}

export function criarClienteSankhya(configuracao: ConfiguracaoDoSankhya) {
  const base = configuracao.baseUrl.replace(/\/+$/, "");
  const agora = configuracao.agora ?? Date.now;
  const tempoMaximoMs = configuracao.tempoMaximoMs ?? TEMPO_MAXIMO_PADRAO_MS;
  let token: { valor: string; venceEm: number } | null = null;

  const segredos = () => [
    configuracao.clientSecret,
    configuracao.xToken,
    configuracao.clientId,
    ...(token ? [token.valor] : []),
  ];
  const erro = (mensagem: string) => new ErroDoSankhya(mascarar(mensagem, segredos()));

  async function chamar(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(tempoMaximoMs) });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw erro(`A consulta passou do tempo máximo (${tempoMaximoMs} ms).`);
      }
      throw erro(`Não foi possível falar com o Sankhya: ${(e as Error).message}`);
    }
  }

  async function lerTexto(resposta: Response): Promise<string> {
    try {
      return (await resposta.text()).slice(0, 400);
    } catch {
      return "";
    }
  }

  async function autenticar(): Promise<string> {
    const resposta = await chamar(`${base}/authenticate`, {
      method: "POST",
      headers: {
        "X-Token": configuracao.xToken,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: configuracao.clientId,
        client_secret: configuracao.clientSecret,
      }).toString(),
    });
    if (resposta.status !== 200) {
      throw erro(
        `Autenticação no Sankhya falhou (HTTP ${resposta.status}): ${await lerTexto(resposta)}. ` +
          "Confira se a aplicação está ativa no Config Gateway e se o X-Token é da mesma aplicação do Client ID.",
      );
    }
    const corpo = (await resposta.json()) as {
      access_token?: string;
      expires_in?: number | string;
    };
    if (!corpo.access_token) throw erro("A autenticação do Sankhya não devolveu o token.");
    const expiraEmS = Number(corpo.expires_in ?? 300);
    token = { valor: corpo.access_token, venceEm: agora() + expiraEmS * 1000 };
    return token.valor;
  }

  async function tokenValido(): Promise<string> {
    if (token && agora() < token.venceEm - MARGEM_DO_TOKEN_MS) return token.valor;
    return autenticar();
  }

  async function consultar(sql: string): Promise<ResultadoDaConsulta> {
    const url = `${base}/gateway/v1/mge/service.sbr?serviceName=${SERVICO}&outputType=json`;
    const corpo = JSON.stringify({ serviceName: SERVICO, requestBody: { sql } });
    const enviar = async (valor: string) =>
      chamar(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${valor}`, "Content-Type": "application/json" },
        body: corpo,
      });

    let resposta = await enviar(await tokenValido());
    if (resposta.status === 401) resposta = await enviar(await autenticar());
    if (resposta.status === 401) throw erro("O Sankhya recusou o token renovado (HTTP 401).");
    if (resposta.status !== 200)
      throw erro(`O Sankhya respondeu HTTP ${resposta.status}: ${await lerTexto(resposta)}`);

    const dados = (await resposta.json()) as {
      status?: string;
      statusMessage?: string;
      responseBody?: {
        fieldsMetadata?: { name?: string; userType?: string; type?: string }[];
        rows?: unknown[][];
      };
    };
    if (dados.status === "0")
      throw erro(`Erro do Sankhya: ${dados.statusMessage ?? "sem mensagem"}`);
    const metadados = dados.responseBody?.fieldsMetadata;
    if (!metadados || metadados.length === 0)
      throw erro("A resposta do Sankhya veio sem a lista de colunas (fieldsMetadata).");
    return {
      colunas: metadados.map((c, i) => ({
        nome: c.name ?? `COL${i}`,
        tipo: c.userType ?? c.type ?? "S",
      })),
      linhas: dados.responseBody?.rows ?? [],
    };
  }

  return { consultar };
}
