import { useState } from 'react';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AtendimentoEstado, DeteccaoEstado } from '@/types/atendimentoConfig';
import { Campo, SelectNativo } from './campos';
import { mensagemErro } from './erros';

type Teste = Awaited<ReturnType<(input: { texto?: string; resposta?: string; estados?: AtendimentoEstado[] }) => Promise<{
  mensagem_cliente?: { chave: string; nome: string } | null;
  resposta_assistente?: { chave: string; nome: string } | null;
  previa_notificacao?: string;
}>>>;

const ROTULO_DETECCAO: Record<DeteccaoEstado, string> = {
  padrao: 'Estado padrão',
  mensagem_cliente: 'IA lê a mensagem do cliente',
  resposta_assistente: 'Frase na resposta do assistente',
  manual: 'Somente manual',
};

const NOVO: Partial<AtendimentoEstado> = {
  chave: '', nome: '', deteccao: 'mensagem_cliente', criterios: '', pausar_bot: false, pausa_horas: 8, notificar: false,
  encerrar_conversa: false, ativo: true, ordem: 50,
};

export function EstadosCard({
  estados, onSalvar, onRemover, onTestar,
}: {
  estados: AtendimentoEstado[];
  onSalvar: (valores: Partial<AtendimentoEstado> & { chave: string }) => Promise<unknown>;
  onRemover: (id: string) => Promise<unknown>;
  onTestar: (entrada: { texto?: string; resposta?: string; estados: AtendimentoEstado[] }) => Promise<Teste>;
}) {
  const [edit, setEdit] = useState<Partial<AtendimentoEstado> | null>(null);
  const [textoTeste, setTextoTeste] = useState('');
  const [respostaTeste, setRespostaTeste] = useState('');
  const [resultado, setResultado] = useState<Teste | null>(null);
  const [testando, setTestando] = useState(false);

  const salvar = async () => {
    if (!edit) return;
    const chave = (edit.chave ?? '').trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(chave)) return toast.error('Chave inválida', { description: 'Use letras minúsculas, números e _ (ex.: reclamacao).' });
    if (!edit.nome?.trim()) return toast.error('Informe o nome');
    if (edit.deteccao === 'mensagem_cliente' && !edit.criterios?.trim()) return toast.error('Descreva os critérios de classificação');
    if (edit.deteccao === 'resposta_assistente' && !(edit.frase_gatilho ?? '').trim()) return toast.error('Informe a frase-gatilho');
    try {
      await onSalvar({
        ...edit,
        chave,
        nome: edit.nome.trim(),
        criterios: edit.deteccao === 'mensagem_cliente' ? edit.criterios?.trim() : null,
        frase_gatilho: edit.deteccao === 'resposta_assistente' ? edit.frase_gatilho?.trim() : null,
        pausa_horas: edit.pausar_bot ? Number(edit.pausa_horas) || 8 : null,
        modelo_notificacao: edit.notificar ? edit.modelo_notificacao?.trim() || null : null,
        resumo_instrucao: edit.notificar ? edit.resumo_instrucao?.trim() || null : null,
        mensagem_cliente: edit.mensagem_cliente?.trim() || null,
      });
      toast.success('Estado salvo');
      setEdit(null);
    } catch (erro) {
      toast.error('Não foi possível salvar', { description: mensagemErro(erro) });
    }
  };

  const testar = async () => {
    setTestando(true);
    try {
      setResultado(await onTestar({ texto: textoTeste || undefined, resposta: respostaTeste || undefined, estados: estados.filter((e) => e.ativo) }));
    } catch (erro) {
      toast.error('Teste indisponível', { description: mensagemErro(erro) });
    } finally {
      setTestando(false);
    }
  };

  const campo = <K extends keyof AtendimentoEstado>(chave: K, valor: AtendimentoEstado[K]) => setEdit((atual) => ({ ...atual, [chave]: valor }));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Estados e classificação do atendimento</CardTitle>
          <CardDescription>
            Defina como o sistema reconhece cada situação (atendimento humano, finalizado, outras) e o que acontece quando ela ocorre.
            A chave do estado é gravada na conversa e pode ser usada por CRM e automações.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEdit({ ...NOVO })}><Plus className="mr-1 h-4 w-4" /> Novo estado</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {estados.map((estado) => (
          <div key={estado.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{estado.nome} <code className="ml-1 rounded bg-muted px-1 text-xs">{estado.chave}</code></p>
              <p className="text-xs text-muted-foreground">{estado.descricao || ROTULO_DETECCAO[estado.deteccao]}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">{ROTULO_DETECCAO[estado.deteccao]}</Badge>
                {estado.pausar_bot && <Badge variant="secondary">Pausa o bot {estado.pausa_horas} h</Badge>}
                {estado.notificar && <Badge variant="secondary">Notifica a equipe</Badge>}
                {estado.mensagem_cliente && <Badge variant="secondary">Responde ao cliente</Badge>}
                {estado.encerrar_conversa && <Badge variant="secondary">Fecha a conversa</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={estado.ativo}
                disabled={estado.deteccao === 'padrao'}
                aria-label={`Ativar ${estado.nome}`}
                onCheckedChange={(ativo) => onSalvar({ id: estado.id, chave: estado.chave, ativo }).catch((e) => toast.error('Erro', { description: mensagemErro(e) }))}
              />
              <Button size="icon" variant="ghost" aria-label={`Editar ${estado.nome}`} onClick={() => setEdit({ ...estado })}><Pencil className="h-4 w-4" /></Button>
              {!estado.padrao && (
                <Button size="icon" variant="ghost" aria-label={`Remover ${estado.nome}`} onClick={() => {
                  if (window.confirm(`Remover o estado "${estado.nome}"?`)) onRemover(estado.id).catch((e) => toast.error('Erro', { description: mensagemErro(e) }));
                }}><Trash2 className="h-4 w-4" /></Button>
              )}
            </div>
          </div>
        ))}

        {edit && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="est-nome" rotulo="Nome"><Input id="est-nome" value={edit.nome ?? ''} maxLength={80} onChange={(e) => campo('nome', e.target.value)} /></Campo>
              <Campo id="est-chave" rotulo="Chave (identificador)" ajuda="Não muda depois de criada; é o valor usado por CRM e automações.">
                <Input id="est-chave" value={edit.chave ?? ''} disabled={!!edit.id} onChange={(e) => campo('chave', e.target.value.toLowerCase())} />
              </Campo>
              {edit.deteccao !== 'padrao' && (
                <Campo id="est-det" rotulo="Como é detectado">
                  <SelectNativo id="est-det" value={edit.deteccao ?? 'mensagem_cliente'} disabled={!!edit.padrao} onChange={(v) => campo('deteccao', v as DeteccaoEstado)}>
                    <option value="mensagem_cliente">IA lê a mensagem do cliente</option>
                    <option value="resposta_assistente">Frase na resposta do assistente</option>
                    <option value="manual">Somente manual (painel)</option>
                  </SelectNativo>
                </Campo>
              )}
            </div>
            {edit.deteccao === 'mensagem_cliente' && (
              <Campo id="est-crit" rotulo="Critérios de classificação" ajuda="Instruções para a IA: quando classificar e quando NÃO classificar. Inclua exemplos.">
                <Textarea id="est-crit" rows={6} value={edit.criterios ?? ''} onChange={(e) => campo('criterios', e.target.value)} />
              </Campo>
            )}
            {edit.deteccao === 'resposta_assistente' && (
              <Campo id="est-frase" rotulo="Frase-gatilho" ajuda="Quando a resposta do assistente contiver esta frase (sem diferenciar acentos/maiúsculas), o estado é aplicado. Use {{frase_encerramento}} para acompanhar a frase de encerramento da aba Empresa.">
                <Input id="est-frase" value={edit.frase_gatilho ?? ''} onChange={(e) => campo('frase_gatilho', e.target.value)} />
              </Campo>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.pausar_bot} onCheckedChange={(v) => campo('pausar_bot', v)} /> Pausar o bot</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.notificar} onCheckedChange={(v) => campo('notificar', v)} /> Notificar a equipe</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!edit.encerrar_conversa} onCheckedChange={(v) => campo('encerrar_conversa', v)} /> Fechar a conversa</label>
            </div>
            {edit.pausar_bot && (
              <Campo id="est-horas" rotulo="Duração da pausa (horas)">
                <Input id="est-horas" type="number" min={1} max={720} value={edit.pausa_horas ?? 8} onChange={(e) => campo('pausa_horas', Number(e.target.value))} />
              </Campo>
            )}
            <Campo id="est-msg" rotulo="Mensagem automática ao cliente (opcional)" ajuda="Se preenchida, é enviada no lugar da resposta da IA neste turno.">
              <Textarea id="est-msg" rows={2} value={edit.mensagem_cliente ?? ''} onChange={(e) => campo('mensagem_cliente', e.target.value)} />
            </Campo>
            {edit.notificar && (
              <>
                <Campo id="est-resumo" rotulo="Instrução para o resumo" ajuda="A IA resume a conversa seguindo esta instrução. Vazio = sem resumo.">
                  <Textarea id="est-resumo" rows={3} value={edit.resumo_instrucao ?? ''} onChange={(e) => campo('resumo_instrucao', e.target.value)} />
                </Campo>
                <Campo id="est-modelo" rotulo="Texto da notificação" ajuda="Variáveis: {{resumo}}, {{telefone_cliente}}, {{estado}}, {{nome_empresa}}.">
                  <Textarea id="est-modelo" rows={4} value={edit.modelo_notificacao ?? ''} onChange={(e) => campo('modelo_notificacao', e.target.value)} />
                </Campo>
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={salvar}>Salvar estado</Button>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium"><FlaskConical className="h-4 w-4" /> Testar classificação (sem enviar nada)</p>
          <Campo id="teste-texto" rotulo="Mensagem do cliente"><Textarea id="teste-texto" rows={2} value={textoTeste} onChange={(e) => setTextoTeste(e.target.value)} placeholder="Quero falar com um atendente" /></Campo>
          <Campo id="teste-resp" rotulo="Resposta do assistente (opcional)"><Textarea id="teste-resp" rows={2} value={respostaTeste} onChange={(e) => setRespostaTeste(e.target.value)} /></Campo>
          <Button variant="outline" size="sm" onClick={testar} disabled={testando || (!textoTeste.trim() && !respostaTeste.trim())}>{testando ? 'Testando…' : 'Testar'}</Button>
          {resultado && (
            <div className="space-y-1 text-sm">
              {textoTeste && <p>Mensagem do cliente → <strong>{resultado.mensagem_cliente?.nome ?? '—'}</strong></p>}
              {respostaTeste && <p>Resposta do assistente → <strong>{resultado.resposta_assistente?.nome ?? 'nenhum estado'}</strong></p>}
              {resultado.previa_notificacao && <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{resultado.previa_notificacao}</pre>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
