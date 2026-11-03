#!/usr/bin/env node
// ============================================================================
// TEMPLATE DE SCRAPING & EXTRAÇÃO DE PRODUTOS VETERINÁRIOS
// Este script serve como base para coletar catálogos de bulários online
// (ex: Bulários de laboratórios como Zoetis, Ourofino, Vetnil, Ceva, Agener)
// ou processar PDFs / planilhas de fornecedores e convertê-los no padrão do sistema.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const raiz = path.resolve(__dirname, '..');

/**
 * Exemplo de estrutura que sua função de scraping deve retornar para cada produto:
 */
export function criarItemBulario({
  principioAtivo,
  nomeComercial,
  classeTerapeutica = 'clinica_geral',
  iconeVia = 'oral',
  especiesPermitidas = ['canina', 'felina'],
  especiesContraindicadas = [],
  motivoContraindicacao = null,
  riscoMdr1 = false,
  dosePadraoMgKg = 10,
  doseMinMgKg = 5,
  doseMaxMgKg = 15,
  frequenciaHoras = 12,
  duracaoDias = 7,
  condicaoAlimentar = 'com_alimento',
  apresentacoes = [],
  orientacoes = 'Administrar conforme prescrição médica veterinária.',
  palavrasChave = [],
}) {
  const slug = `${nomeComercial}-${principioAtivo}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    slug,
    principio_ativo: principioAtivo,
    nome_comercial_sugerido: nomeComercial,
    classe_terapeutica: classeTerapeutica,
    tipo_padrao: 'industrializado',
    icone_via: iconeVia,
    especies_permitidas: especiesPermitidas,
    especies_contraindicadas: especiesContraindicadas,
    motivo_contraindicacao_especie: motivoContraindicacao,
    risco_mdr1: riscoMdr1,
    dose_padrao_mg_kg: dosePadraoMgKg,
    dose_min_mg_kg: doseMinMgKg,
    dose_max_mg_kg: doseMaxMgKg,
    frequencia_horas_padrao: frequenciaHoras,
    duracao_dias_padrao: duracaoDias,
    condicao_alimentar: condicaoAlimentar,
    apresentacoes: apresentacoes.length > 0 ? apresentacoes : [{ rotulo: nomeComercial, forma: 'comprimido', divisivel: true }],
    orientacoes_padrao: orientacoes,
    palavras_chave: palavrasChave.length > 0 ? palavrasChave : [principioAtivo.toLowerCase(), nomeComercial.toLowerCase()],
    ativo: true,
  };
}

/**
 * Função de exemplo simulando a coleta de novos produtos
 */
async function coletarExemploScraping() {
  console.log('🔍 Executando coletor de bulário...');

  const produtosColetados = [
    criarItemBulario({
      principioAtivo: 'Simparic (Sarolaner)',
      nomeComercial: 'Simparic 20 mg',
      classeTerapeutica: 'antiparasitario_isoxazolina',
      iconeVia: 'oral',
      especiesPermitidas: ['canina'],
      especiesContraindicadas: ['felina'],
      motivoContraindicacao: 'Uso exclusivo em cães.',
      dosePadraoMgKg: 2.0,
      frequenciaHoras: 720, // 30 dias
      duracaoDias: 30,
      condicaoAlimentar: 'livre',
      apresentacoes: [
        { rotulo: 'Simparic 5 mg (1,3 a 2,5 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Simparic 10 mg (2,6 a 5 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Simparic 20 mg (5,1 a 10 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Simparic 40 mg (10,1 a 20 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Simparic 80 mg (20,1 a 40 kg)', forma: 'comprimido', divisivel: false },
      ],
      orientacoes: 'Administrar 1 comprimido mastigável mensalmente.',
      palavrasChave: ['pulga', 'carrapato', 'sarna', 'sarolaner', 'simparic'],
    }),
    criarItemBulario({
      principioAtivo: 'Bravecto (Fluralaner)',
      nomeComercial: 'Bravecto Cães',
      classeTerapeutica: 'antiparasitario_isoxazolina',
      iconeVia: 'oral',
      especiesPermitidas: ['canina'],
      dosePadraoMgKg: 25.0,
      frequenciaHoras: 2160, // 90 dias / 12 semanas
      duracaoDias: 90,
      condicaoAlimentar: 'com_alimento',
      apresentacoes: [
        { rotulo: 'Bravecto 112,5 mg (2 a 4,5 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Bravecto 250 mg (4,5 a 10 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Bravecto 500 mg (10 a 20 kg)', forma: 'comprimido', divisivel: false },
        { rotulo: 'Bravecto 1000 mg (20 a 40 kg)', forma: 'comprimido', divisivel: false },
      ],
      orientacoes: 'Administrar junto ou logo após uma refeição a cada 12 semanas.',
      palavrasChave: ['pulga', 'carrapato', 'bravecto', 'fluralaner'],
    }),
  ];

  const saidaJson = path.join(raiz, 'docs', 'scraped_bulario_exemplo.json');
  fs.writeFileSync(saidaJson, JSON.stringify(produtosColetados, null, 2), 'utf8');
  console.log(`✅ ${produtosColetados.length} produtos salvos em ${saidaJson}`);
  console.log(`💡 Para importar no sistema, use a rota "/bulario" ou execute:`);
  console.log(`   node scripts/importar-bulario-csv.mjs docs/scraped_bulario_exemplo.json`);
}

coletarExemploScraping();

