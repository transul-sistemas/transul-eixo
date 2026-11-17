"use client";

import { IconAlertCircle, IconMapPin, IconMapPinOff } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { Button } from "@/components/ui/button";
import { mudancasDeCidade, type PontoDaRota, trechosDaRota } from "@/lib/dominio/rota-do-mes";

// A4 · Rota do mês (aba da barra lateral do Acompanhamento). Lê a série de posições do mês da placa
// (Posição do dia, nível de cidade) pela rota /frota/acompanhamento/rota e mostra os trechos na ordem
// dos dias. Primeira versão sem o mapa pela rodovia do protótipo 5 (fica para a passada visual): a lista
// de trechos diz o mesmo sem inventar traçado. Trata carregando, vazio, erro e tentar de novo, e
// cancela a leitura anterior quando a placa ou o mês mudam.

type Resposta =
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; origem: "banco" | "exemplo"; pontos: PontoDaRota[] };

/** A resposta guarda a chave do pedido: se a placa, o mês ou a tentativa mudaram, ainda está carregando. */
type Estado = (Resposta & { chave: string }) | { fase: "carregando" };

export function AbaRotaDoMes({ ativoId, de, ate }: { ativoId: string; de: string; ate: string }) {
  const [resposta, setResposta] = useState<Estado>({ fase: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);
  const chave = `${ativoId}|${de}|${ate}|${tentativa}`;
  const estado: Estado =
    resposta.fase !== "carregando" && resposta.chave === chave ? resposta : { fase: "carregando" };

  useEffect(() => {
    const controle = new AbortController();
    const parametros = new URLSearchParams({ ativo: ativoId, de, ate });
    fetch(`/frota/acompanhamento/rota?${parametros.toString()}`, { signal: controle.signal })
      .then(async (resposta) => {
        const corpo = (await resposta.json()) as
          { origem: "banco" | "exemplo"; pontos: PontoDaRota[] } | { erro: string };
        if (!resposta.ok || "erro" in corpo) {
          setResposta({
            chave,
            fase: "erro",
            mensagem: "erro" in corpo ? corpo.erro : "Não foi possível ler a rota agora.",
          });
          return;
        }
        setResposta({ chave, fase: "pronto", origem: corpo.origem, pontos: corpo.pontos });
      })
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        setResposta({
          chave,
          fase: "erro",
          mensagem:
            erro instanceof Error
              ? "Sem conexão com o servidor."
              : "Não foi possível ler a rota agora.",
        });
      });
    return () => controle.abort();
  }, [ativoId, de, ate, chave]);

  if (estado.fase === "carregando") {
    return (
      <div role="status" aria-label="Carregando a rota do mês" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="bg-muted h-8 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm">
        <p className="flex items-center gap-2">
          <IconAlertCircle aria-hidden className="text-destructive size-4" />
          {estado.mensagem}
        </p>
        <Button variant="outline" size="sm" onClick={tentarDeNovo}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const trechos = trechosDaRota(estado.pontos);
  if (trechos.length === 0) {
    return (
      <div role="status" className="text-muted-foreground flex flex-col gap-1 text-sm">
        <p className="text-foreground font-medium">Nenhuma posição registrada neste mês.</p>
        <p>
          A rota sai da Posição do dia respondida pelo gestor. Responda a posição em Início › Meu
          dia para a rota aparecer aqui.
        </p>
      </div>
    );
  }

  const mudancas = mudancasDeCidade(estado.pontos);
  const diasComPosicao = estado.pontos.length;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {estado.origem === "exemplo" ? (
        <p className="bg-status-atencao-suave w-fit rounded-full px-2 py-0.5 text-xs font-medium">
          Dados de exemplo
        </p>
      ) : null}
      <p className="text-muted-foreground">
        {formatarInteiro(diasComPosicao)}{" "}
        {diasComPosicao === 1 ? "dia com posição" : "dias com posição"} ·{" "}
        {formatarInteiro(mudancas)} {mudancas === 1 ? "mudança de cidade" : "mudanças de cidade"}
      </p>
      <ol aria-label="Trechos da rota do mês" className="border-border flex flex-col border-l pl-3">
        {trechos.map((t) => (
          <li key={t.de} className="relative py-1.5">
            <span className="flex items-center gap-2">
              {t.semSinal ? (
                <IconMapPinOff aria-hidden className="text-muted-foreground size-4" />
              ) : (
                <IconMapPin aria-hidden className="size-4" />
              )}
              <span className={t.semSinal ? "text-muted-foreground" : "font-medium"}>
                {t.semSinal
                  ? "Sem sinal"
                  : `${t.cidade ?? "Cidade não informada"}${t.uf ? ` · ${t.uf}` : ""}`}
              </span>
            </span>
            <span className="text-muted-foreground ml-6 block text-xs">
              {t.de === t.ate
                ? formatarData(t.de)
                : `${formatarData(t.de)} a ${formatarData(t.ate)}`}{" "}
              · {formatarInteiro(t.dias)} {t.dias === 1 ? "dia" : "dias"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
