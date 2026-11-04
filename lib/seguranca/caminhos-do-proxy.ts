// Os caminhos que passam pelo proxy: tudo, menos os arquivos estáticos. O texto vai no `matcher` do
// proxy.ts (o Next exige um literal lá; o teste confere que é este) e a expressão é usada nos testes.

export const CAMINHOS_DO_PROXY_TEXTO =
  "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)";

export const CAMINHOS_DO_PROXY = new RegExp(`^${CAMINHOS_DO_PROXY_TEXTO}$`);
