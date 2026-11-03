/**
 * Cupom térmico da senha (58 ou 80 mm). É HTML impresso pelo navegador, então serve qualquer
 * impressora térmica instalada no computador. Todo texto é escapado: um nome com < ou & não
 * quebra o cupom. Para imprimir sem a janela de confirmação, abra o navegador do totem com
 * `--kiosk --kiosk-printing` (ver a skill sistema-fila-presencial-dashboard).
 */

export interface DadosCupom {
  clinica: string;
  logoUrl?: string | null;
  rodape?: string;
  larguraMm?: number;
  senha: string;
  servico: string;
  tutor: string;
  pet?: string | null;
  prioridade: string;
  chegadaEm?: string;
}

const escapar = (valor: unknown) =>
  String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const ROTULO_PRIORIDADE_CUPOM: Record<string, string> = {
  normal: 'NORMAL',
  prioridade: 'PREFERENCIAL',
  emergencia: 'EMERGÊNCIA',
};

export function montarHtmlCupom(dados: DadosCupom): string {
  const largura = dados.larguraMm === 80 ? 80 : 58;
  const quando = dados.chegadaEm ? new Date(dados.chegadaEm) : new Date();
  const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(quando);
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(quando);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Senha ${escapar(dados.senha)}</title>
    <style>
      @page { margin: 0; size: auto; }
      body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; width: ${largura}mm; color: #000; background: #fff; text-align: center; }
      .cabecalho { font-size: 13px; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; }
      .meta { font-size: 11px; margin-bottom: 8px; display: flex; justify-content: space-between; }
      .caixa { border: 2px solid #000; padding: 8px 4px; margin: 10px 0; }
      .rotulo { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
      .numero { font-size: 38px; font-weight: 900; line-height: 1; margin-top: 4px; }
      .detalhes { font-size: 11px; text-align: left; margin: 10px 0; line-height: 1.4; }
      .detalhes div { margin-bottom: 3px; }
      .logo { display: block; max-width: 100%; max-height: 18mm; margin: 0 auto 6px; filter: grayscale(1) contrast(1.4); }
      .rodape { font-size: 10px; border-top: 1px dashed #000; padding-top: 6px; margin-top: 8px; }
    </style>
  </head>
  <body>
    ${dados.logoUrl ? `<img class="logo" src="${escapar(dados.logoUrl)}" alt="">` : ''}
    <div class="cabecalho">${escapar(dados.clinica || 'Clínica Veterinária')}</div>
    <div class="meta"><span>${data}</span><span>${hora}</span></div>
    <div class="caixa">
      <div class="rotulo">Sua senha</div>
      <div class="numero">${escapar(dados.senha)}</div>
    </div>
    <div class="detalhes">
      <div><strong>Serviço:</strong> ${escapar(dados.servico)}</div>
      <div><strong>Tutor:</strong> ${escapar(dados.tutor)}</div>
      ${dados.pet ? `<div><strong>Pet:</strong> ${escapar(dados.pet)}</div>` : ''}
      <div><strong>Prioridade:</strong> ${escapar(dados.prioridade)}</div>
    </div>
    <div class="rodape">${escapar(dados.rodape || 'Acompanhe pelo telão da sala de espera.')}</div>
    <script>
      window.onload = function () {
        window.print();
        setTimeout(function () { window.close(); }, 500);
      };
    </script>
  </body>
</html>`;
}

/** Abre o cupom para impressão. Se o navegador bloquear pop-ups, usa um iframe oculto. */
export function imprimirCupom(dados: DadosCupom): void {
  const html = montarHtmlCupom(dados);
  const janela = window.open('', '_blank', 'width=350,height=500');
  if (janela) {
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  window.setTimeout(() => iframe.remove(), 15_000);
}
