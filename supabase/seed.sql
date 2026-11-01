-- Seed de produção: só catálogos iniciais (a régua de siglas, as carrocerias e os nomes de conjunto
-- agora; perfis e permissões nas fatias seguintes da Fase 3).
--
-- Dado de exemplo NUNCA entra aqui: fica em supabase/exemplo/ e só é carregado no ambiente local
-- e no CI de teste. Também não há marca, modelo, filial nem garagem: entram pelo "+" e, mais tarde,
-- pela ponte com o Sankhya.
--
-- O espelho em TypeScript da régua é lib/dominio/status.ts; lib/qualidade/catalogo-de-status.test.ts
-- confere os dois e o docs/glossario.md.

-- As cinco camadas, da que vence (1) à que perde (5).
insert into config.camada_de_status (codigo, nome, prioridade) values
  ('baixada', 'Baixada', 1),
  ('fora-da-frota', 'Fora da frota', 2),
  ('impedida', 'Impedida', 3),
  ('sem-motorista', 'Sem motorista', 4),
  ('atividade', 'Atividade', 5);

-- As 26 siglas, na ordem da régua do CLAUDE.md. Camada, aplica_a e tipos válidos: Apêndice A do
-- plano da Fase 3 (aprovado em 31/10/2026). VAz é rascunho até a equipe confirmar (só cavalo e caminhão).
insert into config.status (sigla, nome, chip, camada, baixada, aplica_a, tipos_validos, ordem) values
  ('ETc', 'Em trânsito carregado', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 1),
  ('ETv', 'Em trânsito vazio', 'em-atividade', 'atividade', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 2),
  ('CAr', 'Carregando', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 3),
  ('DEs', 'Descarregando', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 4),
  ('DOp', 'Disponível no Operacional', 'em-atividade', 'atividade', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 5),
  ('ACe', 'Aguardando carregamento', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 6),
  ('ADe', 'Aguardando descarga', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 7),
  ('CAn', 'Carregado aguardando nota', 'em-atividade', 'atividade', false, 'conjunto', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 8),
  ('MAc', 'Manutenção / carregado', 'impedida', 'impedida', false, 'conjunto', array['cavalo', 'implemento']::nucleo.tipo_de_ativo[], 9),
  ('MAt', 'Manutenção / tombado', 'impedida', 'impedida', false, 'conjunto', array['cavalo', 'implemento']::nucleo.tipo_de_ativo[], 10),
  ('MAv', 'Manutenção / vazio', 'impedida', 'impedida', false, 'conjunto', array['cavalo', 'implemento']::nucleo.tipo_de_ativo[], 11),
  ('MAN', 'Em manutenção', 'impedida', 'impedida', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 12),
  ('REF', 'Em reforma', 'impedida', 'impedida', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 13),
  ('SIN', 'Sinistro', 'impedida', 'impedida', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 14),
  ('VAz', 'Vazio', 'atencao', 'atividade', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 15),
  ('FOg', 'Folga', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 16),
  ('FEr', 'Férias', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 17),
  ('SMo', 'Sem motorista', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 18),
  ('SDo', 'Sem documento', 'impedida', 'impedida', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 19),
  ('PÁT', 'Pátio', 'patio', 'atividade', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 20),
  ('DOC', 'Problema documental', 'impedida', 'impedida', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 21),
  ('ALU', 'Alugado a terceiro', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 22),
  ('EMP', 'Emprestado', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 23),
  ('VEN', 'Disponível para venda', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 24),
  ('SUC', 'Sucata', 'fora', 'baixada', true, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 25),
  ('VND', 'Vendido', 'fora', 'baixada', true, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 26);

-- As seis carrocerias de partida. O catálogo é do Eixo e cresce com a confirmação da equipe.
insert into config.carroceria (nome) values
  ('Graneleira'),
  ('Sider'),
  ('Basculante'),
  ('Baú frigorífico'),
  ('Prancha'),
  ('Tanque');

-- As quatro configurações de conjunto. A regra que reconhece cada uma é da equipe e entra na 3.4.
insert into config.configuracao_de_conjunto (codigo, nome) values
  ('simples', 'Simples'),
  ('bi', 'Bi'),
  ('bitrezao', 'Bitrezão'),
  ('rodo', 'Rodo');

-- Os 12 nomes de conjunto (Graneleira, Sider e Basculante). Baú frigorífico, Prancha e Tanque não
-- têm nome de conjunto.
insert into config.nomenclatura_de_conjunto (carroceria_id, configuracao, nome)
select c.id, n.configuracao, n.nome
  from (values
    ('Graneleira', 'simples', 'Graneleira'),
    ('Graneleira', 'bi', 'Bitrem'),
    ('Graneleira', 'bitrezao', 'Bitrezão'),
    ('Graneleira', 'rodo', 'Rodotrem'),
    ('Sider', 'simples', 'Sider'),
    ('Sider', 'bi', 'Bisider'),
    ('Sider', 'bitrezao', 'Bitrezão sider'),
    ('Sider', 'rodo', 'Rodosider'),
    ('Basculante', 'simples', 'Basculante'),
    ('Basculante', 'bi', 'Bicaçamba'),
    ('Basculante', 'bitrezao', 'Bitrezão basculante'),
    ('Basculante', 'rodo', 'Rodocaçamba')
  ) as n (carroceria, configuracao, nome)
  join config.carroceria c on c.nome = n.carroceria;
