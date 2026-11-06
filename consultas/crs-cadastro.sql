-- (f) Cadastro dos CRs, uma linha por CR (fatia 3.9c, carga inicial): o que o CSV da auditoria não traz
-- (VEICULO, ANALITICO, CODCENCUSPAI, GRAU) e os sinais de sempre. Sem os responsáveis do CR (a guarda
-- recusa). Rodar com --linhas 5000: o resultado fica em importacao/resultados/ (fora do Git).
SELECT
  C.CODCENCUS,
  C.DESCRCENCUS,
  C.ATIVO,
  C.ANALITICO,
  C.VEICULO,
  C.CODCENCUSPAI,
  C.GRAU,
  C.AD_FROTA,
  C.AD_BLOQUEADO,
  C.AD_GARAGEM
FROM TSICUS C
ORDER BY C.CODCENCUS
