-- Dados de DESENVOLVIMENTO do Eixo (fatia 3.9a). Só para o Supabase LOCAL: `pnpm db:dev-dados` (cerca
-- de 200 ativos) e `pnpm db:carga` (5.000, para medir a lista). Nunca entra no seed nem em migration, e
-- o script recusa banco que não seja local. Roda como o dono do banco local, numa transação só, e cria
-- tudo pelas funções atômicas (cadastrar_ativo, engatar, registrar_evento, entregar_ao_operacional,
-- receber e concluir transferência, registrar_baixa): os dados obedecem a todas as regras do banco.
-- As funções ficam em pg_temp (somem com a sessão).

create function pg_temp.renavam(p_n bigint) returns text language plpgsql as $$
declare
  v_prefixo text := lpad(p_n::text, 10, '0');
begin
  for v_dv in 0..9 loop
    if nucleo.renavam_valido(v_prefixo || v_dv::text) then
      return v_prefixo || v_dv::text;
    end if;
  end loop;
  raise exception 'sem dígito verificador para %', v_prefixo;
end;
$$;

create function pg_temp.cpf(p_n bigint) returns text language plpgsql as $$
declare
  v_base text := lpad(p_n::text, 9, '0');
begin
  for v_a in 0..9 loop
    for v_b in 0..9 loop
      if nucleo.documento_valido(v_base || v_a::text || v_b::text) then
        return v_base || v_a::text || v_b::text;
      end if;
    end loop;
  end loop;
  raise exception 'sem CPF para %', v_base;
end;
$$;

-- Placa Mercosul única para cada número: D + duas letras + dígito + letra + dois dígitos.
create function pg_temp.placa(p_n integer) returns text language sql immutable as $$
  select 'D' || chr(65 + (p_n / 26000) % 26) || chr(65 + (p_n / 676000) % 26)
      || (p_n % 10)::text || chr(65 + (p_n / 10) % 26) || lpad(((p_n / 260) % 100)::text, 2, '0')
$$;

-- A pessoa (gestor quando p_gestor), achada pelo CPF se já existe (o preparo dos e2e reaproveita).
create function pg_temp.pessoa(p_nome text, p_base bigint, p_gestor boolean) returns uuid language plpgsql as $$
declare
  v_documento text := pg_temp.cpf(p_base);
  v_pessoa uuid;
begin
  select pessoa_id into v_pessoa from nucleo.pessoa_documento where documento = v_documento;
  if v_pessoa is null then
    insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
    insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, v_documento);
  end if;
  if p_gestor then
    insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota') on conflict do nothing;
  end if;
  return v_pessoa;
end;
$$;

create function pg_temp.gerar_dados(p_quantidade integer) returns text language plpgsql as $$
declare
  v_base timestamptz := date_trunc('day', now()) - interval '240 days';
  v_gestores uuid[];
  v_operacoes uuid[];
  v_filiais uuid[];
  v_filiais_do_cr text[];
  v_modelos_cavalo uuid[];
  v_modelos_implemento uuid[];
  v_carrocerias uuid[];
  v_dolly_carroceria uuid;
  v_n integer := 0;        -- ativos criados (também numera placa, RENAVAM e CR)
  v_k integer := 0;        -- grupos criados
  v_cavalo uuid;
  v_t timestamptz;
  v_ids uuid[];
  v_gestor uuid;
  v_operacao uuid;
  v_carroceria uuid;
  v_eixos smallint;
  v_tipo nucleo.tipo_de_ativo;
  v_sigla text;
  v_transferencias integer := 0;
  v_baixas integer := 0;
  v_entregas integer := 0;
  v_id uuid;
  v_tr uuid;
begin
  if exists (select 1 from nucleo.placa_do_ativo where placa like 'D%' and excluido_em is null) then
    raise exception 'Os dados de desenvolvimento já existem: rode "pnpm exec supabase db reset" antes.';
  end if;

  -- Gestores: o primeiro é o do e2e (mesmo CPF do preparo dos testes, que o reaproveita).
  v_gestores := array[
    pg_temp.pessoa('Gestor de frota (e2e)', 910000003, true),
    pg_temp.pessoa('Ana Ribeiro', 920000001, true),
    pg_temp.pessoa('Bruno Costa', 920000002, true),
    pg_temp.pessoa('Carla Souza', 920000003, true),
    pg_temp.pessoa('Diego Martins', 920000004, true)
  ];
  -- O Operacional do e2e (o vínculo à filial é do preparo dos e2e do modo banco).
  perform pg_temp.pessoa('Operacional (e2e)', 910000004, false);

  insert into nucleo.operacao (nome)
  select o from unnest(array['Grãos Sorriso', 'Celulose Três Lagoas', 'Minério Carajás', 'Açúcar Piracicaba', 'Fertilizantes Paranaguá', 'Sem operação']) o
  on conflict do nothing;
  select array_agg(id order by nome) into v_operacoes from nucleo.operacao where excluido_em is null and nome <> 'Sem operação';

  insert into config.filial (nome)
  select f from unnest(array['Filial Sorriso', 'Filial Cordeirópolis', 'Filial Parauapebas']) f
  on conflict do nothing;
  select array_agg(id order by nome) into v_filiais from config.filial where excluido_em is null;
  select array_agg(codigo order by ordem) into v_filiais_do_cr from config.filial_do_cr;

  insert into config.marca (nome) select m from unnest(array['Scania', 'Volvo', 'Mercedes-Benz', 'Randon', 'Librelato']) m on conflict do nothing;
  insert into config.modelo (marca_id, nome)
  select (select id from config.marca where nome = x.marca), x.nome
    from (values ('Scania', 'R450'), ('Volvo', 'FH 540'), ('Mercedes-Benz', 'Actros 2651'),
                 ('Randon', 'Graneleiro 3 eixos'), ('Librelato', 'Bitrem 9 eixos')) as x (marca, nome)
  on conflict do nothing;
  select array_agg(id order by nome) into v_modelos_cavalo from config.modelo where nome in ('R450', 'FH 540', 'Actros 2651');
  select array_agg(id order by nome) into v_modelos_implemento from config.modelo where nome in ('Graneleiro 3 eixos', 'Bitrem 9 eixos');
  select array_agg(id order by nome) into v_carrocerias from config.carroceria where nome in ('Graneleira', 'Sider', 'Basculante') and excluido_em is null;

  -- CRs de serviço, cada um montado numa operação (sem o alerta "CR sem operação").
  insert into nucleo.cr (codcencus, codigo, nome, participa_da_frota)
  select 9000 + g, 'S' || g, 'Serviço ' || g, false from generate_series(1, 3) g;
  insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
  select c.id, v_operacoes[g], v_base, 'informada'
    from generate_series(1, 3) g join nucleo.cr c on c.codigo = 'S' || g;

  while v_n < p_quantidade loop
    v_k := v_k + 1;
    v_t := v_base + (v_k * interval '37 minutes');
    v_gestor := v_gestores[1 + v_k % array_length(v_gestores, 1)];
    v_operacao := v_operacoes[1 + v_k % array_length(v_operacoes, 1)];
    v_carroceria := v_carrocerias[1 + v_k % array_length(v_carrocerias, 1)];

    -- O cavalo (ou, a cada 8 grupos, um caminhão, um apoio e um equipamento soltos).
    if v_k % 8 = 7 then
      foreach v_tipo in array array['caminhao', 'apoio', 'equipamento']::nucleo.tipo_de_ativo[] loop
        v_n := v_n + 1;
        insert into nucleo.cr (codcencus, codigo, nome, participa_da_frota, veiculo_obrigatorio, filial_do_cr)
        values ((array[2, 4, 6])[1 + v_n % 3] * 1000000 + v_n, 'F' || v_n, 'Frota ' || v_n, true, true,
                v_filiais_do_cr[1 + v_n % array_length(v_filiais_do_cr, 1)]);
        v_id := nucleo.cadastrar_ativo(
          p_tipo => v_tipo,
          p_renavam => case when v_tipo = 'equipamento' then null else pg_temp.renavam(500000 + v_n) end,
          p_placa => pg_temp.placa(v_n),
          p_gestor_id => v_gestor,
          p_cr_id => (select id from nucleo.cr where codigo = 'F' || v_n),
          p_operacao_id => v_operacao,
          p_em => v_t + v_n * interval '1 second',
          p_numero_de_serie => case when v_tipo = 'equipamento' then 'SER' || v_n end,
          p_carroceria_id => case when v_tipo = 'caminhao' then v_carroceria end
        );
        -- Algumas impedidas (manutenção) e algumas vendidas.
        if v_tipo = 'caminhao' and v_k % 2 = 1 then
          perform nucleo.registrar_evento(v_id, 'MAN', v_t + interval '3 days');
        elsif v_tipo = 'apoio' and v_k % 3 = 1 then
          perform nucleo.registrar_baixa(v_id, 'VND', v_t + interval '20 days', 'Vendido (dados de desenvolvimento)');
          v_baixas := v_baixas + 1;
        end if;
      end loop;
      continue;
    end if;

    v_n := v_n + 1;
    insert into nucleo.cr (codcencus, codigo, nome, participa_da_frota, veiculo_obrigatorio, filial_do_cr)
    values ((array[2, 4, 6])[1 + v_n % 3] * 1000000 + v_n, 'F' || v_n, 'Frota ' || v_n, true, true,
            v_filiais_do_cr[1 + v_n % array_length(v_filiais_do_cr, 1)]);
    v_cavalo := nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(500000 + v_n), p_placa => pg_temp.placa(v_n),
      p_gestor_id => v_gestor, p_cr_id => (select id from nucleo.cr where codigo = 'F' || v_n),
      p_operacao_id => v_operacao, p_em => v_t,
      -- Um em cada nove cavalos fica com o modelo a definir.
      p_modelo_id => case when v_k % 9 = 0 then null else v_modelos_cavalo[1 + v_k % array_length(v_modelos_cavalo, 1)] end
    );

    -- Os implementos do conjunto, pela estrutura: simples, bi, bitrezão, rodo, sem nome definido ou solo.
    v_ids := '{}';
    for v_pos in 1..(case v_k % 6 when 0 then 1 when 1 then 2 when 2 then 2 when 3 then 3 when 4 then 2 else 0 end) loop
      v_n := v_n + 1;
      v_eixos := case v_k % 6 when 0 then 3 when 1 then 2 when 2 then 3 when 3 then 2 else 4 end;
      insert into nucleo.cr (codcencus, codigo, nome, participa_da_frota, veiculo_obrigatorio, filial_do_cr)
      values ((array[2, 4, 6])[1 + v_n % 3] * 1000000 + v_n, 'F' || v_n, 'Frota ' || v_n, true, true,
              v_filiais_do_cr[1 + v_n % array_length(v_filiais_do_cr, 1)]);
      v_ids := v_ids || nucleo.cadastrar_ativo(
        p_tipo => 'implemento', p_renavam => pg_temp.renavam(500000 + v_n), p_placa => pg_temp.placa(v_n),
        p_gestor_id => v_gestor, p_cr_id => (select id from nucleo.cr where codigo = 'F' || v_n),
        p_operacao_id => v_operacao, p_em => v_t + v_pos * interval '1 second',
        p_funcao => case when v_k % 6 = 3 and v_pos = 2 then 'dolly' else 'semirreboque' end::nucleo.funcao_do_implemento,
        p_carroceria_id => case when v_k % 6 = 3 and v_pos = 2 then null else v_carroceria end,
        p_eixos => v_eixos,
        p_modelo_id => case when v_k % 6 = 3 and v_pos = 2 then null else v_modelos_implemento[1 + v_k % 2] end
      );
    end loop;
    -- Todas as unidades no mesmo instante: o conjunto é conferido em cada instante (o rodotrem só é
    -- válido com os três engatados).
    for v_pos in 1..coalesce(array_length(v_ids, 1), 0) loop
      perform nucleo.engatar(v_cavalo, v_ids[v_pos], v_pos::smallint, v_t + interval '1 hour');
    end loop;

    -- A situação do cavalo (conjunto ou solo), e algumas entregas ao Operacional.
    if coalesce(array_length(v_ids, 1), 0) > 0 then
      v_sigla := (array['ETc', 'CAr', 'DEs', 'ACe', 'ADe', 'CAn', 'ETv', 'PÁT', 'PÁT'])[1 + v_k % 9];
    else
      v_sigla := (array['ETv', 'PÁT', 'PÁT', 'ALU'])[1 + v_k % 4];
    end if;
    if v_sigla <> 'PÁT' then
      perform nucleo.registrar_evento(v_cavalo, v_sigla, v_t + interval '2 days');
    end if;
    if v_sigla in ('PÁT', 'ETv') and v_k % 3 = 0 then
      perform nucleo.entregar_ao_operacional(
        v_cavalo, v_filiais[1 + v_k % array_length(v_filiais, 1)], v_t + interval '5 days',
        (select versao from nucleo.ativo where id = v_cavalo)
      );
      v_entregas := v_entregas + 1;
    end if;
    -- Impedidas: manutenção do conjunto, documento e sem motorista.
    if v_k % 13 = 0 and coalesce(array_length(v_ids, 1), 0) > 0 then
      perform nucleo.registrar_evento(v_cavalo, 'MAc', v_t + interval '7 days');
    elsif v_k % 17 = 0 then
      perform nucleo.registrar_evento(v_cavalo, 'DOC', v_t + interval '7 days');
    elsif v_k % 19 = 0 then
      perform nucleo.registrar_evento(v_cavalo, 'FOg', v_t + interval '7 days');
    end if;

    -- Transferências entre gestores: pendente, em conferência com pendência, ou concluída.
    if v_k % 10 = 4 then
      insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo, situacao)
      values (v_cavalo, v_gestor, v_gestores[1 + (v_k + 1) % array_length(v_gestores, 1)], 'Rebalanceamento da carteira', 'pendente')
      returning id into v_tr;
      v_transferencias := v_transferencias + 1;
      if v_k % 20 = 4 then
        insert into nucleo.transferencia_pendencia (transferencia_id, texto) values (v_tr, 'Conferir o pneu estepe');
        perform nucleo.receber_transferencia(v_tr, v_t + interval '10 days');
      elsif v_k % 30 = 14 then
        perform nucleo.receber_transferencia(v_tr, v_t + interval '10 days');
        perform nucleo.concluir_transferencia(v_tr, v_t + interval '11 days');
      end if;
    end if;
  end loop;

  return format('%s ativos em %s grupos; %s entregas ao Operacional, %s transferências, %s baixas.',
                v_n, v_k, v_entregas, v_transferencias, v_baixas);
end;
$$;
