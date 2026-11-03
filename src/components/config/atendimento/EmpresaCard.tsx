import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AtendimentoConfig } from '@/types/atendimentoConfig';
import { Campo } from './campos';
import { mensagemErro } from './erros';
import { validarHorarios } from '@/lib/horariosTexto';
import { HorarioFuncionamentoEditor } from './HorarioFuncionamentoEditor';

const FUSOS = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Bahia',
  'America/Cuiaba', 'America/Campo_Grande', 'America/Porto_Velho', 'America/Rio_Branco', 'America/Noronha',
  'America/Argentina/Buenos_Aires', 'America/Montevideo', 'Europe/Lisbon',
];

const hhmm = (valor: string | null | undefined) => (valor ? valor.slice(0, 5) : '');
const vazioParaNulo = (valor: string | null | undefined) => (valor && valor.trim() ? valor.trim() : null);

/** Todos os dados da empresa que o assistente usa: o que muda de clínica para clínica fica aqui. */
export function EmpresaCard({
  config, salvando, onSalvar,
}: {
  config: AtendimentoConfig;
  salvando: boolean;
  onSalvar: (valores: Partial<AtendimentoConfig> & { id: string }) => Promise<unknown>;
}) {
  const [form, setForm] = useState(config);
  const [padroes, setPadroes] = useState(config.padroes_loop_bot.join('\n'));
  const [planos, setPlanos] = useState((config.planos_aceitos ?? []).join('\n'));
  useEffect(() => {
    setForm(config);
    setPadroes(config.padroes_loop_bot.join('\n'));
    setPlanos((config.planos_aceitos ?? []).join('\n'));
  }, [config]);

  const set = <K extends keyof AtendimentoConfig>(campo: K, valor: AtendimentoConfig[K]) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async () => {
    const lista = padroes.split('\n').map((linha) => linha.trim()).filter(Boolean);
    for (const padrao of lista) {
      try { new RegExp(padrao, 'i'); } catch {
        toast.error('Expressão inválida na detecção de robôs', { description: padrao });
        return;
      }
    }
    if (!form.nome_empresa.trim() || !form.nome_assistente.trim()) return toast.error('Informe o nome da empresa e do assistente');
    const erroHorario = validarHorarios(form.horario_funcionamento);
    if (erroHorario) return toast.error('Horário de funcionamento', { description: erroHorario });
    if (!(hhmm(form.saudacao_bom_dia_inicio) < hhmm(form.saudacao_boa_tarde_inicio) && hhmm(form.saudacao_boa_tarde_inicio) < hhmm(form.saudacao_boa_noite_inicio))) {
      return toast.error('Faixas de saudação', { description: 'A ordem precisa ser: bom dia, boa tarde, boa noite.' });
    }
    const temAviso = !!form.aviso_fora_horario_inicio || !!form.aviso_fora_horario_fim;
    if (temAviso && (!form.aviso_fora_horario_inicio || !form.aviso_fora_horario_fim)) {
      return toast.error('Aviso fora do expediente', { description: 'Informe o início e o fim da janela.' });
    }
    try {
      await onSalvar({
        id: config.id,
        nome_empresa: form.nome_empresa.trim(),
        nome_assistente: form.nome_assistente.trim(),
        estilo_comunicacao: form.estilo_comunicacao.trim() || 'Cordial e objetivo',
        telefone_contato: vazioParaNulo(form.telefone_contato),
        email_contato: vazioParaNulo(form.email_contato),
        site: vazioParaNulo(form.site),
        instagram: vazioParaNulo(form.instagram),
        endereco: vazioParaNulo(form.endereco),
        chave_pix: vazioParaNulo(form.chave_pix),
        frase_encerramento: vazioParaNulo(form.frase_encerramento),
        planos_aceitos: planos.split('\n').map((linha) => linha.trim()).filter(Boolean),
        horario_funcionamento: form.horario_funcionamento.map((f) => ({ ...f, abre: hhmm(f.abre), fecha: hhmm(f.fecha) })),
        saudacao_bom_dia_inicio: hhmm(form.saudacao_bom_dia_inicio),
        saudacao_boa_tarde_inicio: hhmm(form.saudacao_boa_tarde_inicio),
        saudacao_boa_noite_inicio: hhmm(form.saudacao_boa_noite_inicio),
        aviso_fora_horario_inicio: temAviso ? hhmm(form.aviso_fora_horario_inicio) : null,
        aviso_fora_horario_fim: temAviso ? hhmm(form.aviso_fora_horario_fim) : null,
        aviso_fora_horario_texto: vazioParaNulo(form.aviso_fora_horario_texto),
        codigo_pais: form.codigo_pais.trim(),
        fuso_horario: form.fuso_horario.trim(),
        modelo_ia: vazioParaNulo(form.modelo_ia),
        pausa_entre_mensagens_ms: Math.round(Number(form.pausa_entre_mensagens_ms)),
        max_caracteres_mensagem: Math.round(Number(form.max_caracteres_mensagem)),
        padroes_loop_bot: lista,
        loop_bot_minimo_respostas: Number(form.loop_bot_minimo_respostas),
        loop_bot_pausa_dias: Number(form.loop_bot_pausa_dias),
      });
      toast.success('Configurações salvas', { description: 'Valem a partir da próxima mensagem do assistente — não é preciso salvar nova versão do prompt.' });
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade e contato</CardTitle>
          <CardDescription>
            Entram no prompt como variáveis ({'{{nome_empresa}}'}, {'{{endereco}}'}, {'{{chave_pix}}'}…). Campo vazio faz o assistente dizer que não tem a informação.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo id="cfg-empresa" rotulo="Nome da empresa">
            <Input id="cfg-empresa" value={form.nome_empresa} maxLength={120} onChange={(e) => set('nome_empresa', e.target.value)} />
          </Campo>
          <Campo id="cfg-assistente" rotulo="Nome do assistente virtual">
            <Input id="cfg-assistente" value={form.nome_assistente} maxLength={60} onChange={(e) => set('nome_assistente', e.target.value)} />
          </Campo>
          <Campo id="cfg-estilo" rotulo="Estilo de comunicação" ajuda="Ex.: Formal e afetuoso · Descontraído e direto.">
            <Input id="cfg-estilo" value={form.estilo_comunicacao} maxLength={160} onChange={(e) => set('estilo_comunicacao', e.target.value)} />
          </Campo>
          <Campo id="cfg-tel" rotulo="Telefone de contato">
            <Input id="cfg-tel" value={form.telefone_contato ?? ''} maxLength={40} onChange={(e) => set('telefone_contato', e.target.value)} />
          </Campo>
          <Campo id="cfg-email" rotulo="E-mail de contato">
            <Input id="cfg-email" type="email" value={form.email_contato ?? ''} maxLength={200} onChange={(e) => set('email_contato', e.target.value)} />
          </Campo>
          <Campo id="cfg-site" rotulo="Site">
            <Input id="cfg-site" value={form.site ?? ''} maxLength={200} onChange={(e) => set('site', e.target.value)} />
          </Campo>
          <Campo id="cfg-insta" rotulo="Instagram">
            <Input id="cfg-insta" value={form.instagram ?? ''} maxLength={120} onChange={(e) => set('instagram', e.target.value)} />
          </Campo>
          <Campo id="cfg-pix" rotulo="Chave Pix" ajuda="Só é informada quando o cliente pedir.">
            <Input id="cfg-pix" value={form.chave_pix ?? ''} maxLength={200} onChange={(e) => set('chave_pix', e.target.value)} />
          </Campo>
          <div className="md:col-span-2">
            <Campo id="cfg-endereco" rotulo="Endereço completo">
              <Textarea id="cfg-endereco" rows={2} value={form.endereco ?? ''} maxLength={400} onChange={(e) => set('endereco', e.target.value)} />
            </Campo>
          </div>
          <Campo id="cfg-planos" rotulo="Planos e convênios aceitos (um por linha)">
            <Textarea id="cfg-planos" rows={3} value={planos} onChange={(e) => setPlanos(e.target.value)} />
          </Campo>
          <Campo id="cfg-frase" rotulo="Frase de encerramento" ajuda="Enviada ao finalizar o atendimento; também marca a conversa como “Finalizado” (aba Estados).">
            <Input id="cfg-frase" value={form.frase_encerramento ?? ''} maxLength={200} onChange={(e) => set('frase_encerramento', e.target.value)} />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horário de funcionamento</CardTitle>
          <CardDescription>Informação geral da empresa. Os horários realmente livres para agendar vêm sempre das agendas (Regras da agenda).</CardDescription>
        </CardHeader>
        <CardContent>
          <HorarioFuncionamentoEditor valor={form.horario_funcionamento} onChange={(v) => set('horario_funcionamento', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saudação e aviso fora do expediente</CardTitle>
          <CardDescription>Variáveis {'{{saudacao}}'} e {'{{aviso_fora_horario}}'}. O aviso só aparece dentro da janela configurada (pode atravessar a meia-noite).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Campo id="cfg-bomdia" rotulo="“Bom dia” a partir de">
            <Input id="cfg-bomdia" type="time" value={hhmm(form.saudacao_bom_dia_inicio)} onChange={(e) => set('saudacao_bom_dia_inicio', e.target.value)} />
          </Campo>
          <Campo id="cfg-boatarde" rotulo="“Boa tarde” a partir de">
            <Input id="cfg-boatarde" type="time" value={hhmm(form.saudacao_boa_tarde_inicio)} onChange={(e) => set('saudacao_boa_tarde_inicio', e.target.value)} />
          </Campo>
          <Campo id="cfg-boanoite" rotulo="“Boa noite” a partir de">
            <Input id="cfg-boanoite" type="time" value={hhmm(form.saudacao_boa_noite_inicio)} onChange={(e) => set('saudacao_boa_noite_inicio', e.target.value)} />
          </Campo>
          <Campo id="cfg-aviso-ini" rotulo="Aviso fora do expediente: início">
            <Input id="cfg-aviso-ini" type="time" value={hhmm(form.aviso_fora_horario_inicio)} onChange={(e) => set('aviso_fora_horario_inicio', e.target.value || null)} />
          </Campo>
          <Campo id="cfg-aviso-fim" rotulo="Aviso fora do expediente: fim">
            <Input id="cfg-aviso-fim" type="time" value={hhmm(form.aviso_fora_horario_fim)} onChange={(e) => set('aviso_fora_horario_fim', e.target.value || null)} />
          </Campo>
          <div className="md:col-span-3">
            <Campo id="cfg-aviso-texto" rotulo="Texto do aviso" ajuda="Enviado uma vez na saudação inicial. Deixe vazio para não avisar.">
              <Textarea id="cfg-aviso-texto" rows={4} value={form.aviso_fora_horario_texto ?? ''} maxLength={1500} onChange={(e) => set('aviso_fora_horario_texto', e.target.value)} />
            </Campo>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Região, IA e envio</CardTitle>
          <CardDescription>Fuso horário e código do país valem para datas, horários da agenda e telefones.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo id="cfg-fuso" rotulo="Fuso horário (IANA)">
            <Input id="cfg-fuso" list="fusos-sugeridos" value={form.fuso_horario} onChange={(e) => set('fuso_horario', e.target.value)} />
            <datalist id="fusos-sugeridos">{FUSOS.map((fuso) => <option key={fuso} value={fuso} />)}</datalist>
          </Campo>
          <Campo id="cfg-pais" rotulo="Código do país" ajuda="Acrescentado a telefones digitados sem o código (ex.: 55).">
            <Input id="cfg-pais" value={form.codigo_pais} maxLength={3} inputMode="numeric" onChange={(e) => set('codigo_pais', e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo id="cfg-modelo" rotulo="Modelo de IA" ajuda="Vazio usa o padrão do sistema.">
            <Input id="cfg-modelo" value={form.modelo_ia ?? ''} placeholder="gpt-4.1-mini" onChange={(e) => set('modelo_ia', e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-4">
            <Campo id="cfg-pausa" rotulo="Pausa entre mensagens (ms)" ajuda="Respostas longas saem em várias mensagens.">
              <Input id="cfg-pausa" type="number" min={0} max={10000} step={100} value={form.pausa_entre_mensagens_ms} onChange={(e) => set('pausa_entre_mensagens_ms', Number(e.target.value))} />
            </Campo>
            <Campo id="cfg-maxchars" rotulo="Máx. de caracteres por mensagem">
              <Input id="cfg-maxchars" type="number" min={200} max={3000} step={50} value={form.max_caracteres_mensagem} onChange={(e) => set('max_caracteres_mensagem', Number(e.target.value))} />
            </Campo>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detecção de URA e robôs</CardTitle>
          <CardDescription>Evita loop entre o assistente e atendimentos automáticos (operadoras, bancos…).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Campo id="cfg-loop-min" rotulo="Respostas mínimas do assistente antes de pausar">
            <Input id="cfg-loop-min" type="number" min={1} max={20} value={form.loop_bot_minimo_respostas} onChange={(e) => set('loop_bot_minimo_respostas', Number(e.target.value))} />
          </Campo>
          <Campo id="cfg-loop-dias" rotulo="Dias de pausa">
            <Input id="cfg-loop-dias" type="number" min={1} max={365} value={form.loop_bot_pausa_dias} onChange={(e) => set('loop_bot_pausa_dias', Number(e.target.value))} />
          </Campo>
          <div className="md:col-span-2">
            <Campo id="cfg-padroes" rotulo="Padrões de URA/robô (um por linha)" ajuda="Expressões regulares sem distinção de maiúsculas. Se o assistente já respondeu o mínimo de vezes e o cliente envia algo que casa com um padrão, a conversa é pausada.">
              <Textarea id="cfg-padroes" rows={5} value={padroes} onChange={(e) => setPadroes(e.target.value)} className="font-mono text-xs" />
            </Campo>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-xs text-muted-foreground">As alterações valem na próxima mensagem. O texto das regras muda em Meu Prompt.</p>
        <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configurações'}</Button>
      </div>
    </div>
  );
}
