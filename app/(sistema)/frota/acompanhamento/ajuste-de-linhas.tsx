"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { montarCookieDaAltura } from "@/lib/navegacao/preferencias-da-tabela";

// "Linhas: Auto": o servidor conta quantas linhas cabem pela altura da janela, que ele só conhece por este
// cookie. Na primeira abertura usa uma janela de 768 px; aqui a janela diz a dela de verdade e, se for
// diferente da que o servidor usou, grava o cookie e recarrega os dados (sem sair da tela). Ao redimensionar
// a janela, a conta é refeita (com uma pausa, para não recarregar a cada pixel).

const DIFERENCA_MINIMA = 8;
const PAUSA_EM_MS = 250;

export function AjusteDeLinhas({ alturaUsada }: { alturaUsada: number }) {
  const router = useRouter();
  useEffect(() => {
    let usada = alturaUsada;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const conferir = () => {
      const altura = Math.floor(window.innerHeight);
      if (Math.abs(altura - usada) < DIFERENCA_MINIMA) return;
      usada = altura;
      try {
        document.cookie = montarCookieDaAltura(altura, window.location.protocol);
      } catch {
        return; // Sem cookie, o servidor segue com a janela padrão.
      }
      router.refresh();
    };
    conferir();
    const aoRedimensionar = () => {
      clearTimeout(espera);
      espera = setTimeout(conferir, PAUSA_EM_MS);
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      clearTimeout(espera);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [alturaUsada, router]);
  return null;
}
