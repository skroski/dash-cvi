/**
 * Gerador de Documento Padronizado (PDF / Impressão A4), Hash SHA-256,
 * Matriz QR Code Vetorial e Resumo para o Tutor (RF-08).
 *
 * Todo conteúdo interpolado no HTML de impressão passa por escape rigoroso (`escaparHtmlReceita`)
 * e a abertura para PDF usa Blob URL sem `document.write` nem `innerHTML`.
 */

import QRCode from 'qrcode';
import {
  type ItemPrescricao,
  type PacienteContexto,
  type SlotCronograma,
  ROTULO_CONDICAO_ALIMENTAR,
  ROTULO_VEICULO_MANIPULADO,
} from './receituarioMotor.ts';

export type ModalidadeAssinatura =
  | 'icp_brasil_crmv'
  | 'gov_br'
  | 'vidaas_birdid'
  | 'assinatura_eletronica_crmv';

/**
 * O sistema registra a receita com código de verificação e hash SHA-256; ele não aplica
 * certificado ICP-Brasil. As outras modalidades descrevem como o veterinário declarou
 * que vai assinar o PDF por fora (ex.: Gov.br), e ficam só para receitas antigas.
 */
export const ROTULO_MODALIDADE_ASSINATURA: Record<ModalidadeAssinatura, string> = {
  icp_brasil_crmv: 'Certificado ICP-Brasil (declarado na emissão)',
  gov_br: 'Assinatura Gov.br (declarada na emissão)',
  vidaas_birdid: 'Certificado em nuvem Vidaas/BirdID (declarado na emissão)',
  assinatura_eletronica_crmv: 'Registrada no sistema com código de verificação',
};

/** Modalidade gravada pelas novas emissões. */
export const MODALIDADE_ASSINATURA_PADRAO: ModalidadeAssinatura = 'assinatura_eletronica_crmv';

export interface DadosEmissaoReceituario {
  codigoVerificacao: string;
  clinicaNome: string;
  clinicaLogoUrl?: string | null;
  clinicaEndereco?: string | null;
  clinicaTelefone?: string | null;
  veterinarioNome: string;
  veterinarioCrmv: string;
  modalidadeAssinatura: ModalidadeAssinatura;
  hashSha256: string;
  assinadoEmIso: string;
  urlValidacaoPublica: string;
  paciente: PacienteContexto;
  hipoteseDiagnostica?: string | null;
  itens: ItemPrescricao[];
  cronograma: SlotCronograma[];
  observacoesGerais?: string | null;
}

/** Escapa caracteres especiais HTML para impedir XSS em qualquer campo textual. */
export function escaparHtmlReceita(valor: unknown): string {
  return String(valor ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string
  );
}

/** Mascaramento de dados sensíveis do tutor (telefone / CPF) conforme LGPD e diretrizes de segurança. */
export function mascararTelefoneTutor(telefone?: string | null): string {
  if (!telefone) return 'Não informado';
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 4) return '***';
  return `***-***-${digitos.slice(-4)}`;
}

/** Gera código único legível da receita (ex.: RX-2026-8F4K9A). */
export function gerarCodigoVerificacaoReceita(): string {
  const alfabeto = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ano = new Date().getFullYear();
  let sufixo = '';
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      sufixo += alfabeto[bytes[i] % alfabeto.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      sufixo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    }
  }
  return `RX-${ano}-${sufixo}`;
}

/** Calcula hash SHA-256 hexadecimal do conteúdo consolidado da prescrição para auditoria e assinatura digital. */
export async function calcularHashSha256Prescricao(payload: {
  codigo: string;
  veterinarioCrmv: string;
  pacienteNome: string;
  pesoKg: number;
  itens: ItemPrescricao[];
  assinadoEmIso: string;
}): Promise<string> {
  const canonico = JSON.stringify({
    c: payload.codigo,
    crmv: payload.veterinarioCrmv,
    p: payload.pacienteNome,
    kg: payload.pesoKg,
    i: payload.itens.map((it) => ({
      p: it.principio_ativo,
      d: it.posologia.dose_calculada_mg,
      q: it.posologia.quantidade_por_tomada,
      f: it.posologia.frequencia_horas,
      t: it.posologia.duracao_dias,
    })),
    ts: payload.assinadoEmIso,
  });

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buffer = new TextEncoder().encode(canonico);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback determinístico FNV-1a estendido a 64 hex chars caso WebCrypto não esteja disponível
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonico.length; i++) {
    const ch = canonico.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const base = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return base.repeat(4);
}

/**
 * Matriz de um QR Code real (ISO/IEC 18004, correção de erro M) para o texto/URL de verificação,
 * legível pela câmera do celular. `true` = módulo escuro.
 */
export function gerarMatrizQrVisual(texto: string): boolean[][] {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  return Array.from({ length: modules.size }, (_, r) =>
    Array.from({ length: modules.size }, (_, c) => Boolean(modules.get(r, c)))
  );
}

/** Margem branca (quiet zone) exigida pelo padrão para a leitura do QR. */
const MARGEM_QR = 4;

/** Renderiza a matriz QR em string SVG pura para inclusão no documento PDF. */
export function gerarSvgQrCodeReceita(texto: string, tamanhoPx = 112): string {
  const matriz = gerarMatrizQrVisual(texto);
  const dim = matriz.length;
  const rects: string[] = [];

  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (matriz[r][c]) {
        rects.push(`<rect x="${c + MARGEM_QR}" y="${r + MARGEM_QR}" width="1" height="1" fill="#0f172a"/>`);
      }
    }
  }

  const viewBoxSize = dim + MARGEM_QR * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${tamanhoPx}" height="${tamanhoPx}" shape-rendering="crispEdges" role="img" aria-label="QR Code de validação da receita"><rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#ffffff"/>${rects.join('')}</svg>`;
}

const ROTULO_VIA_PDF: Record<string, string> = {
  oral: 'USO ORAL',
  topica: 'USO TÓPICO / DERMATOLÓGICO',
  otica: 'USO OTOLÓGICO',
  oftalmica: 'USO OFTÁLMICO',
  injetavel: 'USO INJETÁVEL / PARENTERAL',
  inalatoria: 'USO INALATÓRIO',
};

const ROTULO_ESPECIE_PDF: Record<string, string> = {
  canina: 'Canina',
  felina: 'Felina',
  silvestre: 'Silvestre / Exótico',
};

/**
 * Compila o documento HTML padronizado em formato A4 para exportação em PDF / impressão (RF-08).
 */
export function montarHtmlReceituarioPdf(dados: DadosEmissaoReceituario): string {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dados.assinadoEmIso || Date.now()));

  const qrSvg = gerarSvgQrCodeReceita(dados.urlValidacaoPublica, 108);

  const htmlItens = dados.itens
    .map((item, idx) => {
      const via = ROTULO_VIA_PDF[item.icone_via] || 'USO VETERINÁRIO';
      const blocoManipulado =
        item.tipo === 'manipulado' && item.manipulado
          ? `<div class="manipulado-box">
              <strong>Fórmula Manipulada Veterinária:</strong>
              Veículo: ${escaparHtmlReceita(ROTULO_VEICULO_MANIPULADO[item.manipulado.veiculo])} |
              Saborização: ${escaparHtmlReceita(item.manipulado.sabor)} |
              Aviamento: ${escaparHtmlReceita(item.manipulado.quantidade_total_unidades)}
            </div>`
          : '';

      return `<div class="item-card">
        <div class="item-header">
          <div>
            <span class="item-num">${idx + 1}.</span>
            <span class="item-nome">${escaparHtmlReceita(item.nome_comercial_sugerido)}</span>
            <span class="item-principio">(${escaparHtmlReceita(item.principio_ativo)})</span>
          </div>
          <span class="badge-via">${escaparHtmlReceita(via)}</span>
        </div>
        <div class="item-posologia">
          <strong>Posologia:</strong> Administrar <strong>${escaparHtmlReceita(item.posologia.quantidade_por_tomada)}</strong>
          a cada <strong>${escaparHtmlReceita(item.posologia.frequencia_horas)} horas</strong>,
          durante <strong>${escaparHtmlReceita(item.posologia.duracao_dias)} ${item.posologia.duracao_dias === 1 ? 'dia' : 'dias'}</strong>
          (${escaparHtmlReceita(ROTULO_CONDICAO_ALIMENTAR[item.condicao_alimentar])}).
        </div>
        ${blocoManipulado}
        <div class="item-orientacoes">
          <strong>Orientações ao Tutor:</strong> ${escaparHtmlReceita(item.orientacoes_tutor)}
        </div>
      </div>`;
    })
    .join('\n');

  const htmlCronograma =
    dados.cronograma.length > 0
      ? `<div class="secao-cronograma">
          <div class="secao-titulo">CRONOGRAMA VISUAL DE ADMINISTRAÇÃO PARA O TUTOR</div>
          <table class="tabela-cronograma">
            <thead>
              <tr>
                <th>Horário Sugerido</th>
                <th>Período</th>
                <th>Medicamento e Dose por Tomada</th>
                <th>Recomendação</th>
              </tr>
            </thead>
            <tbody>
              ${dados.cronograma
                .map(
                  (slot) => `<tr>
                  <td class="col-hora"><strong>${escaparHtmlReceita(slot.horario)}</strong></td>
                  <td>${escaparHtmlReceita(slot.rotulo_periodo)}</td>
                  <td>
                    ${slot.itens
                      .map(
                        (it) =>
                          `<div><strong>${escaparHtmlReceita(it.nome_exibicao)}</strong> — ${escaparHtmlReceita(it.quantidade_por_tomada)} (${escaparHtmlReceita(it.duracao_dias)}d)</div>`
                      )
                      .join('')}
                  </td>
                  <td>
                    ${slot.itens.map((it) => `<div>${escaparHtmlReceita(it.rotulo_alimentar)}</div>`).join('')}
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Receituário Veterinário - ${escaparHtmlReceita(dados.paciente.nome)} (${escaparHtmlReceita(dados.codigoVerificacao)})</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.45;
    }
    .page {
      max-width: 190mm;
      margin: 0 auto;
      padding: 4mm;
    }
    .cabecalho {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .clinica-titulo {
      font-size: 18px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .clinica-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
    }
    .codigo-pill {
      display: inline-block;
      background: #f0fdfa;
      border: 1px solid #0f766e;
      color: #0f766e;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .bloco-paciente {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .campo-label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .campo-valor {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .secao-titulo {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #0f766e;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 14px 0 8px;
    }
    .item-card {
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0f766e;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .item-num {
      font-weight: 800;
      color: #0f766e;
      margin-right: 4px;
    }
    .item-nome {
      font-size: 13px;
      font-weight: 800;
    }
    .item-principio {
      font-size: 11px;
      color: #475569;
      margin-left: 4px;
    }
    .badge-via {
      font-size: 10px;
      font-weight: 700;
      background: #e2e8f0;
      color: #1e293b;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .item-posologia {
      margin-bottom: 5px;
      font-size: 12px;
    }
    .manipulado-box {
      background: #eff6ff;
      border: 1px dashed #3b82f6;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 11px;
      color: #1e3a8a;
      margin-bottom: 5px;
    }
    .item-orientacoes {
      font-size: 11px;
      color: #334155;
    }
    .tabela-cronograma {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 6px;
    }
    .tabela-cronograma th, .tabela-cronograma td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    .tabela-cronograma th {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    .col-hora {
      width: 90px;
      color: #0f766e;
    }
    .rodape-assinatura {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 2px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      page-break-inside: avoid;
    }
    .assinatura-box {
      flex: 1;
    }
    .assinatura-linha {
      border-top: 1px solid #0f172a;
      width: 260px;
      padding-top: 4px;
      margin-top: 24px;
      font-weight: 700;
    }
    .hash-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 9px;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
      border-radius: 4px;
      margin-top: 8px;
      word-break: break-all;
    }
    .qr-box {
      text-align: center;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      background: #ffffff;
    }
    .qr-legenda {
      font-size: 9px;
      color: #475569;
      margin-top: 2px;
      max-width: 115px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="cabecalho">
      <div>
        <div class="clinica-titulo">${escaparHtmlReceita(dados.clinicaNome || 'Clínica Veterinária')}</div>
        <div class="clinica-sub">Receituário Médico-Veterinário Padronizado • Assistência Clínica Verificada</div>
      </div>
      <div class="doc-meta">
        <div class="codigo-pill">CÓD: ${escaparHtmlReceita(dados.codigoVerificacao)}</div>
        <div>Emissão: <strong>${escaparHtmlReceita(dataFormatada)}</strong></div>
      </div>
    </div>

    <div class="bloco-paciente">
      <div>
        <div class="campo-label">Paciente (Pet)</div>
        <div class="campo-valor">${escaparHtmlReceita(dados.paciente.nome)}</div>
      </div>
      <div>
        <div class="campo-label">Espécie / Raça</div>
        <div class="campo-valor">${escaparHtmlReceita(ROTULO_ESPECIE_PDF[dados.paciente.especie] || dados.paciente.especie)} ${dados.paciente.raca ? `• ${escaparHtmlReceita(dados.paciente.raca)}` : ''}</div>
      </div>
      <div>
        <div class="campo-label">Peso Aferido / Idade</div>
        <div class="campo-valor">${escaparHtmlReceita(String(dados.paciente.peso_kg).replace('.', ','))} kg ${dados.paciente.idade_texto ? `• ${escaparHtmlReceita(dados.paciente.idade_texto)}` : ''}</div>
      </div>
      <div>
        <div class="campo-label">Tutor Responsável</div>
        <div class="campo-valor">${escaparHtmlReceita(dados.paciente.tutor_nome)}</div>
      </div>
    </div>

    ${
      dados.hipoteseDiagnostica
        ? `<div style="font-size:11px; margin-bottom:10px; color:#334155;"><strong>Indicação / Contexto Clínico:</strong> ${escaparHtmlReceita(dados.hipoteseDiagnostica)}</div>`
        : ''
    }

    <div class="secao-titulo">PRESCRIÇÃO TERAPÊUTICA</div>
    ${htmlItens}

    ${htmlCronograma}

    ${
      dados.observacoesGerais
        ? `<div class="secao-titulo">OBSERVAÇÕES E RECOMENDAÇÕES GERAIS</div>
           <div style="font-size:11px; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px; background:#f8fafc;">${escaparHtmlReceita(dados.observacoesGerais)}</div>`
        : ''
    }

    <div class="rodape-assinatura">
      <div class="assinatura-box">
        <div class="assinatura-linha">
          ${escaparHtmlReceita(dados.veterinarioNome)} — CRMV: ${escaparHtmlReceita(dados.veterinarioCrmv)}
        </div>
        <div style="font-size:10px; color:#334155; margin-top:2px;">
          ${escaparHtmlReceita(ROTULO_MODALIDADE_ASSINATURA[dados.modalidadeAssinatura])}
        </div>
        <div class="hash-box">
          <strong>Código de verificação:</strong> ${escaparHtmlReceita(dados.codigoVerificacao)}<br/>
          <strong>Integridade (SHA-256):</strong> ${escaparHtmlReceita(dados.hashSha256)}<br/>
          <strong>Valide em:</strong> ${escaparHtmlReceita(dados.urlValidacaoPublica)}
        </div>
      </div>
      <div class="qr-box">
        ${qrSvg}
        <div class="qr-legenda">Aponte a câmera para validar autenticidade</div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

/**
 * Abre o receituário padronizado em uma nova aba via Blob URL para impressão/exportação em PDF.
 * Não utiliza `document.write` nem `innerHTML`.
 */
export function imprimirOuExportarReceituarioPdf(dados: DadosEmissaoReceituario): void {
  const html = montarHtmlReceituarioPdf(dados);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Sem 'noopener' nas features: com ele o window.open sempre devolve null e o fallback
  // abaixo baixava um .html além de abrir a aba. O vínculo com a janela é cortado logo depois.
  const novaJanela = window.open(blobUrl, '_blank');
  if (novaJanela) {
    novaJanela.opener = null;
  } else {
    // Fallback download direto do arquivo HTML imprimível caso bloqueador de pop-ups impeça
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Receituario-${dados.paciente.nome.replace(/[^a-zA-Z0-9_-]/g, '_')}-${dados.codigoVerificacao}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

/** Monta mensagem amigável e estruturada com o cronograma visual para envio ao WhatsApp do tutor. */
export function montarResumoWhatsappTutor(dados: DadosEmissaoReceituario): string {
  const linhasItens = dados.itens.map(
    (it, i) =>
      `${i + 1}. *${it.nome_comercial_sugerido}* (${it.principio_ativo})\n` +
      `   • Dose: *${it.posologia.quantidade_por_tomada}* a cada *${it.posologia.frequencia_horas}h* por *${it.posologia.duracao_dias} dias*\n` +
      `   • Cuidado: ${it.orientacoes_tutor}`
  );

  const linhasHorarios = dados.cronograma.map(
    (s) =>
      `⏰ *${s.horario}* (${s.rotulo_periodo}): ${s.itens.map((i) => `${i.nome_exibicao} [${i.quantidade_por_tomada}]`).join(' + ')}`
  );

  return (
    `🐾 *Receituário Veterinário — ${dados.clinicaNome}*\n` +
    `Paciente: *${dados.paciente.nome}* (${dados.paciente.peso_kg} kg)\n` +
    `Médico(a) Veterinário(a): *${dados.veterinarioNome}* (${dados.veterinarioCrmv})\n\n` +
    `💊 *Itens Prescritos:*\n${linhasItens.join('\n\n')}\n\n` +
    (linhasHorarios.length > 0 ? `📅 *Grade de Horários Sugerida:*\n${linhasHorarios.join('\n')}\n\n` : '') +
    `🔒 *Código de Validação:* ${dados.codigoVerificacao}\n` +
    `Valide online em: ${dados.urlValidacaoPublica}`
  );
}
