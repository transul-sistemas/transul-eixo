import type { ReactNode } from "react";
import { Logotipo } from "@/components/marca/logotipo";

// As telas de acesso (entrar, esqueci a senha, nova senha, acesso não liberado): fora da casca do
// sistema, um cartão centralizado com o logotipo.
export default function LayoutDeAcesso({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logotipo />
        <section className="border-border bg-card flex flex-col gap-5 rounded-xl border p-6 shadow-sm">
          {children}
        </section>
      </div>
    </main>
  );
}
