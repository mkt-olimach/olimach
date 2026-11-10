/** Remove tudo que nao for digito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida CPF (11 digitos, digitos verificadores, sem sequencias repetidas). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const check = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

/** Mascara no formato ***.456.789-** (mesmo formato do RPC de validacao publica). */
export function maskCpf(value: string): string {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return "***.***.***-**";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
