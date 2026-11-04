import type { Sigla } from "@/lib/dominio/status";

// A ordem das siglas que distribui a situação das placas de exemplo e dos eventos delas. É a ordem da
// régua de 26 siglas, com o VAz (que saiu da régua em 03/11/2026) trocado por PÁT: assim só as placas
// que estavam em VAz mudam (para PÁT), e as demais mantêm a mesma situação e a mesma história.
export const SIGLAS_DO_EXEMPLO: readonly Sigla[] = [
  "ETc",
  "ETv",
  "CAr",
  "DEs",
  "DOp",
  "ACe",
  "ADe",
  "CAn",
  "MAc",
  "MAt",
  "MAv",
  "MAN",
  "REF",
  "SIN",
  "PÁT",
  "FOg",
  "FEr",
  "SMo",
  "SDo",
  "PÁT",
  "DOC",
  "ALU",
  "EMP",
  "VEN",
  "SUC",
  "VND",
];
