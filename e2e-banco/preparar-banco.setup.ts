import { test as preparar } from "@playwright/test";
import { comBanco, emailDe } from "../e2e/apoio/usuarios-de-teste";

// O Operacional do e2e passa a atender a filial que recebeu as entregas dos dados de desenvolvimento
// (o escopo por filial). Como no Studio: pelo dono do banco LOCAL.
preparar("o Operacional atende a filial das entregas", async () => {
  await comBanco((banco) =>
    banco.query(
      `insert into nucleo.usuario_filial (usuario_id, filial_id)
       select u.pessoa_id, c.filial_id
         from nucleo.usuario u
         join auth.users au on au.id = u.auth_user_id and au.email = $1
         cross join lateral (
           select filial_id from nucleo.custodia
            where com_quem = 'operacional' and excluido_em is null and fim is null
            group by filial_id order by count(*) desc limit 1
         ) c
       on conflict do nothing`,
      [emailDe("operacional")],
    ),
  );
});
