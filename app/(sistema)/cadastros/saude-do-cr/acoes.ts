"use server";

import { noBanco, prepararAcao } from "@/lib/dados/acao-no-banco";
import {
  atribuirDono,
  classificarCentroSemCr,
  encerrarVinculoDeCr,
  ligarCrAOperacao,
} from "@/lib/dados/saude-do-cr";
import {
  esquemaAtribuirDono,
  esquemaClassificarCentro,
  esquemaEncerrarVinculo,
  esquemaLigarCr,
  instanteEmSaoPaulo,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { exigirPermissao } from "@/lib/seguranca/exigir-permissao";

// Os resolvedores da Saúde do CR (assistentes 26 a 29; o 25, Escolher o CR, usa Trocar CR da Frota).
// Finas: permissão (exigirPermissao, cadastros.editar; o banco confere o dono de cada problema), o
// envelope, os dados pelo MESMO esquema da tela (safeParse) e a função atômica da n1-banco.

const EDITAR = { modulo: "cadastros", acao: "editar" } as const;
const TELAS = ["/cadastros/saude-do-cr", "/frota/placas", "/inicio/tarefas"];

export async function ligarCrAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaLigarCr.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { dia, ...resto } = p.dados;
  return noBanco(
    "ligar CR à operação",
    (c) => ligarCrAOperacao(c, { ...resto, em: instanteEmSaoPaulo(dia, "00:00") }, p.chave),
    TELAS,
  );
}

export async function encerrarVinculoAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaEncerrarVinculo.safeParse(d),
  );
  if (!p.ok) return p.erro;
  const { dia, ...resto } = p.dados;
  return noBanco(
    "encerrar vínculo de CR",
    (c) => encerrarVinculoDeCr(c, { ...resto, em: instanteEmSaoPaulo(dia, "00:00") }, p.chave),
    TELAS,
  );
}

export async function classificarCentroAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaClassificarCentro.safeParse(d),
  );
  if (!p.ok) return p.erro;
  return noBanco(
    "classificar centro sem CR",
    (c) => classificarCentroSemCr(c, p.dados, p.chave),
    TELAS,
  );
}

export async function atribuirDonoAcao(bruto: unknown) {
  const p = await prepararAcao(
    () => exigirPermissao(EDITAR),
    bruto,
    (d) => esquemaAtribuirDono.safeParse(d),
  );
  if (!p.ok) return p.erro;
  return noBanco("atribuir dono", (c) => atribuirDono(c, p.dados, p.chave), TELAS);
}
