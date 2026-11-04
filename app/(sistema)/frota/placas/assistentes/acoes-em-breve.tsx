import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { MENSAGEM_GRAVACAO_EM_BREVE } from "@/lib/dados/fonte";

/**
 * No modo banco (fatia 3.9a), as gravações entram na 3.9b: os botões aparecem desabilitados, com o
 * aviso, para a pessoa saber o que vem sem achar que a tela quebrou.
 */
export function AcoesEmBreve({
  comBotaoDeCadastrar = false,
  acoesDaFicha = [],
}: {
  comBotaoDeCadastrar?: boolean;
  acoesDaFicha?: readonly { id: string; nome: string }[];
}) {
  return (
    <div data-acoes-em-breve="" className="flex flex-wrap items-center gap-2">
      {comBotaoDeCadastrar ? (
        <Button disabled title={MENSAGEM_GRAVACAO_EM_BREVE}>
          <IconPlus aria-hidden />
          Cadastrar placa
        </Button>
      ) : null}
      {acoesDaFicha.map((acao) => (
        <Button key={acao.id} variant="outline" disabled title={MENSAGEM_GRAVACAO_EM_BREVE}>
          {acao.nome}
        </Button>
      ))}
      <span className="text-muted-foreground text-xs" title={MENSAGEM_GRAVACAO_EM_BREVE}>
        Em breve
      </span>
      <span className="sr-only">{MENSAGEM_GRAVACAO_EM_BREVE}</span>
    </div>
  );
}
