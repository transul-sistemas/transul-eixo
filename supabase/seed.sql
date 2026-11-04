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

-- As 25 siglas, na ordem da régua do CLAUDE.md. Camada, aplica_a e tipos válidos: Apêndice A do
-- plano da Fase 3 (aprovado em 31/10/2026). O VAz saiu da régua em 03/11/2026 (o PÁT cobre o ativo parado).
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
  ('FOg', 'Folga', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 15),
  ('FEr', 'Férias', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 16),
  ('SMo', 'Sem motorista', 'atencao', 'sem-motorista', false, 'ambos', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], 17),
  ('SDo', 'Sem documento', 'impedida', 'impedida', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 18),
  ('PÁT', 'Pátio', 'patio', 'atividade', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 19),
  ('DOC', 'Problema documental', 'impedida', 'impedida', false, 'ambos', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 20),
  ('ALU', 'Alugado a terceiro', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 21),
  ('EMP', 'Emprestado', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 22),
  ('VEN', 'Disponível para venda', 'fora', 'fora-da-frota', false, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 23),
  ('SUC', 'Sucata', 'fora', 'baixada', true, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 24),
  ('VND', 'Vendido', 'fora', 'baixada', true, 'solo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], 25);

-- As seis carrocerias de partida. O catálogo é do Eixo e cresce com a confirmação da equipe.
insert into config.carroceria (nome) values
  ('Graneleira'),
  ('Sider'),
  ('Basculante'),
  ('Baú frigorífico'),
  ('Prancha'),
  ('Tanque');

-- As quatro configurações de conjunto, reconhecidas pela estrutura (regra da equipe, 03/11/2026):
-- unidades engatadas (o dolly conta), presença de dolly, eixos aceitos nos semirreboques (todos iguais
-- entre si) e eixos do dolly. O simples aceita de 1 a 6 eixos (ajuste de 03/11/2026).
insert into config.configuracao_de_conjunto (codigo, nome, unidades, com_dolly, eixos_dos_semirreboques, eixos_do_dolly) values
  ('simples', 'Simples', 1, false, '{1,2,3,4,5,6}', null),
  ('bi', 'Bi', 2, false, '{2}', null),
  ('bitrezao', 'Bitrezão', 2, false, '{3}', null),
  ('rodo', 'Rodo', 3, true, '{2}', 2);

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

-- ---------------------------------------------------------------------------------------------
-- Acesso (fatia 3.6): módulos, ações, escopos, perfis provisórios e as permissões de cada perfil.
-- Permissão = módulo × ação × escopo. O espelho é lib/seguranca/permissoes.ts (o teste confere os
-- dois e a assinatura no banco). O catálogo é ampliável.
-- ---------------------------------------------------------------------------------------------
insert into config.modulo (codigo, nome) values
  ('inicio', 'Início'),
  ('frota', 'Frota'),
  ('operacional', 'Operacional'),
  ('operacoes', 'Operações'),
  ('pessoas', 'Pessoas'),
  ('parceiros', 'Parceiros'),
  ('resultados', 'Resultados'),
  ('cadastros', 'Cadastros'),
  ('admin', 'Administração');

insert into config.acao (codigo, nome) values
  ('ver', 'Ver'),
  ('criar', 'Criar'),
  ('editar', 'Editar'),
  ('excluir', 'Excluir'),
  ('ver_documento', 'Ver o documento completo');

insert into config.escopo (codigo, nome) values
  ('tudo', 'Tudo'),
  ('minha_carteira', 'Minha carteira'),
  ('operacao', 'Operação'),
  ('filial', 'Filial');

insert into config.perfil (codigo, nome) values
  ('administrador', 'Administrador'),
  ('diretoria', 'Diretoria'),
  ('gestor_de_frota', 'Gestor de frota'),
  ('operacional', 'Operacional');

insert into config.permissao_do_perfil (perfil, modulo, acao, escopo) values
  ('administrador', 'inicio', 'ver', 'tudo'),
  ('administrador', 'inicio', 'criar', 'tudo'),
  ('administrador', 'inicio', 'editar', 'tudo'),
  ('administrador', 'inicio', 'excluir', 'tudo'),
  ('administrador', 'frota', 'ver', 'tudo'),
  ('administrador', 'frota', 'criar', 'tudo'),
  ('administrador', 'frota', 'editar', 'tudo'),
  ('administrador', 'frota', 'excluir', 'tudo'),
  ('administrador', 'operacional', 'ver', 'tudo'),
  ('administrador', 'operacional', 'criar', 'tudo'),
  ('administrador', 'operacional', 'editar', 'tudo'),
  ('administrador', 'operacional', 'excluir', 'tudo'),
  ('administrador', 'operacoes', 'ver', 'tudo'),
  ('administrador', 'operacoes', 'criar', 'tudo'),
  ('administrador', 'operacoes', 'editar', 'tudo'),
  ('administrador', 'operacoes', 'excluir', 'tudo'),
  ('administrador', 'pessoas', 'ver', 'tudo'),
  ('administrador', 'pessoas', 'criar', 'tudo'),
  ('administrador', 'pessoas', 'editar', 'tudo'),
  ('administrador', 'pessoas', 'excluir', 'tudo'),
  ('administrador', 'parceiros', 'ver', 'tudo'),
  ('administrador', 'parceiros', 'criar', 'tudo'),
  ('administrador', 'parceiros', 'editar', 'tudo'),
  ('administrador', 'parceiros', 'excluir', 'tudo'),
  ('administrador', 'resultados', 'ver', 'tudo'),
  ('administrador', 'resultados', 'criar', 'tudo'),
  ('administrador', 'resultados', 'editar', 'tudo'),
  ('administrador', 'resultados', 'excluir', 'tudo'),
  ('administrador', 'cadastros', 'ver', 'tudo'),
  ('administrador', 'cadastros', 'criar', 'tudo'),
  ('administrador', 'cadastros', 'editar', 'tudo'),
  ('administrador', 'cadastros', 'excluir', 'tudo'),
  ('administrador', 'admin', 'ver', 'tudo'),
  ('administrador', 'admin', 'criar', 'tudo'),
  ('administrador', 'admin', 'editar', 'tudo'),
  ('administrador', 'admin', 'excluir', 'tudo'),
  ('diretoria', 'inicio', 'ver', 'tudo'),
  ('diretoria', 'inicio', 'criar', 'tudo'),
  ('diretoria', 'inicio', 'editar', 'tudo'),
  ('diretoria', 'inicio', 'excluir', 'tudo'),
  ('diretoria', 'frota', 'ver', 'tudo'),
  ('diretoria', 'frota', 'criar', 'tudo'),
  ('diretoria', 'frota', 'editar', 'tudo'),
  ('diretoria', 'frota', 'excluir', 'tudo'),
  ('diretoria', 'operacional', 'ver', 'tudo'),
  ('diretoria', 'operacional', 'criar', 'tudo'),
  ('diretoria', 'operacional', 'editar', 'tudo'),
  ('diretoria', 'operacional', 'excluir', 'tudo'),
  ('diretoria', 'operacoes', 'ver', 'tudo'),
  ('diretoria', 'operacoes', 'criar', 'tudo'),
  ('diretoria', 'operacoes', 'editar', 'tudo'),
  ('diretoria', 'operacoes', 'excluir', 'tudo'),
  ('diretoria', 'pessoas', 'ver', 'tudo'),
  ('diretoria', 'pessoas', 'criar', 'tudo'),
  ('diretoria', 'pessoas', 'editar', 'tudo'),
  ('diretoria', 'pessoas', 'excluir', 'tudo'),
  ('diretoria', 'parceiros', 'ver', 'tudo'),
  ('diretoria', 'parceiros', 'criar', 'tudo'),
  ('diretoria', 'parceiros', 'editar', 'tudo'),
  ('diretoria', 'parceiros', 'excluir', 'tudo'),
  ('diretoria', 'resultados', 'ver', 'tudo'),
  ('diretoria', 'resultados', 'criar', 'tudo'),
  ('diretoria', 'resultados', 'editar', 'tudo'),
  ('diretoria', 'resultados', 'excluir', 'tudo'),
  ('diretoria', 'cadastros', 'ver', 'tudo'),
  ('diretoria', 'cadastros', 'criar', 'tudo'),
  ('diretoria', 'cadastros', 'editar', 'tudo'),
  ('diretoria', 'cadastros', 'excluir', 'tudo'),
  ('diretoria', 'admin', 'ver', 'tudo'),
  ('diretoria', 'admin', 'criar', 'tudo'),
  ('diretoria', 'admin', 'editar', 'tudo'),
  ('diretoria', 'admin', 'excluir', 'tudo'),
  ('administrador', 'pessoas', 'ver_documento', 'tudo'),
  ('gestor_de_frota', 'inicio', 'ver', 'tudo'),
  ('gestor_de_frota', 'frota', 'ver', 'minha_carteira'),
  ('gestor_de_frota', 'frota', 'criar', 'minha_carteira'),
  ('gestor_de_frota', 'frota', 'editar', 'minha_carteira'),
  ('gestor_de_frota', 'frota', 'excluir', 'minha_carteira'),
  ('operacional', 'inicio', 'ver', 'tudo'),
  ('operacional', 'operacional', 'ver', 'filial'),
  ('operacional', 'operacional', 'criar', 'filial'),
  ('operacional', 'operacional', 'editar', 'filial');

-- Papéis da pessoa (o gestor da carteira exige o de gestor de frota).
insert into config.papel (codigo, nome) values
  ('gestor_de_frota', 'Gestor de frota'),
  ('motorista', 'Motorista'),
  ('acionista', 'Acionista'),
  ('agregado', 'Agregado');

-- Parâmetros: a correção de evento de status feita depois deste prazo gera alerta, que fica visível
-- pelos dias do segundo parâmetro.
insert into config.parametro (chave, valor, descricao) values
  ('prazo_de_correcao_de_status_dias', '7', 'Dias depois do fato a partir dos quais a correção de um evento de status gera alerta.'),
  ('dias_do_alerta_de_correcao', '30', 'Por quantos dias o alerta de correção tardia fica visível.'),
  ('dias_parado_em_patio', '15', 'Dias em PÁT a partir dos quais o ativo gera o alerta parado_em_patio (padrão provisório).');

-- As 3 garagens (o lugar, a raiz da árvore de CRs), com o primeiro dígito do código de 7 dígitos de
-- frota no Sankhya. A raiz 2 (Matriz, descrições "SLZ") ainda está a conferir (Alexandre, 03/11/2026).
insert into config.garagem (codigo, rotulo, digito_da_raiz, conferencia) values
  ('matriz', 'Matriz', 2, 'a_conferir'),
  ('cordeiropolis', 'Cordeirópolis', 4, 'conferida'),
  ('parauapebas', 'Parauapebas', 6, 'conferida');

-- As 13 filiais do CR do Sankhya (AD_GARAGEM do CR), com o rótulo e a ordem de lá. São um rótulo, não o
-- lugar. A sugestão para a importação é só sugestão, a conferir: nada se deriva dela sem confirmação.
insert into config.filial_do_cr (codigo, rotulo, ordem, sugestao_na_importacao) values
  ('C', 'Operação Sudeste', 1, 'operacao'),
  ('M', 'Operação Matriz', 2, 'operacao'),
  ('P', 'Parauapebas - OZ Minerais', 3, 'operacao'),
  ('R', 'Parauapebas Sem Operação', 4, 'sem_operacao'),
  ('Q', 'Parauapebas - Rollom', 4, 'operacao'),
  ('S', 'Veículo ADM Matriz', 5, 'apoio'),
  ('X', 'Veículos ADM Parauapebas', 6, 'apoio'),
  ('Z', 'Parceiros', 6, 'veiculo_de_parceiro'),
  ('U', 'Veículos Vendidos', 6, 'baixa'),
  ('V', 'Veículos ADM Cordeiro', 6, 'apoio'),
  ('T', 'Operação Porto', 7, 'operacao'),
  ('A', 'Operação Matriz Sem Operação', 8, 'sem_operacao'),
  ('O', 'Cordeirópolis Sem Operação', 9, 'sem_operacao');
