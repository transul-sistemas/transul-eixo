"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { UsuarioDaLista } from "@/lib/dados/usuarios-tipos";
import { esquemaMudarAcesso } from "@/lib/dominio/esquemas/cadastro";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { mudarAcessoAcao } from "./acoes";

// Mudar o acesso de um usuário que já existe: o perfil e a situação (ativo ou inativo). O login novo
// nasce fora do app. O mesmo esquema do servidor valida aqui; o servidor e o banco conferem de novo.

interface Valores {
  perfil: string;
  situacao: "ativo" | "inativo";
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "mudar-acesso",
  titulo: "Mudar acesso",
  versaoDoEsquema: 1,
  passos: [
    { id: "acesso", titulo: "Perfil e situação", campos: ["perfil", "situacao"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function AssistenteDeAcesso({
  usuario,
  perfis,
  aoFechar,
}: {
  usuario: UsuarioDaLista;
  perfis: readonly { codigo: string; nome: string }[];
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const quemUsa = useUsuarioDaSessao();
  const nomeDoPerfil = (codigo: string) => perfis.find((p) => p.codigo === codigo)?.nome ?? "";
  const entrada = (v: Valores) => ({
    pessoaId: usuario.pessoaId,
    perfil: v.perfil,
    ativo: v.situacao === "ativo",
    versao: usuario.versao,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaMudarAcesso.safeParse(entrada(valores));
    // Só perfil e situação são da tela; a pessoa e a versão vêm do usuário e o servidor as confere.
    const problemas = r.success
      ? []
      : r.error.issues
          .filter((i) => i.path[0] === "perfil" || i.path[0] === "ativo")
          .map((i) => ({
            path: i.path[0] === "ativo" ? ["situacao"] : i.path,
            message: i.message,
          }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ perfil: usuario.perfil, situacao: usuario.ativo ? "ativo" : "inativo" }}
      validarRascunho={() => null}
      usuario={quemUsa}
      registro={usuario.pessoaId}
      rascunho={false}
      rotuloConcluir="Mudar acesso"
      mensagemConcluido="Acesso mudado. A pessoa vê o novo perfil na próxima vez que abrir uma tela."
      aoConcluir={(valores, chaveDeEnvio) =>
        mudarAcessoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>
          Este usuário mudou desde que você o abriu. Feche o assistente e abra de novo para ver como
          está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Usuário",
          linhas: [
            { rotulo: "Nome", valor: usuario.nome },
            { rotulo: "Perfil atual", valor: usuario.perfilNome },
            { rotulo: "Perfil novo", valor: nomeDoPerfil(v.perfil) },
            { rotulo: "Situação nova", valor: v.situacao === "ativo" ? "Ativo" : "Inativo" },
          ],
        },
      ]}
      efeitos={(v) => [
        `${usuario.nome} passa a ver só o que o perfil ${nomeDoPerfil(v.perfil) || "escolhido"} permite.`,
        v.situacao === "inativo"
          ? "Inativo: a pessoa continua com o login, mas deixa de acessar o sistema."
          : "Ativo: a pessoa entra no sistema com o perfil escolhido.",
        "Cada mudança de acesso fica registrada na auditoria, com quem fez e quando.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Campo rotulo="Perfil" erro={form.formState.errors.perfil?.message}>
            {(p) => (
              <select {...p} {...form.register("perfil")} className={CLASSE_DO_CAMPO}>
                <option value="">Escolha…</option>
                {perfis.map((perfil) => (
                  <option key={perfil.codigo} value={perfil.codigo}>
                    {perfil.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Situação" erro={form.formState.errors.situacao?.message}>
            {(p) => (
              <select {...p} {...form.register("situacao")} className={CLASSE_DO_CAMPO}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            )}
          </Campo>
        </>
      )}
    />
  );
}
