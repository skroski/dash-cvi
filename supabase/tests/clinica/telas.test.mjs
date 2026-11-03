// Renderiza no servidor (SSR) as telas de configuração com a configuração completa e com o formato ANTIGO
// do banco (migração 20261027 ainda não aplicada): nenhuma pode quebrar ao abrir.
//   node --test supabase/tests/clinica/telas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const saida = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'telas-')), 'telas.mjs');

await build({
  stdin: {
    resolveDir: raiz, loader: 'tsx', sourcefile: 'telas-entrada.tsx',
    contents: `
      import { renderToString } from 'react-dom/server';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import { MemoryRouter } from 'react-router-dom';
      import { EmpresaCard } from '@/components/config/atendimento/EmpresaCard';
      import { ImplantacaoCard } from '@/components/config/atendimento/ImplantacaoCard';
      import { ServicosCard } from '@/components/config/atendimento/ServicosCard';
      import { HorarioFuncionamentoEditor } from '@/components/config/atendimento/HorarioFuncionamentoEditor';
      import { TipoAgendaEditor } from '@/components/config/agenda/TipoAgendaEditor';
      import { RegraAgendaEditor } from '@/components/config/agenda/RegraAgendaEditor';
      import { FeriadosCard } from '@/components/config/agenda/FeriadosCard';
      import { AgendamentosAssistenteCard } from '@/components/config/agenda/AgendamentosAssistenteCard';
      import { normalizarConfig } from '@/lib/configAtendimento';
      export { normalizarConfig };
      const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const comProvedores = (el) => (
        <QueryClientProvider client={cliente()}><MemoryRouter>{el}</MemoryRouter></QueryClientProvider>
      );
      const nada = async () => undefined;
      export const telas = {
        empresa: (config) => renderToString(<EmpresaCard config={config} salvando={false} onSalvar={nada} />),
        implantacao: (config, servicos = []) => renderToString(comProvedores(
          <ImplantacaoCard config={config} servicos={servicos} destinatarios={[]} tipos={[]} onAbrirAba={() => undefined} />,
        )),
        servicos: (servicos, disponivel = true) => renderToString(
          <ServicosCard servicos={servicos} tipos={[{ id: 't1', chave: 'consulta', nome: 'Consulta', ativo: true }]} disponivel={disponivel} onSalvar={nada} onRemover={nada} />,
        ),
        horario: (valor) => renderToString(<HorarioFuncionamentoEditor valor={valor} onChange={() => undefined} />),
        tipo: (tipo) => renderToString(
          <TipoAgendaEditor tipo={tipo} regras={[{ id: 'r1', especialidade_id: tipo.id, profissional: { nome: 'Dra. Ana' } }]}
            janelas={[{ id: 'j1', regra_id: 'r1', dia_semana: 1, inicio: '09:00:00', fim: '18:00:00', ultimo_inicio: null }]} intervalos={[]}
            servicos={[{ id: 's1', nome: 'Consulta', preco: 120, tipo_agenda_id: tipo.id, ativo: true }]} tags={[{ id: 1, nome: 'Agendou' }]} onSalvar={nada} />,
        ),
        regra: (regra, tipo) => renderToString(<RegraAgendaEditor regra={regra} tipo={tipo} onSalvar={nada} />),
        feriados: (disponivel) => renderToString(
          <FeriadosCard feriados={[{ id: 'f1', data: '2999-12-25', descricao: 'Natal', dia_inteiro: true, inicio: null, fim: null, regra_id: null }]}
            agendas={[{ id: 'r1', nome: 'Dra. Ana · Consulta' }]} disponivel={disponivel} onCriar={nada} onRemover={nada} />,
        ),
        agendamentos: () => renderToString(comProvedores(<AgendamentosAssistenteCard />)),
      };
    `,
  },
  bundle: true, format: 'esm', platform: 'node', outfile: saida, logLevel: 'silent', jsx: 'automatic',
  alias: { '@': path.join(raiz, 'src') },
  define: { 'import.meta.env': '{}' },
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
const { telas, normalizarConfig } = await import(pathToFileURL(saida).href);

// Linha como o banco devolve ANTES da migração 20261027 (sem nenhuma coluna nova).
const antigo = {
  id: 'c1', nome_empresa: 'Clínica Antiga', nome_assistente: 'Luna', telefone_contato: null, codigo_pais: '55', fuso_horario: 'America/Sao_Paulo',
  modelo_ia: null, padroes_loop_bot: ['\\btim\\b'], loop_bot_minimo_respostas: 3, loop_bot_pausa_dias: 30,
};
const completo = {
  ...antigo, endereco: 'Rua A, 1', site: 'x.com', instagram: '@x', email_contato: 'a@x.com', chave_pix: 'CNPJ 1', planos_aceitos: ['Plano A'],
  frase_encerramento: 'Até logo', estilo_comunicacao: 'Formal', horario_funcionamento: [{ dias: [1, 2, 3, 4, 5], abre: '08:00:00', fecha: '18:00:00' }],
  saudacao_bom_dia_inicio: '07:00:00', saudacao_boa_tarde_inicio: '12:00:00', saudacao_boa_noite_inicio: '18:00:00',
  aviso_fora_horario_inicio: '23:00:00', aviso_fora_horario_fim: '07:00:00', aviso_fora_horario_texto: 'Fora do horário', pausa_entre_mensagens_ms: 1000, max_caracteres_mensagem: 700,
};

test('configuração em formato antigo recebe os padrões das colunas novas', () => {
  const c = normalizarConfig(antigo);
  assert.deepEqual([c.horario_funcionamento, c.planos_aceitos, c.estilo_comunicacao, c.saudacao_bom_dia_inicio, c.max_caracteres_mensagem], [[], [], 'Cordial e objetivo', '07:00', 700]);
  assert.equal(normalizarConfig(null), null);
  assert.equal(normalizarConfig({}), null);
});

test('Empresa: abre com o formato antigo e com a configuração completa', () => {
  const velho = telas.empresa(normalizarConfig(antigo));
  assert.match(velho, /Identidade e contato/);
  assert.match(velho, /Adicionar faixa/);
  assert.match(velho, /value="Luna"/);
  const novo = telas.empresa(normalizarConfig(completo));
  assert.match(novo, /Rua A, 1/);
  assert.match(novo, /Segunda a sexta: 08:00 às 18:00/);
  assert.match(novo, /Domingo e sábado: fechado/);
  assert.match(novo, /value="23:00"/);
});

test('Implantação (aba padrão): abre com o formato antigo e aponta o que falta', () => {
  const html = telas.implantacao(normalizarConfig(antigo));
  assert.match(html, /Checklist de implantação/);
  assert.match(html, /Falta preencher: telefone, endereço/);
  assert.match(html.replace(/<!-- -->/g, ''), /0 de 8 prontos/);
});

test('Serviços e valores: lista agrupada com preço e quem agenda; migração ausente mostra aviso', () => {
  const html = telas.servicos([
    { id: 's1', chave: 'consulta', nome: 'Consulta clínica', categoria: 'Consultas', descricao: null, preco: 120, preco_observacao: null, quem_agenda: 'assistente', tipo_agenda_id: 't1', exige_requisicao: false, aceita_plano: true, observacoes: null, ordem: 1, ativo: true },
    { id: 's2', chave: 'cirurgia', nome: 'Cirurgia', categoria: 'Procedimentos', descricao: null, preco: null, preco_observacao: null, quem_agenda: 'recepcao', tipo_agenda_id: null, exige_requisicao: false, aceita_plano: null, observacoes: null, ordem: 2, ativo: true },
  ]);
  assert.match(html, /Consulta clínica/);
  assert.match(html, /R\$&nbsp;120,00|R\$ 120,00/);
  assert.match(html, /O assistente agenda/);
  assert.match(html, /Somente a recepção/);
  assert.match(html, /Aceita plano/);
  assert.match(telas.servicos([], false), /20261027100000_clinica_configuracao_prompt/);
  assert.match(telas.servicos([]), /Nenhum serviço cadastrado ainda/);
});

test('Horário de funcionamento: prévia do texto que o assistente recebe', () => {
  assert.match(telas.horario([{ dias: [1, 2, 3, 4, 5], abre: '08:00', fecha: '18:00' }, { dias: [6], abre: '08:00', fecha: '16:00' }]), /Sábado: 08:00 às 16:00/);
  assert.match(telas.horario([]), /Nenhuma faixa cadastrada/);
});

test('Tipo e agenda: mostram parâmetros, horários gerados, valor ligado e variáveis do evento', () => {
  const tipo = { id: 't1', chave: 'consulta', nome: 'Consulta', ativo: true, duracao_padrao_minutos: 60, duracao_retorno_minutos: 30, aliases: [], operacoes_permitidas: ['buscar', 'agendar'], campos_obrigatorios: ['email'] };
  const html = telas.tipo(tipo);
  assert.match(html, /Busca de horários/);
  assert.match(html, /Evento no Google Agenda/);
  assert.match(html, /segunda, 09:00 às 18:00 \(último horário 17:00\)/);
  assert.match(html, /R\$ 120,00 \(de Serviços e valores\)/);
  assert.match(html, /\{\{pet_nome\}\}/);
  assert.match(html, /Dados obrigatórios para agendar/);
  const somenteInfo = telas.tipo({ ...tipo, operacoes_permitidas: [] });
  assert.match(somenteInfo, /só informativo/);
  assert.match(telas.regra({ id: 'r1', profissional_id: 'p1', especialidade_id: 't1', calendario_id: null, ativo: true }, tipo), /Ajustes desta agenda/);
});

test('Feriados e histórico de agendamentos: abrem, inclusive sem a migração', () => {
  assert.match(telas.feriados(true), /Natal/);
  assert.match(telas.feriados(false), /20261027110000_agenda_motor_configuravel/);
  assert.match(telas.agendamentos(), /Agendamentos feitos pelo assistente/);
});
