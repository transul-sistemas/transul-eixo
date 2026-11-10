-- Parceiro pendente (Alexandre, 11/11/2026): os acionistas nascem dos agrupadores do Sankhya (o CR pai dos
-- CRs de acionista) sem CPF, com a marca de pendente, e são ligados ao agrupador. O CPF vem depois.
--
--  * A marca é a de sempre: nucleo.pessoa.cadastro_pendente (20261106160000). Só com ela a pessoa existe
--    sem documento; ela abre a exceção pessoa_sem_documento na fila e cai quando o documento é gravado.
--  * nucleo.cadastrar_parceiro_pendente(agrupador): só a carga (o dono do banco) executa. Cria a pessoa
--    com o nome do agrupador e o parceiro acionista ligado a ele. Idempotente pelo agrupador (que é de um
--    parceiro só, índice único): repetir devolve o mesmo parceiro, nunca uma duplicata.
--  * nucleo.completar_documento_do_parceiro(parceiro, documento, chave): quem tem Parceiros › editar
--    grava o CPF ou CNPJ do parceiro sem documento. O documento que já é de outra pessoa é recusado (um
--    CPF existe uma vez só; juntar as duas pessoas fica para a fila, hipótese).

-- A mensagem da fila deixa de citar só a cópia da v1: a pessoa pendente também nasce do agrupador.
create or replace function nucleo.registrar_pessoa_pendente()
returns trigger
language plpgsql
security definer -- justificativa: quem grava a pessoa (a carga) não tem grant de escrita na fila de exceções; a função só abre a exceção pessoa_sem_documento da própria pessoa, com search_path vazio.
set search_path = ''
as $$
begin
  if new.cadastro_pendente and new.excluido_em is null then
    insert into nucleo.fila_de_excecoes (pessoa_id, assunto, descricao)
    values (new.id, 'pessoa_sem_documento',
            'A pessoa entrou na carga inicial (cópia da v1 ou agrupador do Sankhya) sem CPF ou CNPJ. Grave o documento para completar o cadastro.')
    on conflict (pessoa_id, assunto) where resolvida_em is null and pessoa_id is not null and assunto is not null do nothing;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- A carga: o parceiro acionista pendente a partir do agrupador
-- ---------------------------------------------------------------------------------------------
create function nucleo.cadastrar_parceiro_pendente(p_cr_agrupador_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_nome text;
  v_pessoa uuid;
  v_id uuid;
begin
  select p.id into v_id
    from parceiros.parceiro p
   where p.cr_agrupador_id = p_cr_agrupador_id and p.excluido_em is null;
  if v_id is not null then
    return jsonb_build_object('parceiro_id', v_id, 'criado', false);
  end if;

  select btrim(c.nome) into v_nome
    from nucleo.cr c
   where c.id = p_cr_agrupador_id and c.excluido_em is null
     and exists (select 1 from nucleo.cr f
                  where f.cr_pai_id = c.id and f.tipo = 'acionista' and f.excluido_em is null);
  if v_nome is null or v_nome = '' then
    raise exception 'O CR não é agrupador de CRs de acionista (ou está sem nome).' using errcode = '23514';
  end if;

  insert into nucleo.pessoa (nome, cadastro_pendente) values (v_nome, true) returning id into v_pessoa;
  insert into parceiros.parceiro (pessoa_id, tipos, cr_agrupador_id)
  values (v_pessoa, array['acionista'], p_cr_agrupador_id)
  returning id into v_id;
  return jsonb_build_object('parceiro_id', v_id, 'criado', true);
end;
$$;
revoke all on function nucleo.cadastrar_parceiro_pendente(uuid) from public, anon, authenticated;
comment on function nucleo.cadastrar_parceiro_pendente(uuid) is
  'Carga: o parceiro acionista sem CPF (pessoa com a marca de cadastro pendente e o nome do agrupador), ligado ao agrupador do Sankhya. Idempotente pelo agrupador. Só o dono do banco executa.';

-- ---------------------------------------------------------------------------------------------
-- Completar o documento do parceiro pendente
-- ---------------------------------------------------------------------------------------------
create function nucleo.completar_documento_do_parceiro(p_parceiro uuid, p_documento text, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: a pessoa e o documento não têm escrita direta para quem edita parceiro; a função confere parceiros.editar, valida o documento, recusa o de outra pessoa e grava só o documento da pessoa do parceiro (o gatilho derruba a marca e resolve a fila); search_path vazio.
set search_path = ''
as $$
declare
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_pessoa uuid;
  v_id uuid;
begin
  if not config.pode('parceiros', 'editar') then
    raise exception 'Você não tem permissão para editar parceiro. Peça a quem administra o acesso.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'completar_documento_do_parceiro');
  if v_id is not null then
    return (select jsonb_build_object('parceiro_id', p.id, 'documento_mascarado', s.documento_mascarado)
              from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = v_id);
  end if;

  select p.pessoa_id into v_pessoa from parceiros.parceiro p where p.id = p_parceiro and p.excluido_em is null;
  if v_pessoa is null then
    raise exception 'Parceiro não encontrado. Atualize a lista e tente de novo.' using errcode = 'P0002';
  end if;
  if v_documento !~ '^([0-9]{11}|[0-9]{14})$' or not nucleo.documento_valido(v_documento) then
    raise exception 'O CPF ou CNPJ não é válido. Confira os números (CPF com 11, CNPJ com 14).' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.pessoa_documento d where d.pessoa_id = v_pessoa) then
    raise exception 'Este parceiro já tem documento.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.pessoa_documento d where d.documento = v_documento) then
    raise exception 'Este CPF ou CNPJ já é de outra pessoa. Confira o documento ou peça para juntar os cadastros.'
      using errcode = '23505';
  end if;

  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, v_documento);
  perform auditoria.concluir_envio(p_chave, p_parceiro);

  return (select jsonb_build_object('parceiro_id', p.id, 'documento_mascarado', s.documento_mascarado)
            from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = p_parceiro);
end;
$$;
revoke all on function nucleo.completar_documento_do_parceiro(uuid, text, uuid) from public, anon;
comment on function nucleo.completar_documento_do_parceiro(uuid, text, uuid) is
  'Completar o CPF ou CNPJ do parceiro sem documento (o pendente da carga): Parceiros › editar, documento válido e de ninguém mais. A marca de pendente cai e a fila é resolvida. Chave de envio.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.completar_documento_do_parceiro(uuid,text,uuid)',
   'Completar o documento do parceiro pendente: confere a permissão e o documento e grava pela função.');
grant execute on function nucleo.completar_documento_do_parceiro(uuid, text, uuid) to authenticated;
