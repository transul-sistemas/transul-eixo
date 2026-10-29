-- Áreas do banco do TranSul Eixo. Só os schemas: tabelas entram nas próximas fases
-- e permissões (grants e RLS) entram na Fase 3.

create schema if not exists nucleo;
comment on schema nucleo is 'Pessoa, ativo, composição, operação, CR e todos os vínculos com vigência';

create schema if not exists operacional;
comment on schema operacional is 'Pátio, fila, ordens de carregamento, totem';

create schema if not exists pessoas;
comment on schema pessoas is 'Vínculo, escala, status diário, documentos, diárias, premiação, campanhas';

create schema if not exists rh_clinico;
comment on schema rh_clinico is 'Exames e dados de saúde, isolados, com acesso registrado';

create schema if not exists parceiros;
comment on schema parceiros is 'Conciliação, livro do acionista, locação, venda parcelada';

create schema if not exists financeiro;
comment on schema financeiro is 'Fatos importados, ajustes, fechamentos com foto';

create schema if not exists sync;
comment on schema sync is 'Controle e autoconferência das sincronizações';

create schema if not exists config;
comment on schema config is 'Catálogos, régua de status, regras e parâmetros (entre eles, o corte da competência)';

create schema if not exists auditoria;
comment on schema auditoria is 'Quem fez o quê, quando e por quê';
