/**
 * Classificação e leitura dos grupos do WhatsApp (Uazapi).
 *
 * Grupos não têm cliente vinculado, então não dá para reaproveitar as tags de
 * `client_tags` (é assim que Clínica/Estética funciona nas conversas). A
 * separação aqui é feita pelo NOME do grupo, com as listas de palavras abaixo.
 *
 * As listas foram montadas a partir dos 120 grupos reais da instância e são
 * feitas para serem editadas: acrescentar uma palavra aqui reclassifica os
 * grupos na hora, sem migração nem alteração de banco.
 */
import { UazapiGroup } from '@/services/uazapi';

export type GrupoCategoria =  'clinica' | 'outros';

/** Normaliza para comparar sem acento e sem caixa. */
const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Casa a palavra no IN\u00cdCIO de uma palavra do nome, nunca no meio.
 *
 * Sem isso, termos curtos pegam qualquer coisa: `rx` casava com
 * "Eddie inte(rx)cardio" e `uti` casaria com "Curitiba". O casamento por
 * prefixo \u00e9 intencional \u2014 `veterinari` precisa pegar "veterin\u00e1rio" e
 * "veterin\u00e1rias".
 */
const criarPadrao = (palavra: string): RegExp =>
  new RegExp(`\\b${palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

const combina = (texto: string, palavras: string[]): boolean =>
  palavras.some((palavra) => criarPadrao(palavra).test(texto));

/** Clínica / hospital / diagnóstico — o lado assistencial. */
export const PALAVRAS_CLINICA = [
  'paciente',
  'internacao',
  'internado',
  'clinico',
  'clinica',
  'veterinari',
  'hospital',
  'hovet',
  'hvy',
  'cirurgia',
  'cirurgic',
  'boletim',
  'plantao',
  'plantonista',
  'uti',
  'plantonistas',
  'transfusao',
  'bypass',
  'linfoma',
  'nefrec',
  'gasometria',
  'usg',
  'rx',
  'eletro',
  'exame',
  'laudo',
  'diagnostico',
  'relatorio medico',
  'indicacoes cirurgicas',
];

/**
 * Categoria do grupo pelo nome. `outros` cobre fornecedor, financeiro e
 * administrativo (Agromarc, Comprovantes PIX, NF, Mercado Livre...), que não
 * são nem Clínica nem Estética e por isso não devem entrar em nenhum dos dois
 * filtros.
 */
export function categoriaDoGrupo(nome: string | undefined | null): GrupoCategoria {
  const texto = normalizar(nome || '');
  if (!texto.trim()) return 'outros';
  if (combina(texto, PALAVRAS_CLINICA)) return 'clinica';
  return 'outros';
}

export const ROTULO_CATEGORIA: Record<GrupoCategoria, string> = {

  clinica: 'Clínica',
  outros: 'Outros',
};

// ─── Leitura das capacidades que a Uazapi devolve ───

/**
 * Só admins podem enviar mensagem E não somos admin: qualquer tentativa de
 * responder por aqui vai falhar no WhatsApp.
 */
export function grupoSomenteLeitura(group: UazapiGroup | undefined): boolean {
  return !!group?.isAnnounce && !group.iAmAdmin;
}

/**
 * Mensagens temporárias ativas, em segundos (0 = desligado).
 *
 * Usa o timer, nunca o booleano `IsEphemeral` do servidor: ele vem `true` com
 * timer 0 em vários grupos (resquício de quando a opção foi ligada e depois
 * desligada). Dizer "mensagens somem" nesses casos seria mentira.
 */
export function timerMensagensTemporarias(group: UazapiGroup | undefined): number {
  return group?.disappearingTimer && group.disappearingTimer > 0 ? group.disappearingTimer : 0;
}

/** "90 dias", "7 dias", "24 horas" — a partir do timer em segundos. */
export function formatarTimerTemporario(segundos: number): string {
  if (segundos <= 0) return '';
  const dias = Math.round(segundos / 86_400);
  if (dias >= 1) return dias === 1 ? '24 horas' : `${dias} dias`;
  const horas = Math.round(segundos / 3_600);
  return horas === 1 ? '1 hora' : `${horas} horas`;
}
