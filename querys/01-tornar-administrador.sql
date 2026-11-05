-- Torna Administrador do Eixo um login já cadastrado em Authentication → Users.
-- Rodar no SQL Editor do painel, DEPOIS do `supabase db push --include-seed` (precisa de nucleo e config).
-- Troque SEU-EMAIL (duas vezes) pelo e-mail do login. Cria a Pessoa de teste com um CPF de teste válido
-- e liga o login a ela com o perfil administrador. Pode rodar de novo: não duplica.
do $$
declare
  v_email text := lower('alexandre@transultransporte.com.br');
  v_documento text;
  v_pessoa uuid;
begin
  if not exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Nenhum login com o e-mail %: confira o cadastro em Authentication → Users.', v_email;
  end if;
  select '930000001' || a::text || b::text into v_documento
    from generate_series(0, 9) a, generate_series(0, 9) b
   where nucleo.documento_valido('930000001' || a::text || b::text)
   limit 1;
  select pessoa_id into v_pessoa from nucleo.pessoa_documento where documento = v_documento;
  if v_pessoa is null then
    insert into nucleo.pessoa (nome) values ('Administrador (teste)') returning id into v_pessoa;
    insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, v_documento);
  end if;
  perform nucleo.vincular_usuario(v_email, v_pessoa, 'administrador');
end $$;

-- Conferência: deve mostrar administrador e true.
select u.perfil, u.ativo
  from nucleo.usuario u
  join auth.users au on au.id = u.auth_user_id
 where lower(au.email) = lower('alexandre@transultransporte.com.br
');
