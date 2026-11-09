-- P0 S1 (homologação de 09/11/2026): só o gestor de destino recebe e conclui a transferência.
-- A regra é a da fatia 3.6 (docs/decisoes.md, item 7): "o destino altera, recebe e conclui". As três
-- conferências abaixo aceitavam também "quem edita a placa na Frota", e o gestor de origem edita a placa
-- até a conclusão: ele recebia e concluía o próprio pedido (respondendo as pendências pelo destino). Sem
-- exceção administrativa documentada, o Administrador também deixa de agir pelo destino. Nas funções
-- internas, a falta de auth.uid() só libera quem chama fora da API (o dono do banco, nos testes): uma
-- sessão authenticated ou anon sem o usuário no token passa pela mesma conferência.
-- Só muda a condição de quem age; o resto de cada função é o mesmo. Teste: supabase/tests/83.

-- Quem age sobre o pedido: só o destino. Devolve a versão e a situação.
create or replace function nucleo.pedido_para_agir(
  p_transferencia_id uuid, p_mensagem text,
  out ativo_id uuid, out para_gestor_id uuid, out situacao text, out versao integer
)
language plpgsql
set search_path = ''
as $$
begin
  select t.ativo_id, t.para_gestor_id, t.situacao, t.versao
    into ativo_id, para_gestor_id, situacao, versao
    from nucleo.transferencia t
   where t.id = p_transferencia_id and t.excluido_em is null
     for update;
  if not found then
    raise exception 'Você não tem acesso a este pedido de transferência.' using errcode = '42501';
  end if;
  if config.usuario_atual() is distinct from para_gestor_id then
    raise exception '%', p_mensagem using errcode = '42501';
  end if;
end;
$$;

create or replace function nucleo.receber_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns void
language plpgsql
security definer -- justificativa: o gestor de destino precisa conferir o gestor vigente da carteira de origem, que não enxerga; a função confere que quem chama pela API (authenticated ou anon, com ou sem usuário no token) é o destino; só o dono do banco, fora da API, chama sem sessão; search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_para uuid;
  v_situacao text;
begin
  select ativo_id, de_gestor_id, para_gestor_id, situacao
    into v_ativo, v_de, v_para, v_situacao
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if ((select auth.uid()) is not null or current_setting('role', true) in ('authenticated', 'anon'))
     and config.usuario_atual() is distinct from v_para then
    raise exception 'Só o gestor de destino recebe esta placa.' using errcode = '42501';
  end if;
  if v_situacao <> 'pendente' then
    raise exception 'Este pedido já está %: só se recebe um pedido pendente.', v_situacao;
  end if;
  if not exists (
    select 1 from nucleo.gestor_da_carteira
     where ativo_id = v_ativo and gestor_id = v_de and fim is null and excluido_em is null
  ) then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.transferencia
     set situacao = 'em_conferencia', recebida_em = p_em
   where id = p_transferencia_id;
end;
$$;

create or replace function nucleo.concluir_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns uuid
language plpgsql
security definer -- justificativa: concluir fecha a vigência do gestor de origem, fora da carteira de quem recebe; a função confere que quem chama pela API (authenticated ou anon, com ou sem usuário no token) é o destino; só o dono do banco, fora da API, chama sem sessão; search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_para uuid;
  v_situacao text;
  v_recebida timestamptz;
  v_vigente uuid;
  v_vigente_gestor uuid;
  v_sem_resposta int;
  v_novo uuid;
begin
  select ativo_id, de_gestor_id, para_gestor_id, situacao, recebida_em
    into v_ativo, v_de, v_para, v_situacao, v_recebida
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if ((select auth.uid()) is not null or current_setting('role', true) in ('authenticated', 'anon'))
     and config.usuario_atual() is distinct from v_para then
    raise exception 'Só o gestor de destino conclui esta transferência.' using errcode = '42501';
  end if;
  if v_situacao <> 'em_conferencia' then
    raise exception 'Este pedido está %: só se conclui um pedido em conferência.', v_situacao;
  end if;
  if p_em < v_recebida then
    raise exception 'A conclusão não pode ser antes do recebimento (%).', v_recebida;
  end if;

  select count(*) into v_sem_resposta
    from nucleo.transferencia_pendencia
   where transferencia_id = p_transferencia_id and excluido_em is null and resposta is null;
  if v_sem_resposta > 0 then
    raise exception 'Faltam % pendência(s) sem resposta: responda cada uma (resolvida, aceita com nota ou contestada) antes de concluir.', v_sem_resposta;
  end if;

  select id, gestor_id
    into v_vigente, v_vigente_gestor
    from nucleo.gestor_da_carteira
   where ativo_id = v_ativo and fim is null and excluido_em is null
     for update;
  if not found or v_vigente_gestor <> v_de then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.gestor_da_carteira
     set fim = p_em, fim_origem = 'informada'
   where id = v_vigente;

  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
  values (v_ativo, v_para, p_em, 'informada')
  returning id into v_novo;

  update nucleo.transferencia
     set situacao = 'concluida', concluida_em = p_em
   where id = p_transferencia_id;

  return v_novo;
end;
$$;

update config.funcao_executavel
   set justificativa = 'Trava o pedido e confere que quem age é o gestor de destino, pelas políticas da transferência.'
 where assinatura = 'nucleo.pedido_para_agir(uuid,text)';
