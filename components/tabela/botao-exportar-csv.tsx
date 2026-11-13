import { IconDownload } from "@tabler/icons-react";

const CLASSE =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

/**
 * O botão padrão "Exportar CSV" da barra de consulta das listas. O arquivo é gerado no servidor, com os
 * mesmos filtros da tela e a lista inteira (não só a página); o endereço vem de `enderecoDoCsv`.
 */
export function BotaoExportarCsv({ href }: { href: string }) {
  return (
    <a href={href} download data-exportar-csv="" className={CLASSE}>
      <IconDownload aria-hidden className="size-4" />
      Exportar CSV
    </a>
  );
}
