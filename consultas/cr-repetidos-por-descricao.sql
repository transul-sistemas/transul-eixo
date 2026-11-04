-- (d) CRs de frota de ativo (AD_FROTA = S e VEICULO = S): quantas descrições têm 1, 2, 3... CRs.
-- A descrição só agrupa por dentro; a saída nunca a mostra.
WITH POR_DESCRICAO AS (
  SELECT C.DESCRCENCUS, COUNT(*) AS QTD_CRS
  FROM TSICUS C
  WHERE C.AD_FROTA = 'S' AND C.VEICULO = 'S'
  GROUP BY C.DESCRCENCUS
)
SELECT P.QTD_CRS, COUNT(*) AS DESCRICOES
FROM POR_DESCRICAO P
GROUP BY P.QTD_CRS
ORDER BY P.QTD_CRS
