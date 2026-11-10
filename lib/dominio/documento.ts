// O CPF na tela: a mesma regra do banco (nucleo.documento_valido), para o assistente avisar antes de
// enviar. O banco confere de novo e é quem garante a chave única.

/** Só os dígitos do texto digitado. */
export function digitosDoCpf(texto: string): string {
  return texto.replace(/\D/g, "");
}

function digitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) soma += Number(digitos[i]) * (pesoInicial - i);
  return ((soma * 10) % 11) % 10;
}

/** CPF com 11 dígitos, não todos iguais, e os dois dígitos verificadores certos. */
export function cpfValido(texto: string): boolean {
  const v = digitosDoCpf(texto);
  if (v.length !== 11 || /^(\d)\1+$/.test(v)) return false;
  return (
    digitoVerificador(v.slice(0, 9), 10) === Number(v[9]) &&
    digitoVerificador(v.slice(0, 10), 11) === Number(v[10])
  );
}

/** O CPF com pontos e traço enquanto a pessoa digita (até 11 dígitos). */
export function mascararCpfDigitado(texto: string): string {
  const v = digitosDoCpf(texto).slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
  if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
}
