/**
 * Ferramenta grava_info: o assistente grava dados do cadastro do cliente logo que ele os informa.
 * Somente campos da lista abaixo são aceitos, sempre limitados ao cadastro da conversa atual.
 */
import { emailValido } from './agenda_agendamento.ts';

export const CAMPOS_CADASTRO = ['nome', 'nome_pet', 'porte_pet', 'raca_pet', 'email', 'servico'] as const;
export type CampoCadastro = (typeof CAMPOS_CADASTRO)[number];

const LIMITES: Record<CampoCadastro, number> = { nome: 120, nome_pet: 200, porte_pet: 40, raca_pet: 80, email: 254, servico: 120 };

export function ferramentaGravaInfo() {
  return {
    type: 'function',
    function: {
      name: 'grava_info',
      description:
        'Grava no cadastro do cliente os dados que ele informar. Acione assim que receber cada dado (nome do tutor, nome/raça/porte do pet, e-mail, serviço de interesse).',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string', description: 'Nome do cliente/tutor.' },
          nome_pet: { type: 'string', description: 'Nome do pet (cachorro, gato ou outra espécie).' },
          porte_pet: { type: 'string', description: 'Porte do pet: mini, pequeno, médio, grande ou gigante.' },
          raca_pet: { type: 'string', description: 'Raça do pet.' },
          email: { type: 'string', description: 'E-mail do cliente (contém @ e domínio).' },
          servico: { type: 'string', description: 'Serviço de interesse mencionado.' },
        },
        additionalProperties: false,
      },
    },
  };
}

export interface CadastroSaneado {
  valores: Partial<Record<CampoCadastro, string>>;
  rejeitados: Array<{ campo: string; motivo: string }>;
}

export function sanearCadastro(entrada: Record<string, unknown>): CadastroSaneado {
  const valores: Partial<Record<CampoCadastro, string>> = {};
  const rejeitados: CadastroSaneado['rejeitados'] = [];
  for (const [campo, bruto] of Object.entries(entrada ?? {})) {
    if (!(CAMPOS_CADASTRO as readonly string[]).includes(campo)) {
      rejeitados.push({ campo, motivo: 'campo_nao_permitido' });
      continue;
    }
    if (typeof bruto !== 'string') continue;
    const valor = bruto.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIMITES[campo as CampoCadastro]);
    if (!valor) continue;
    if (campo === 'email' && !emailValido(valor)) {
      rejeitados.push({ campo, motivo: 'email_invalido' });
      continue;
    }
    valores[campo as CampoCadastro] = campo === 'email' ? valor.toLowerCase() : valor;
  }
  return { valores, rejeitados };
}
