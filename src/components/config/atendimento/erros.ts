export function mensagemErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro) return String((erro as { message: unknown }).message);
  return 'Tente novamente.';
}
