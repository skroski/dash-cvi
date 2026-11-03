/**
 * Formatação e divisão das respostas para o WhatsApp (substitui o "Parser" LLM do n8n):
 * converte Markdown comum para a sintaxe do WhatsApp e divide o texto em mensagens
 * naturais — um parágrafo por mensagem, juntando os muito curtos e quebrando os muito longos.
 */

export function formatarParaWhatsApp(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    // [texto](url) -> url (o WhatsApp só entende o link puro)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, rotulo: string, url: string) => (rotulo.trim() === url ? url : `${rotulo} ${url}`))
    // **negrito** e __negrito__ -> *negrito*
    .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
    .replace(/__([^_\n]+?)__/g, '*$1*')
    // títulos markdown viram negrito
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // listas "- item" e "* item" viram "• item"
    .replace(/^[ \t]*[-*]\s+(?=\S)/gm, '• ')
    // `código` -> código
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Quebra um parágrafo grande em frases sem passar de `limite`. */
function quebrarLongo(paragrafo: string, limite: number): string[] {
  if (paragrafo.length <= limite) return [paragrafo];
  const partes: string[] = [];
  let atual = '';
  for (const frase of paragrafo.split(/(?<=[.!?…])\s+|\n/)) {
    if (!frase) continue;
    if ((atual + ' ' + frase).trim().length > limite && atual) {
      partes.push(atual.trim());
      atual = frase;
    } else {
      atual = `${atual} ${frase}`.trim();
    }
  }
  if (atual) partes.push(atual.trim());
  // Frase única maior que o limite: corta em palavras.
  return partes.flatMap((parte) => {
    if (parte.length <= limite) return [parte];
    const palavras = parte.split(/\s+/);
    const blocos: string[] = [];
    let bloco = '';
    for (const palavra of palavras) {
      if ((bloco + ' ' + palavra).trim().length > limite && bloco) {
        blocos.push(bloco);
        bloco = palavra;
      } else {
        bloco = `${bloco} ${palavra}`.trim();
      }
    }
    if (bloco) blocos.push(bloco);
    return blocos;
  });
}

/** Mensagens a enviar, em ordem. Nunca devolve mensagem vazia. */
export function dividirMensagens(texto: string, opcoes: { maxCaracteres?: number; minCaracteres?: number; maxMensagens?: number } = {}): string[] {
  const limite = Math.max(200, opcoes.maxCaracteres ?? 700);
  const minimo = Math.max(0, opcoes.minCaracteres ?? 40);
  const maxMensagens = Math.max(1, opcoes.maxMensagens ?? 8);
  const paragrafos = formatarParaWhatsApp(texto).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const mensagens: string[] = [];
  for (const paragrafo of paragrafos) {
    for (const parte of quebrarLongo(paragrafo, limite)) {
      const anterior = mensagens.at(-1);
      // Parágrafo muito curto (ex.: uma saudação) vai junto do anterior para não virar uma mensagem solta.
      if (anterior !== undefined && parte.length < minimo && anterior.length + parte.length + 2 <= limite) {
        mensagens[mensagens.length - 1] = `${anterior}\n\n${parte}`;
      } else {
        mensagens.push(parte);
      }
    }
  }
  // Excesso de mensagens: junta o fim numa só (nunca descarta conteúdo).
  if (mensagens.length > maxMensagens) {
    const resto = mensagens.splice(maxMensagens - 1);
    mensagens.push(resto.join('\n\n'));
  }
  return mensagens;
}
