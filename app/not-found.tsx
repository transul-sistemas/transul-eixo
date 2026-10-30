import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 px-4">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-muted-foreground text-sm">
        O endereço não existe ou foi digitado errado. Volte ao início e procure pelo menu ou pela
        busca (Ctrl+K).
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-[var(--acao)] underline-offset-4 hover:underline"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
