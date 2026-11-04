-- (b) Quantos veículos ativos estão sem eixos, sem tipo de carroceria (código e texto) e sem modelo.
-- Zero conta como vazio nos códigos (o Sankhya costuma gravar 0 quando falta a referência).
SELECT
  COUNT(*) AS ATIVOS,
  SUM(CASE WHEN V.NUMEIXOS IS NULL OR V.NUMEIXOS = 0 THEN 1 ELSE 0 END) AS SEM_NUMEIXOS,
  SUM(CASE WHEN V.CODTIPCAR IS NULL OR V.CODTIPCAR = 0 THEN 1 ELSE 0 END) AS SEM_CODTIPCAR,
  SUM(CASE WHEN V.TIPOCAR IS NULL THEN 1 ELSE 0 END) AS SEM_TIPOCAR,
  SUM(CASE WHEN V.CODMODELOVEI IS NULL OR V.CODMODELOVEI = 0 THEN 1 ELSE 0 END) AS SEM_MODELO
FROM TGFVEI V
WHERE V.ATIVO = 'S'
