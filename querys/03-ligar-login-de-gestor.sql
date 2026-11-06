-- Liga o login de um gestor de frota (já criado em Authentication → Users) à Pessoa dele, com o perfil
-- "Gestor de frota". Os gestores entraram pela carga inicial da v1 (06/11/2026) como Pessoas sem login
-- e sem CPF (com a marca de cadastro pendente e a exceção "pessoa sem documento" na fila).
--
-- Antes de rodar:
--   1. Em Authentication → Users → Add user → Create new user: o e-mail do gestor, uma senha provisória de
--      12 caracteres ou mais e "Auto Confirm User" marcado. O gestor troca a senha em "Esqueci a senha".
--   2. Troque EMAIL-DO-GESTOR e NOME-DO-GESTOR abaixo (o nome exatamente como ficou na Pessoa). Os
--      valores ficam no arquivo da importacao/ (fora do Git), nunca neste arquivo.
-- Pode rodar de novo: não duplica (o vínculo é atualizado).
do $$
declare
  v_email text := lower(btrim('EMAIL-DO-GESTOR'));
  v_nome text := btrim('NOME-DO-GESTOR');
  v_pessoa uuid;
  v_quantas int;
begin
  if not exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Nenhum login com este e-mail: crie o usuário em Authentication → Users primeiro.';
  end if;
  select count(*), min(p.id::text)::uuid into v_quantas, v_pessoa
    from nucleo.pessoa p
    join nucleo.papel_da_pessoa pp on pp.pessoa_id = p.id and pp.papel = 'gestor_de_frota'
   where p.nome = v_nome and p.excluido_em is null;
  if v_quantas = 0 then
    raise exception 'Nenhuma Pessoa com este nome e o papel de gestor de frota: confira o nome.';
  elsif v_quantas > 1 then
    raise exception 'Há % Pessoas com este nome e o papel de gestor de frota: ligue pelo id da Pessoa.', v_quantas;
  end if;
  perform nucleo.vincular_usuario(v_email, v_pessoa, 'gestor_de_frota');
end $$;

-- Conferência: deve mostrar gestor_de_frota e true.
select u.perfil, u.ativo
  from nucleo.usuario u
  join auth.users au on au.id = u.auth_user_id
 where lower(au.email) = lower(btrim('EMAIL-DO-GESTOR'));
