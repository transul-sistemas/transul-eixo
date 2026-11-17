// Os tipos de ultimo-evento.ts, sem código do servidor: a tela (cliente) importa só daqui.

export interface UltimoEvento {
  id: string;
  sigla: string | null;
  camada: string;
  em: string;
}
