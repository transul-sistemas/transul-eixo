"use client";

import { useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { ProvedorDoUsuario, useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import {
  NOMES_DOS_TIPOS_DE_OPERACAO,
  type FichaDaOperacao,
  type TipoDeOperacao,
} from "@/lib/dados/operacoes-tipos";
import { esquemaEditarOperacao, TIPOS_DE_OPERACAO } from "@/lib/dominio/esquemas/operacao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { editarOperacaoAcao } from "./acoes";

// O assistente "Editar operação" (o principal da ficha): o nome, o tipo e a base (cidade e UF), que
// o Eixo possui. A filial é a garagem da base, calculada. Grava com a versão que a pessoa viu.

interface Valores {
  nome: string;
  tipo: TipoDeOperacao;
  baseCidade: string;
  baseUf: string;
}

const CAMPOS = ["nome", "tipo", "baseCidade", "baseUf"];

const DEFINICAO: DefinicaoDeAssistente = {
  id: "operacao-editar",
  titulo: "Editar operação",
  versaoDoEsquema: 1,
  passos: [
    { id: "dados", titulo: "Dados", campos: CAMPOS },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function AssistenteEditarOperacao({
  operacao,
  aoFechar,
  focoFinal,
}: {
  operacao: FichaDaOperacao["operacao"];
  aoFechar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: Valores) => ({ ...v, id: operacao.id, versao: operacao.versao });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaEditarOperacao.safeParse(entrada(valores));
    // Só os campos da tela entram no resolvedor; id e versão vêm da ficha e o servidor os confere.
    const problemas = r.success
      ? []
      : r.error.issues.filter((i) => CAMPOS.includes(String(i.path[0])));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const base = (cidade: string | null, uf: string | null) =>
    cidade || uf ? [cidade, uf].filter(Boolean).join("/") : "sem base";

  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        nome: operacao.nome,
        tipo: operacao.tipo,
        baseCidade: operacao.baseCidade ?? "",
        baseUf: operacao.baseUf ?? "",
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={operacao.id}
      focoFinal={focoFinal}
      rotuloConcluir="Editar operação"
      mensagemConcluido="Operação editada."
      aoConcluir={(valores, chaveDeEnvio) =>
        editarOperacaoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>
          Esta operação mudou desde que você abriu a ficha. Feche o assistente e abra de novo para
          ver como ela está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Operação",
          linhas: [
            { rotulo: "Nome atual", valor: operacao.nome },
            { rotulo: "Nome novo", valor: v.nome?.trim() },
            { rotulo: "Tipo", valor: v.tipo ? NOMES_DOS_TIPOS_DE_OPERACAO[v.tipo] : undefined },
            { rotulo: "Base atual", valor: base(operacao.baseCidade, operacao.baseUf) },
            {
              rotulo: "Base nova",
              valor: base(v.baseCidade?.trim() || null, v.baseUf?.trim().toUpperCase() || null),
            },
          ],
        },
      ]}
      efeitos={() => [
        "O novo nome vale em todo lugar onde a operação aparece; nada do histórico muda.",
        "A filial da operação acompanha a base (a garagem da mesma cidade e UF).",
      ]}
      renderPasso={(_, form) => (
        <GradeDeCampos>
          <Campo rotulo="Nome da operação" erro={form.formState.errors.nome?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("nome")}
                autoComplete="off"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
          <Campo rotulo="Tipo" erro={form.formState.errors.tipo?.message}>
            {(p) => (
              <select {...p} {...form.register("tipo")} className={CLASSE_DO_CAMPO}>
                {TIPOS_DE_OPERACAO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {NOMES_DOS_TIPOS_DE_OPERACAO[tipo]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Cidade da base" erro={form.formState.errors.baseCidade?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("baseCidade")}
                autoComplete="off"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
          <Campo
            rotulo="UF da base"
            erro={form.formState.errors.baseUf?.message}
            ajuda="A sigla com duas letras, como SP."
          >
            {(p) => (
              <input
                {...p}
                {...form.register("baseUf")}
                autoComplete="off"
                maxLength={2}
                className={`${CLASSE_DO_CAMPO} uppercase`}
              />
            )}
          </Campo>
        </GradeDeCampos>
      )}
    />
  );
}

/** O botão "Editar operação" da ficha e o assistente que ele abre (com o usuário da sessão acima). */
export function EditarOperacao({
  operacao,
  usuario,
}: {
  operacao: FichaDaOperacao["operacao"];
  /** Quem usa: a chave dos rascunhos. */
  usuario: string;
}) {
  // A operação como a pessoa a viu ao abrir: a gravação revalida a ficha (versão nova), mas o
  // assistente aberto não remonta nem troca de versão; volta ao primeiro passo só ao abrir de novo.
  const [aberta, setAberta] = useState<FichaDaOperacao["operacao"] | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <ProvedorDoUsuario usuario={usuario}>
      <Button ref={botao} onClick={() => setAberta(operacao)} aria-haspopup="dialog">
        Editar operação
      </Button>
      {aberta ? (
        <AssistenteEditarOperacao
          key={aberta.id}
          operacao={aberta}
          aoFechar={() => setAberta(null)}
          focoFinal={botao}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
