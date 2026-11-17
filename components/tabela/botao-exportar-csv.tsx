import { IconDownload } from "@tabler/icons-react";

const CLASSE =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3 max-sm:w-9 max-sm:px-0";

/**
 * O botão padrão "Exportar CSV" das ações do título das listas. No celular é só o ícone (o texto fica
 * para o leitor de tela), do tamanho de um botão: cabe na linha do título e a barra não pula. O arquivo é gerado no servidor, com os
 * mesmos filtros da tela e a lista inteira (não só a página); o endereço vem de `enderecoDoCsv`.
 */
export function BotaoExportarCsv({ href }: { href: string }) {
  return (
    <a href={href} download data-exportar-csv="" className={CLASSE}>
      <IconDownload aria-hidden className="size-4" />
      <span className="max-sm:sr-only">Exportar CSV</span>
    </a>
  );
}
