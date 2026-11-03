-- Fase 3, fatia 3.6 (3 de 3): grants explícitos mínimos e as políticas de RLS de todas as tabelas.
--
--  * `anon` não recebe nada. `authenticated` recebe uso dos schemas, SELECT, INSERT e UPDATE nas
--    tabelas (nunca DELETE: ninguém apaga de verdade); o UPDATE de nucleo.ativo deixa a coluna `tipo`
--    de fora (o tipo só muda por mudar_tipo_do_ativo).
--  * Uma política por tabela e por ação (ler, criar, alterar), sempre TO authenticated. As placas e o
--    que é delas seguem o escopo (config.ve_ativo): Frota e Operacional leem; o cadastro e os vínculos
--    da placa são da Frota; custódia e eventos de status, da Frota e do Operacional. Catálogos: todo
--    usuário vinculado lê; Cadastros (ou Administração, nos catálogos de acesso e da régua) grava.
--  * As funções que o app executa vêm de config.funcao_executavel, cada uma com a justificativa.

-- ---------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------
grant usage on schema nucleo, config, auditoria to authenticated;

grant select, insert, update on
  nucleo.pessoa, nucleo.placa_do_ativo, nucleo.operacao, nucleo.cr, nucleo.cr_do_ativo,
  nucleo.posse_do_ativo, nucleo.gestor_da_carteira, nucleo.baixa_do_ativo, nucleo.custodia,
  nucleo.transferencia, nucleo.transferencia_pendencia, nucleo.composicao, nucleo.meta_do_conjunto,
  nucleo.evento_de_status, nucleo.usuario, nucleo.usuario_operacao, nucleo.usuario_filial,
  nucleo.papel_da_pessoa,
  config.carroceria, config.marca, config.modelo, config.filial, config.garagem,
  config.camada_de_status, config.status, config.configuracao_de_conjunto,
  config.nomenclatura_de_conjunto, config.modulo, config.acao, config.escopo, config.perfil,
  config.permissao_do_perfil, config.papel, config.parametro, config.funcao_executavel
to authenticated;

grant select, insert on nucleo.pessoa_documento to authenticated;
grant select on nucleo.estado_de_status, auditoria.evento to authenticated;
grant select on nucleo.placa_atual, nucleo.operacao_do_ativo, nucleo.alerta_de_vinculo, nucleo.pessoa_para_leitura to authenticated;

-- nucleo.ativo: o UPDATE sem a coluna tipo.
grant select, insert on nucleo.ativo to authenticated;
grant update (renavam, numero_de_serie, chassi, codveiculo, versao, excluido_em, excluido_por,
              motivo_da_exclusao, carroceria_id, modelo_id, funcao, eixos)
  on nucleo.ativo to authenticated;

-- As funções que o app executa (a lista de exceções, com o porquê de cada uma).
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.usuario_atual()', 'Usada nas políticas: a Pessoa do usuário logado.'),
  ('config.perfil_atual()', 'Usada nas políticas e no app: o perfil do usuário logado.'),
  ('config.pode(text,text)', 'Usada nas políticas: o perfil tem a ação no módulo.'),
  ('config.pode_algum(text[],text)', 'Usada nas políticas e na exclusão lógica: a ação em algum dos módulos.'),
  ('config.ve_ativo(uuid,text[],text)', 'Usada nas políticas: o escopo do usuário alcança a placa.'),
  ('config.ativo_sem_gestor(uuid)', 'Usada na política do gestor da carteira: a placa nova ainda sem gestor.'),
  ('config.nome_do_conjunto(uuid,integer,boolean,integer,integer)', 'Pura sobre o catálogo: o nome do conjunto pela estrutura.'),
  ('nucleo.normalizar_documento(text)', 'Validação no gatilho do documento: só dígitos, sem acesso a dado.'),
  ('nucleo.documento_valido(text)', 'Validação no CHECK do documento: pura e imutável.'),
  ('nucleo.mascarar_documento(text)', 'Pura e imutável: a máscara do documento.'),
  ('nucleo.normalizar_renavam(text)', 'Validação no gatilho do ativo: pura e imutável.'),
  ('nucleo.renavam_valido(text)', 'Validação no CHECK do ativo: pura e imutável.'),
  ('nucleo.normalizar_placa(text)', 'Validação no gatilho da placa: pura e imutável.'),
  ('nucleo.placa_valida(text)', 'Validação no CHECK da placa: pura e imutável.'),
  ('nucleo.nome_do_tipo(nucleo.tipo_de_ativo)', 'Pura e imutável: o nome do tipo nas mensagens.'),
  ('nucleo.em_conjunto(uuid,timestamp with time zone)', 'Validação do evento de status: o ativo está num conjunto (com a RLS de quem grava).'),
  ('nucleo.sigla_valida(text,nucleo.tipo_de_ativo,boolean)', 'Validação do evento de status: pura sobre o catálogo da régua.'),
  ('nucleo.estado_em(uuid,text,timestamp with time zone)', 'Leitura da situação, com a RLS de quem consulta.'),
  ('nucleo.situacao_com_causa(uuid,timestamp with time zone)', 'Leitura da situação, com a RLS de quem consulta.'),
  ('nucleo.situacao_em(uuid,timestamp with time zone)', 'Leitura da situação num instante, com a RLS de quem consulta.'),
  ('nucleo.situacao_atual(uuid)', 'Leitura da situação de agora, com a RLS de quem consulta.'),
  ('nucleo.situacao_do_conjunto(uuid,timestamp with time zone)', 'Leitura da situação do conjunto, com a RLS de quem consulta.'),
  ('nucleo.conferir_conjunto(uuid)', 'Validação da estrutura do conjunto no fim da transação (chamada pelo gatilho).'),
  ('nucleo.nome_do_conjunto(uuid,timestamp with time zone)', 'Leitura do nome do conjunto, com a RLS de quem consulta.'),
  ('nucleo.meta_do_conjunto_de(uuid,timestamp with time zone)', 'Leitura da meta do conjunto, com a RLS de quem consulta.'),
  ('nucleo.registrar_evento(uuid,text,timestamp with time zone,text,config.origem_da_data,text,text)', 'Gravação de evento de status, pelas políticas do evento.'),
  ('nucleo.engatar(uuid,uuid,smallint,timestamp with time zone)', 'Gravação atômica do engate, pelas políticas da composição e do evento.'),
  ('nucleo.desatrelar(uuid,timestamp with time zone,uuid[])', 'Gravação atômica do desengate, pelas políticas da composição e do evento.'),
  ('nucleo.registrar_baixa(uuid,text,timestamp with time zone,text)', 'Gravação atômica da baixa, pelas políticas da baixa, da posse, do gestor e do evento.'),
  ('nucleo.mudar_tipo_do_ativo(uuid,nucleo.tipo_de_ativo,text)', 'Único caminho para mudar o tipo; confere a permissão por dentro.'),
  ('nucleo.receber_transferencia(uuid,timestamp with time zone)', 'O gestor de destino recebe a placa; confere a permissão por dentro.'),
  ('nucleo.concluir_transferencia(uuid,timestamp with time zone)', 'O gestor de destino conclui a transferência; confere a permissão por dentro.'),
  ('auditoria.consumir_envio(uuid,text)', 'Idempotência das gravações: consome a chave de envio.');

do $$
declare
  v_assinatura text;
begin
  for v_assinatura in select assinatura from config.funcao_executavel loop
    execute format('grant execute on function %s to authenticated', v_assinatura);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Placas e o que é delas (escopo pela placa)
-- ---------------------------------------------------------------------------------------------
create policy ativo_ler on nucleo.ativo for select to authenticated
  using (config.ve_ativo(id, array['frota', 'operacional'], 'ver'));
create policy ativo_criar on nucleo.ativo for insert to authenticated
  with check (config.pode('frota', 'criar'));
create policy ativo_alterar on nucleo.ativo for update to authenticated
  using (config.ve_ativo(id, array['frota'], 'editar'))
  with check (config.ve_ativo(id, array['frota'], 'editar'));

create policy placa_do_ativo_ler on nucleo.placa_do_ativo for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy placa_do_ativo_criar on nucleo.placa_do_ativo for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota'], 'criar'));
create policy placa_do_ativo_alterar on nucleo.placa_do_ativo for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar'));

create policy cr_do_ativo_ler on nucleo.cr_do_ativo for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy cr_do_ativo_criar on nucleo.cr_do_ativo for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota'], 'criar'));
create policy cr_do_ativo_alterar on nucleo.cr_do_ativo for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar'));

create policy posse_do_ativo_ler on nucleo.posse_do_ativo for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy posse_do_ativo_criar on nucleo.posse_do_ativo for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota'], 'criar'));
create policy posse_do_ativo_alterar on nucleo.posse_do_ativo for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar'));

-- O gestor pode pôr-se na carteira só de placa ainda sem gestor (o cadastro novo).
create policy gestor_da_carteira_ler on nucleo.gestor_da_carteira for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy gestor_da_carteira_criar on nucleo.gestor_da_carteira for insert to authenticated
  with check (
    config.ve_ativo(ativo_id, array['frota'], 'criar')
    or (config.pode('frota', 'criar') and gestor_id = config.usuario_atual() and config.ativo_sem_gestor(ativo_id))
  );
create policy gestor_da_carteira_alterar on nucleo.gestor_da_carteira for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar'));

create policy baixa_do_ativo_ler on nucleo.baixa_do_ativo for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy baixa_do_ativo_criar on nucleo.baixa_do_ativo for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota'], 'criar'));
create policy baixa_do_ativo_alterar on nucleo.baixa_do_ativo for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar'));

create policy custodia_ler on nucleo.custodia for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy custodia_criar on nucleo.custodia for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'criar'));
create policy custodia_alterar on nucleo.custodia for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'editar'));

create policy composicao_ler on nucleo.composicao for select to authenticated
  using (config.ve_ativo(cavalo_id, array['frota', 'operacional'], 'ver')
         or config.ve_ativo(implemento_id, array['frota', 'operacional'], 'ver'));
create policy composicao_criar on nucleo.composicao for insert to authenticated
  with check (config.ve_ativo(cavalo_id, array['frota'], 'criar') and config.ve_ativo(implemento_id, array['frota'], 'criar'));
create policy composicao_alterar on nucleo.composicao for update to authenticated
  using (config.ve_ativo(cavalo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(cavalo_id, array['frota'], 'editar'));

create policy meta_do_conjunto_ler on nucleo.meta_do_conjunto for select to authenticated
  using (config.ve_ativo(cavalo_id, array['frota', 'operacional'], 'ver'));
create policy meta_do_conjunto_criar on nucleo.meta_do_conjunto for insert to authenticated
  with check (config.ve_ativo(cavalo_id, array['frota'], 'criar'));
create policy meta_do_conjunto_alterar on nucleo.meta_do_conjunto for update to authenticated
  using (config.ve_ativo(cavalo_id, array['frota'], 'editar'))
  with check (config.ve_ativo(cavalo_id, array['frota'], 'editar'));

create policy evento_de_status_ler on nucleo.evento_de_status for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));
create policy evento_de_status_criar on nucleo.evento_de_status for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'criar'));
create policy evento_de_status_alterar on nucleo.evento_de_status for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'editar'))
  with check (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'editar'));

create policy estado_de_status_ler on nucleo.estado_de_status for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));

-- A transferência: quem alcança a placa, ou quem envia ou recebe.
create policy transferencia_ler on nucleo.transferencia for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver')
         or config.usuario_atual() in (de_gestor_id, para_gestor_id));
create policy transferencia_criar on nucleo.transferencia for insert to authenticated
  with check (config.ve_ativo(ativo_id, array['frota'], 'criar'));
create policy transferencia_alterar on nucleo.transferencia for update to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'editar') or config.usuario_atual() = para_gestor_id)
  with check (config.ve_ativo(ativo_id, array['frota'], 'editar') or config.usuario_atual() = para_gestor_id);

create policy transferencia_pendencia_ler on nucleo.transferencia_pendencia for select to authenticated
  using (exists (select 1 from nucleo.transferencia t where t.id = transferencia_id));
create policy transferencia_pendencia_criar on nucleo.transferencia_pendencia for insert to authenticated
  with check (exists (select 1 from nucleo.transferencia t where t.id = transferencia_id));
create policy transferencia_pendencia_alterar on nucleo.transferencia_pendencia for update to authenticated
  using (exists (select 1 from nucleo.transferencia t where t.id = transferencia_id))
  with check (exists (select 1 from nucleo.transferencia t where t.id = transferencia_id));

-- ---------------------------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------------------------
create policy pessoa_ler on nucleo.pessoa for select to authenticated
  using (config.usuario_atual() is not null);
create policy pessoa_criar on nucleo.pessoa for insert to authenticated
  with check (config.pode('pessoas', 'criar'));
create policy pessoa_alterar on nucleo.pessoa for update to authenticated
  using (config.pode('pessoas', 'editar'))
  with check (config.pode('pessoas', 'editar'));

-- O documento completo só com pessoas.ver_documento.
create policy pessoa_documento_ler on nucleo.pessoa_documento for select to authenticated
  using (config.pode('pessoas', 'ver_documento'));
create policy pessoa_documento_criar on nucleo.pessoa_documento for insert to authenticated
  with check (config.pode('pessoas', 'criar'));

create policy papel_da_pessoa_ler on nucleo.papel_da_pessoa for select to authenticated
  using (config.usuario_atual() is not null);
create policy papel_da_pessoa_criar on nucleo.papel_da_pessoa for insert to authenticated
  with check (config.pode('pessoas', 'criar'));
create policy papel_da_pessoa_alterar on nucleo.papel_da_pessoa for update to authenticated
  using (config.pode('pessoas', 'editar'))
  with check (config.pode('pessoas', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Operação e CR (cadastros)
-- ---------------------------------------------------------------------------------------------
create policy operacao_ler on nucleo.operacao for select to authenticated
  using (config.usuario_atual() is not null);
create policy operacao_criar on nucleo.operacao for insert to authenticated
  with check (config.pode('cadastros', 'criar'));
create policy operacao_alterar on nucleo.operacao for update to authenticated
  using (config.pode('cadastros', 'editar'))
  with check (config.pode('cadastros', 'editar'));

create policy cr_ler on nucleo.cr for select to authenticated
  using (config.usuario_atual() is not null);
create policy cr_criar on nucleo.cr for insert to authenticated
  with check (config.pode('cadastros', 'criar'));
create policy cr_alterar on nucleo.cr for update to authenticated
  using (config.pode('cadastros', 'editar'))
  with check (config.pode('cadastros', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Usuários e escopos (Administração); cada um lê o próprio vínculo
-- ---------------------------------------------------------------------------------------------
create policy usuario_ler on nucleo.usuario for select to authenticated
  using (auth_user_id = (select auth.uid()) or config.pode('admin', 'ver'));
create policy usuario_criar on nucleo.usuario for insert to authenticated
  with check (config.pode('admin', 'criar'));
create policy usuario_alterar on nucleo.usuario for update to authenticated
  using (config.pode('admin', 'editar'))
  with check (config.pode('admin', 'editar'));

create policy usuario_operacao_ler on nucleo.usuario_operacao for select to authenticated
  using (usuario_id = config.usuario_atual() or config.pode('admin', 'ver'));
create policy usuario_operacao_criar on nucleo.usuario_operacao for insert to authenticated
  with check (config.pode('admin', 'criar'));
create policy usuario_operacao_alterar on nucleo.usuario_operacao for update to authenticated
  using (config.pode('admin', 'editar'))
  with check (config.pode('admin', 'editar'));

create policy usuario_filial_ler on nucleo.usuario_filial for select to authenticated
  using (usuario_id = config.usuario_atual() or config.pode('admin', 'ver'));
create policy usuario_filial_criar on nucleo.usuario_filial for insert to authenticated
  with check (config.pode('admin', 'criar'));
create policy usuario_filial_alterar on nucleo.usuario_filial for update to authenticated
  using (config.pode('admin', 'editar'))
  with check (config.pode('admin', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Catálogos de cadastro: todo usuário vinculado lê; Cadastros grava
-- ---------------------------------------------------------------------------------------------
create policy carroceria_ler on config.carroceria for select to authenticated using (config.usuario_atual() is not null);
create policy carroceria_criar on config.carroceria for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy carroceria_alterar on config.carroceria for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy marca_ler on config.marca for select to authenticated using (config.usuario_atual() is not null);
create policy marca_criar on config.marca for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy marca_alterar on config.marca for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy modelo_ler on config.modelo for select to authenticated using (config.usuario_atual() is not null);
create policy modelo_criar on config.modelo for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy modelo_alterar on config.modelo for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy filial_ler on config.filial for select to authenticated using (config.usuario_atual() is not null);
create policy filial_criar on config.filial for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy filial_alterar on config.filial for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy garagem_ler on config.garagem for select to authenticated using (config.usuario_atual() is not null);
create policy garagem_criar on config.garagem for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy garagem_alterar on config.garagem for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy nomenclatura_de_conjunto_ler on config.nomenclatura_de_conjunto for select to authenticated using (config.usuario_atual() is not null);
create policy nomenclatura_de_conjunto_criar on config.nomenclatura_de_conjunto for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy nomenclatura_de_conjunto_alterar on config.nomenclatura_de_conjunto for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

create policy configuracao_de_conjunto_ler on config.configuracao_de_conjunto for select to authenticated using (config.usuario_atual() is not null);
create policy configuracao_de_conjunto_criar on config.configuracao_de_conjunto for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy configuracao_de_conjunto_alterar on config.configuracao_de_conjunto for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Catálogos da régua e de acesso: todo usuário vinculado lê; Administração grava
-- ---------------------------------------------------------------------------------------------
create policy camada_de_status_ler on config.camada_de_status for select to authenticated using (config.usuario_atual() is not null);
create policy camada_de_status_criar on config.camada_de_status for insert to authenticated with check (config.pode('admin', 'criar'));
create policy camada_de_status_alterar on config.camada_de_status for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy status_ler on config.status for select to authenticated using (config.usuario_atual() is not null);
create policy status_criar on config.status for insert to authenticated with check (config.pode('admin', 'criar'));
create policy status_alterar on config.status for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy modulo_ler on config.modulo for select to authenticated using (config.usuario_atual() is not null);
create policy modulo_criar on config.modulo for insert to authenticated with check (config.pode('admin', 'criar'));
create policy modulo_alterar on config.modulo for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy acao_ler on config.acao for select to authenticated using (config.usuario_atual() is not null);
create policy acao_criar on config.acao for insert to authenticated with check (config.pode('admin', 'criar'));
create policy acao_alterar on config.acao for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy escopo_ler on config.escopo for select to authenticated using (config.usuario_atual() is not null);
create policy escopo_criar on config.escopo for insert to authenticated with check (config.pode('admin', 'criar'));
create policy escopo_alterar on config.escopo for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy perfil_ler on config.perfil for select to authenticated using (config.usuario_atual() is not null);
create policy perfil_criar on config.perfil for insert to authenticated with check (config.pode('admin', 'criar'));
create policy perfil_alterar on config.perfil for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy permissao_do_perfil_ler on config.permissao_do_perfil for select to authenticated using (config.usuario_atual() is not null);
create policy permissao_do_perfil_criar on config.permissao_do_perfil for insert to authenticated with check (config.pode('admin', 'criar'));
create policy permissao_do_perfil_alterar on config.permissao_do_perfil for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy papel_ler on config.papel for select to authenticated using (config.usuario_atual() is not null);
create policy papel_criar on config.papel for insert to authenticated with check (config.pode('admin', 'criar'));
create policy papel_alterar on config.papel for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy parametro_ler on config.parametro for select to authenticated using (config.usuario_atual() is not null);
create policy parametro_criar on config.parametro for insert to authenticated with check (config.pode('admin', 'criar'));
create policy parametro_alterar on config.parametro for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

create policy funcao_executavel_ler on config.funcao_executavel for select to authenticated using (config.pode('admin', 'ver'));
create policy funcao_executavel_criar on config.funcao_executavel for insert to authenticated with check (config.pode('admin', 'criar'));
create policy funcao_executavel_alterar on config.funcao_executavel for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Auditoria: só Administração lê; ninguém grava direto (só o gatilho de auditoria).
-- ---------------------------------------------------------------------------------------------
create policy auditoria_evento_ler on auditoria.evento for select to authenticated
  using (config.pode('admin', 'ver'));
