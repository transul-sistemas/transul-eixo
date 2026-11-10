"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { ProvedorDoUsuario, useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { OperacaoParaEscolher } from "@/lib/dados/pessoas-tipos";
import { mascararCpfDigitado } from "@/lib/dominio/documento";
import { esquemaCadastrarPessoa } from "@/lib/dominio/esquemas/pessoa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cadastrarPessoaAcao } from "./acoes";
import { CamposDoVinculo, resolvedorPor, textoDoVinculo } from "./campos-da-pessoa";

// O assistente "Cadastrar pessoa": nome, CPF (validado na tela e no banco, sem duplicata) e e-mail; o
// vínculo com a operação (função e desde quando) é opcional. O CPF nunca vai para o rascunho.

interface Valores {
  nome: string;
  cpf: string;
  email: string;
  operacaoId: string;
  funcao: string;
  inicio: string;
}

const CAMPOS = ["nome", "cpf", "email", "operacaoId", "funcao", "inicio"];

const DEFINICAO: DefinicaoDeAssistente = {
  id: "pessoa-cadastrar",
  titulo: "Cadastrar pessoa",
  versaoDoEsquema: 1,
  passos: [
    { id: "pessoa", titulo: "Pessoa", campos: ["nome", "cpf", "email"] },
    { id: "vinculo", titulo: "Vínculo", campos: ["operacaoId", "funcao", "inicio"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const RASCUNHO = z
  .object({
    nome: z.string(),
    email: z.string(),
    operacaoId: z.string(),
    funcao: z.string(),
    inicio: z.string(),
  })
  .partial();

const VAZIO: Valores = { nome: "", cpf: "", email: "", operacaoId: "", funcao: "", inicio: "" };

function AssistenteCadastrarPessoa({
  operacoes,
  aoFechar,
  focoFinal,
}: {
  operacoes: readonly OperacaoParaEscolher[];
  aoFechar: () => void;
  focoFinal: React.RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolvedorPor<Valores>(esquemaCadastrarPessoa, CAMPOS)}
      valoresIniciais={VAZIO}
      validarRascunho={(v) => {
        const r = RASCUNHO.safeParse(v);
        return r.success ? r.data : null;
      }}
      usuario={usuario}
      camposSensiveis={["cpf"]}
      focoFinal={focoFinal}
      rotuloConcluir="Cadastrar pessoa"
      mensagemConcluido="Pessoa cadastrada."
      aoConcluir={(valores, chaveDeEnvio) => cadastrarPessoaAcao({ chaveDeEnvio, dados: valores })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Pessoa",
          linhas: [
            { rotulo: "Nome", valor: v.nome?.trim() },
            { rotulo: "CPF", valor: v.cpf },
            { rotulo: "E-mail", valor: v.email?.trim() || "sem e-mail" },
          ],
        },
        {
          titulo: "Vínculo",
          linhas: [{ rotulo: "Operação", valor: textoDoVinculo(v, operacoes) }],
        },
      ]}
      efeitos={(v) => [
        "A pessoa passa a existir uma vez só no Eixo, pelo CPF; a lista mostra o CPF mascarado.",
        v.operacaoId
          ? "O vínculo com a operação começa na data informada e põe a pessoa na escala da operação."
          : "Sem vínculo, a pessoa não aparece em nenhuma escala até ganhar um pelo Editar pessoa.",
      ]}
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
            <Campo
              rotulo="CPF"
              erro={form.formState.errors.cpf?.message}
              ajuda="Os 11 dígitos; os pontos e o traço entram sozinhos."
            >
              {(p) => {
                const registro = form.register("cpf");
                return (
                  <input
                    {...p}
                    {...registro}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(evento) => {
                      evento.target.value = mascararCpfDigitado(evento.target.value);
                      void registro.onChange(evento);
                    }}
                    className={`${CLASSE_DO_CAMPO} tabular-nums`}
                  />
                );
              }}
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
              rotuloDaData="Na operação desde"
              ajudaDaData="O primeiro dia do vínculo."
            />
          </GradeDeCampos>
        )
      }
    />
  );
}

/** O botão "Cadastrar pessoa" da lista e o assistente que ele abre (com o usuário da sessão acima). */
export function CadastrarPessoa({
  operacoes,
  usuario,
}: {
  operacoes: readonly OperacaoParaEscolher[];
  /** Quem usa: a chave dos rascunhos. */
  usuario: string;
}) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <ProvedorDoUsuario usuario={usuario}>
      <Button ref={botao} onClick={() => setAberto(true)} aria-haspopup="dialog">
        Cadastrar pessoa
      </Button>
      {aberto ? (
        <AssistenteCadastrarPessoa
          operacoes={operacoes}
          aoFechar={() => setAberto(false)}
          focoFinal={botao}
        />
      ) : null}
    </ProvedorDoUsuario>
  );
}
