-- Ajuste do checkpoint 3.4b (Alexandre, 04/11/2026): a configuração "simples" (um único semirreboque,
-- sem dolly) aceita de 1 a 6 eixos, não só 2 ou 3. Bi continua só com semirreboques de 2 eixos,
-- bitrezão só com 3 e rodo só com semirreboques de 2 e dolly de 2; fora disso, "sem nome definido".
--
-- Onde a configuração já existe (base já semeada), a regra muda aqui; num banco novo vem pelo seed.
update config.configuracao_de_conjunto
   set eixos_dos_semirreboques = '{1,2,3,4,5,6}'
 where codigo = 'simples';
