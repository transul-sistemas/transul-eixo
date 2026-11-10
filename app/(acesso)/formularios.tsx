"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { Button } from "@/components/ui/button";
import { definirNovaSenha, entrar, type EstadoDoFormulario, pedirRecuperacao } from "./acoes";
import { TAMANHO_MINIMO_DA_SENHA } from "./esquemas";

// Os formulários das telas de acesso (fatia 3.8). Enviar desliga o botão até a resposta (clique duplo
// não manda duas vezes); o erro aparece num aviso lido pelo leitor de tela.

const MOTIVOS: Record<string, string> = {
  inatividade: "Sua sessão terminou depois de 8 horas sem uso. Entre de novo para continuar.",
  "link-invalido": 'O link expirou ou já foi usado. Peça um novo em "Esqueci a senha".',
};

function Aviso({ estado }: { estado: EstadoDoFormulario }) {
  if (estado.erro) {
    return (
      <p
        role="alert"
        className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
      >
        {estado.erro}
      </p>
    );
  }
  if (estado.aviso) {
    return (
      <p role="status" className="border-border bg-muted rounded-lg border px-3 py-2 text-sm">
        {estado.aviso}
      </p>
    );
  }
  return null;
}

const CLASSE_DO_LINK = "text-sm font-medium text-[var(--acao)] underline-offset-4 hover:underline";

export function FormularioDeEntrada() {
  const busca = useSearchParams();
  const motivo = MOTIVOS[busca.get("motivo") ?? ""];
  const [estado, enviar, enviando] = useActionState(entrar, {});
  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold">Entrar</h1>
      {motivo && !estado.erro ? <Aviso estado={{ aviso: motivo }} /> : null}
      <Aviso estado={estado} />
      <input type="hidden" name="proximo" value={busca.get("proximo") ?? ""} />
      <Campo rotulo="E-mail">
        {(p) => (
          <input
            {...p}
            name="email"
            type="email"
            autoComplete="username"
            required
            className={CLASSE_DO_CAMPO}
          />
        )}
      </Campo>
      <Campo rotulo="Senha">
        {(p) => (
          <input
            {...p}
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className={CLASSE_DO_CAMPO}
          />
        )}
      </Campo>
      <Button type="submit" disabled={enviando} className="h-10">
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
      <Link href="/esqueci-a-senha" className={CLASSE_DO_LINK}>
        Esqueci a senha
      </Link>
    </form>
  );
}

export function FormularioDeRecuperacao() {
  const [estado, enviar, enviando] = useActionState(pedirRecuperacao, {});
  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold">Esqueci a senha</h1>
      <p className="text-muted-foreground text-sm">
        Informe o seu e-mail. Mandamos um link para você criar uma senha nova.
      </p>
      <Aviso estado={estado} />
      <Campo rotulo="E-mail">
        {(p) => (
          <input
            {...p}
            name="email"
            type="email"
            autoComplete="username"
            required
            className={CLASSE_DO_CAMPO}
          />
        )}
      </Campo>
      <Button type="submit" disabled={enviando} className="h-10">
        {enviando ? "Enviando…" : "Enviar o link"}
      </Button>
      <Link href="/entrar" className={CLASSE_DO_LINK}>
        Voltar para entrar
      </Link>
    </form>
  );
}

export function FormularioDeNovaSenha() {
  const [estado, enviar, enviando] = useActionState(definirNovaSenha, {});
  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-semibold">Criar a senha nova</h1>
      <Aviso estado={estado} />
      <Campo rotulo="Senha nova" ajuda={`No mínimo ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}>
        {(p) => (
          <input
            {...p}
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={TAMANHO_MINIMO_DA_SENHA}
            required
            className={CLASSE_DO_CAMPO}
          />
        )}
      </Campo>
      <Campo rotulo="Confirme a senha nova">
        {(p) => (
          <input
            {...p}
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            required
            className={CLASSE_DO_CAMPO}
          />
        )}
      </Campo>
      {estado.pedirCodigo ? (
        <Campo rotulo="Código do e-mail" ajuda="Os 6 dígitos que mandamos ao seu e-mail.">
          {(p) => (
            <input
              {...p}
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className={CLASSE_DO_CAMPO}
            />
          )}
        </Campo>
      ) : null}
      <Button type="submit" disabled={enviando} className="h-10">
        {enviando ? "Salvando…" : "Salvar a senha nova"}
      </Button>
    </form>
  );
}
