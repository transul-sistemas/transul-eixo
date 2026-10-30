import { test } from "@playwright/test";
import { testesDeHidratacaoLenta } from "./apoio-hidratacao-lenta";

test.describe("painel de espiar: hidratação lenta (desktop)", () => {
  testesDeHidratacaoLenta();
});
