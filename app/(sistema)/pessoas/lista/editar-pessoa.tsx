"use client";

import { useRef, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { ProvedorDoUsuario, useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { FichaDaPessoa } from "@/lib/dados/pessoas-tipos";
import { esquemaEditarPessoa } from "@/lib/dominio/esquemas/pessoa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { editarPessoaAcao } from "./acoes";
import { CamposDoVinculo, resolvedorPor, textoDoVinculo } from "./campos-da-pessoa";

// O assistente "Editar pessoa" (o principal da ficha): nome e e-mail, e o vínculo. Trocar a operação
// ou a função (ou tirar a operação) fecha o vínculo atual na data informada e abre o novo no mesmo
// dia, sem sobreposição. Grava com a versão que a pessoa viu. O CPF não muda.

interface Valores {
  nome: string;
  email: string;
  operacaoId: string;
  funcao: string;
  inicio: string;
}

const CAMPOS = ["nome", "email", "operacaoId", "funcao", "inicio"];

const DEFINICAO: DefinicaoDeAssistente = {
  id: "pessoa-editar",
  titulo: "Editar pessoa",
  versaoDoEsquema: 1,
  passos: [
    { id: "pessoa", titulo: "Pessoa", campos: ["nome", "email"] },
    { id: "vinculo", titulo: "Vínculo", campos: ["operacaoId", "funcao", "inicio"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function AssistenteEditarPessoa({
  ficha,
  aoFechar,
  focoFinal,
}: {
  ficha: FichaDaPessoa;
  aoFechar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const { pessoa, vinculoAtual, operacoes } = ficha;
  const entrada = (v: Valores) => ({ ...v, id: pessoa.id, versao: pessoa.versao });
  const vinculoMuda = (v: Valores) =>
    (v.operacaoId ?? "") !== (vinculoAtual?.operacaoId ?? "") ||
    (v.operacaoId !== "" && (v.funcao ?? "") !== (vinculoAtual?.funcao ?? ""));
  const atual = vinculoAtual
    ? `${vinculoAtual.funcaoNome} em ${vinculoAtual.operacao}, desde ${formatarData(vinculoAtual.inicio)}`
    : "Sem vínculo com operação";

  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolvedorPor<Valores>(esquemaEditarPessoa, CAMPOS, entrada)}
      valoresIniciais={{
        nome: pessoa.nome,
        email: pessoa.email ?? "",
        operacaoId: vinculoAtual?.operacaoId ?? "",
        funcao: vinculoAtual?.funcao ?? "",
        inicio: "",
      }}
      validarRascunho={() => null}
      rascunho={false}
      usuario={usuario}
      registro={pessoa.id}
      focoFinal={focoFinal}
      rotuloConcluir="Editar pessoa"
      mensagemConcluido="Pessoa editada."
      aoConcluir={(valores, chaveDeEnvio) =>
        editarPessoaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>
          Esta pessoa mudou desde que você abriu a ficha. Feche o assistente e abra de novo para ver
          como ela está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Pessoa",
          linhas: [
            { rotulo: "Nome atual", valor: pessoa.nome },
            { rotulo: "Nome novo", valor: v.nome?.trim() },
            { rotulo: "E-mail", valor: v.email?.trim() || "sem e-mail" },
          ],
        },
        {
          titulo: "Vínculo",
          linhas: [
            { rotulo: "Atual", valor: atual },
            {
              rotulo: "Novo",
              valor: vinculoMuda(v) ? textoDoVinculo(v, operacoes) : "Sem mudança",
            },
          ],
        },
      ]}
      efeitos={(v) =>
        vinculoMuda(v)
          ? [
              vinculoAtual
                ? `O vínculo atual termina em ${v.inicio ? formatarData(v.inicio) : "data a informar"}.`
                : "A pessoa ganha o primeiro vínculo.",
              v.operacaoId
                ? "O novo vínculo começa no mesmo dia, e a escala passa a usar a nova operação e função."
                : "Sem operação, a pessoa sai da escala a partir dessa data.",
            ]
          : ["Só o nome e o e-mail mudam; o vínculo e a escala ficam como estão."]
      }
      renderPasso={(passo, form) =>
        passo.id === "pessoa" ? (
          <GradeDeCampos>
            <Campo rotulo="Nome completo" erro={form.formState.errors.nome?.message}>
              {(p) => (
                <input
                  {...p}
                  {...form.register("nome")}
                  autoComplete="off"
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
            <Campo rotulo="E-mail (opcional)" erro={form.formState.errors.email?.message}>
              {(p) => (
                <input
                  {...p}
                  {...form.register("email")}
                  type="email"
                  autoComplete="off"
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
          </GradeDeCampos>
        ) : (
          <GradeDeCampos>
            <CamposDoVinculo
              form={form}
              operacoes={operacoes}
              rotuloDaData="A mudança vale a partir de"
              ajudaDaData="Só conta se a operação ou a função mudarem: o vínculo atual termina nesse dia."
            />
          </GradeDeCampos>
        )
      }
    />
  );
}

/** O botão "Editar pessoa" da ficha e o assistente que ele abre (com o usuário da sessão acima). */
export function EditarPessoa({ ficha, usuario }: { ficha: FichaDaPessoa; usuario: string }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <ProvedorDoUsuario usuario={usuario}>
      <Button ref={botao} onClick={() => setAberto(true)} aria-haspopup="dialog">
        Editar pessoa
      </Button>
      {aberto ? (
        <AssistenteEditarPessoa
          key={`${ficha.pessoa.id}-${ficha.pessoa.versao}`}
          ficha={ficha}
          aoFechar={() => setAberto(false)}
          focoFinal={botao}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
