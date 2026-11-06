-- (e) Cadastro dos veículos ativos, uma linha por veículo (fatia 3.9c, carga inicial): a chave
-- (PLACA e RENAVAM), tipo, marca, modelo, anos, eixos, carroceria, o CR e as carretas engatadas.
-- Sem proprietário nem motorista (a guarda recusa). Rodar com --linhas 5000: o resultado fica em
-- importacao/resultados/ (fora do Git) e a tela mostra só o resumo.
SELECT
  V.CODVEICULO,
  V.PLACA,
  V.RENAVAM,
  V.CODTIPVEI,
  V.CAVALO,
  V.CODMARCAVEI,
  MA.DESCRICAO AS MARCA,
  V.CODMODELOVEI,
  MO.DESCRICAO AS MODELO,
  V.ANOFABRIC,
  V.ANOMOD,
  V.NUMEIXOS,
  V.CODTIPCAR,
  V.TIPOCAR,
  V.CODCENCUS,
  V.CODVEI1,
  V.CODVEI2,
  V.CODVEI3,
  V.AD_FROTA
FROM TGFVEI V
LEFT JOIN TMSMARCAVEI MA ON MA.CODMARCAVEI = V.CODMARCAVEI
LEFT JOIN TMSMODELOVEI MO ON MO.CODMODELOVEI = V.CODMODELOVEI
WHERE V.ATIVO = 'S'
ORDER BY V.CODVEICULO
