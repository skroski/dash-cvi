import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Clock3,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { VARIAVEIS_LEMBRETE } from '@/lib/reminderMessage';
import {
  REMINDER_AI_MODELS,
  ReminderAiPreview,
  ReminderConfiguration,
  ReminderConfigurationInput,
  ReminderService,
  daysInAdvanceLabel,
  renderReminderPreview,
} from '@/types/reminder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  EXAMPLE_MESSAGE_PRESETS,
  ExampleMessagePreset,
  ReminderPresetCategory,
} from '@/config/exampleMessagePresets';
import { ServiceBadge } from './reminderUi';

interface ReminderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder?: ReminderConfiguration | null;
  initialTab?: 'geral' | 'frases' | 'ia';
  services: ReminderService[];
  defaultExamples: string[];
  clinicName: string;
  isPending: boolean;
  onSubmit: (input: ReminderConfigurationInput) => void;
  previewPending: boolean;
  onPreview: (input: {
    examples: string[];
    aiInstructions: string | null;
    aiModel: string;
    useAi: boolean;
    daysInAdvance: number;
  }) => Promise<ReminderAiPreview[]>;
}

const TIMEZONE = 'America/Sao_Paulo';
const MAX_EXAMPLES = 10;

const ReminderFormDialog = ({
  open,
  onOpenChange,
  reminder,
  initialTab = 'geral',
  services,
  defaultExamples,
  clinicName,
  isPending,
  onSubmit,
  previewPending,
  onPreview,
}: ReminderFormDialogProps) => {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ReminderPresetCategory>('consulta');
  const [botoesConfirmacao, setBotoesConfirmacao] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('18:00');
  const [daysInAdvance, setDaysInAdvance] = useState(1);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [intervalMin, setIntervalMin] = useState(20);
  const [intervalMax, setIntervalMax] = useState(50);
  const [sendWindow, setSendWindow] = useState(3);
  const [onlyConfirmed, setOnlyConfirmed] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);
  const [useAi, setUseAi] = useState(true);
  const [aiModel, setAiModel] = useState('gpt-4.1-mini');
  const [aiInstructions, setAiInstructions] = useState('');
  const [previews, setPreviews] = useState<ReminderAiPreview[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const textareas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const lastFocused = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setName(reminder?.name ?? 'Lembrete do dia anterior');
    setCategory(reminder?.category ?? 'consulta');
    setBotoesConfirmacao(
      reminder?.botoesConfirmacao ??
        (reminder?.category === 'aniversario_pet' ||
        reminder?.category === 'aniversario_tutor' ||
        reminder?.category === 'satisfacao' ||
        reminder?.category === 'pos_atendimento'
          ? false
          : true)
    );
    setEnabled(reminder?.enabled ?? true);
    setSendTime(reminder?.sendTime ?? '18:00');
    setDaysInAdvance(reminder?.daysInAdvance ?? 1);
    setServiceIds(reminder?.serviceIds ?? []);
    setIntervalMin(reminder?.intervalMinSeconds ?? 20);
    setIntervalMax(reminder?.intervalMaxSeconds ?? 50);
    setSendWindow(reminder?.sendWindowHours ?? 3);
    setOnlyConfirmed(reminder?.onlyConfirmed ?? false);
    setExamples(reminder?.examples?.length ? reminder.examples : defaultExamples);
    setUseAi(reminder?.useAi ?? true);
    setAiModel(reminder?.aiModel ?? 'gpt-4.1-mini');
    setAiInstructions(reminder?.aiInstructions ?? '');
    setPreviews([]);
    setSubmitted(false);
    // defaultExamples chega depois da primeira renderização em regras novas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reminder, initialTab]);

  useEffect(() => {
    if (open && !reminder && examples.length === 0 && defaultExamples.length > 0) {
      setExamples(defaultExamples);
    }
  }, [open, reminder, examples.length, defaultExamples]);

  const filledExamples = examples.map((example) => example.trim()).filter(Boolean);
  const nameError = submitted && name.trim().length === 0;
  const timeError = submitted && !/^\d{2}:\d{2}$/.test(sendTime);
  const intervalError = intervalMin < 5 || intervalMax < intervalMin || intervalMax > 600;
  const examplesError = submitted && filledExamples.length === 0;
  const isValid =
    name.trim().length > 0 &&
    /^\d{2}:\d{2}$/.test(sendTime) &&
    !intervalError &&
    filledExamples.length > 0;

  const applyPreset = (preset: ExampleMessagePreset) => {
    setName(preset.name);
    setCategory(preset.category);
    setDaysInAdvance(preset.recommendedDaysInAdvance);
    setSendTime(preset.recommendedSendTime);
    setOnlyConfirmed(preset.onlyConfirmed);
    setBotoesConfirmacao(preset.confirmButtons);
    setExamples(preset.examples);
    setAiInstructions(preset.aiInstructions);
    toast.success(`Modelo "${preset.title}" aplicado!`);
  };

  const updateExample = (index: number, value: string) =>
    setExamples((current) => current.map((example, i) => (i === index ? value : example)));

  const insertVariable = (token: string) => {
    const index = Math.min(lastFocused.current, examples.length - 1);
    if (index < 0) return;
    const textarea = textareas.current[index];
    const value = examples[index] ?? '';
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    updateExample(index, `${value.slice(0, start)}${token}${value.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const toggleService = (id: number, checked: boolean) =>
    setServiceIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    );

  const runPreview = async () => {
    try {
      setPreviews(
        await onPreview({
          examples: filledExamples,
          aiInstructions: aiInstructions.trim() || null,
          aiModel,
          useAi,
          daysInAdvance,
        })
      );
    } catch {
      setPreviews([]);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid || isPending) {
      if (filledExamples.length === 0) setTab('frases');
      else if (!name.trim() || intervalError) setTab('geral');
      return;
    }
    onSubmit({
      name,
      category,
      botoesConfirmacao,
      enabled,
      daysInAdvance,
      sendTime,
      timezone: TIMEZONE,
      examples: filledExamples,
      useAi,
      aiModel,
      aiInstructions: aiInstructions.trim() || null,
      serviceIds,
      intervalMinSeconds: intervalMin,
      intervalMaxSeconds: intervalMax,
      sendWindowHours: sendWindow,
      onlyConfirmed,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{reminder ? 'Editar regra de lembrete' : 'Nova regra de lembrete'}</DialogTitle>
          <DialogDescription>
            Defina quando o lembrete sai, para quais serviços e com quais frases de exemplo. A IA
            reescreve uma frase diferente para cada tutor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList className="grid h-11 w-full grid-cols-3">
              <TabsTrigger value="geral" className="min-h-9 gap-1.5">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="frases" className="min-h-9 gap-1.5">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                Frases ({filledExamples.length})
              </TabsTrigger>
              <TabsTrigger value="ia" className="min-h-9 gap-1.5">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                IA
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------------ Geral */}
            <TabsContent value="geral" className="mt-4 space-y-5">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    Modelos de Exemplo
                  </div>
                  <span className="text-[11px] text-muted-foreground">Clique para preencher a regra</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_MESSAGE_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 bg-background/80 hover:bg-emerald-500/10 hover:text-emerald-700 hover:border-emerald-500/40"
                      onClick={() => applyPreset(preset)}
                    >
                      <span>{preset.title}</span>
                      <Badge variant="secondary" className="px-1 py-0 text-[10px] font-normal">
                        {preset.badge}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminder-category">Categoria / Finalidade</Label>
                  <span className="text-[11px] text-muted-foreground">Tom da IA e proteção antispam</span>
                </div>
                <Select
                  value={category}
                  onValueChange={(val) => {
                    const newCat = val as ReminderPresetCategory;
                    setCategory(newCat);
                    const matchingPreset = EXAMPLE_MESSAGE_PRESETS.find((p) => p.category === newCat);
                    if (matchingPreset && (!name || name === 'Lembrete do dia anterior')) {
                      setName(matchingPreset.name);
                      setSendTime(matchingPreset.recommendedSendTime);
                      setDaysInAdvance(matchingPreset.recommendedDaysInAdvance);
                      setAiInstructions(matchingPreset.aiInstructions);
                      setExamples(matchingPreset.examples);
                      setBotoesConfirmacao(matchingPreset.confirmButtons);
                    } else {
                      setBotoesConfirmacao(matchingPreset ? matchingPreset.confirmButtons : (newCat === 'consulta' || newCat === 'vacina'));
                    }
                  }}
                >
                  <SelectTrigger id="reminder-category" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulta">🩺 Atendimento / Consulta (Lembrete de Véspera)</SelectItem>
                    <SelectItem value="vacina">💉 Vacinação (Foco em Imunização e Prevenção)</SelectItem>
                    <SelectItem value="pos_atendimento">🐾 Pós-Atendimento: Como o Pet está? (Check-in de Recuperação)</SelectItem>
                    <SelectItem value="aniversario_pet">🎂 Aniversário do Pet (Felicitações Festivas)</SelectItem>
                    <SelectItem value="aniversario_tutor">🎉 Aniversário do Tutor (Felicitações Calorosas)</SelectItem>
                    <SelectItem value="satisfacao">⭐ Pesquisa de Satisfação / Opinião (Feedback Pós-Atendimento)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-md border border-muted bg-muted/40 p-2 text-[11px] text-muted-foreground leading-relaxed">
                  {category === 'pos_atendimento' &&
                    '🐾 Proteção contra bloqueio: mensagens perguntando se o pet comeu e como passou estimulam respostas espontâneas do tutor, aquecendo e protegendo o número na Meta.'}
                  {category === 'aniversario_pet' &&
                    '🎂 Comemoração festiva cheia de afeto: tutores adoram receber votos de aniversário do pet e respondem agradecendo, elevando o score de engajamento do WhatsApp.'}
                  {category === 'aniversario_tutor' &&
                    '🎉 Parabéns humanizado da equipe para o tutor, gerando carinho e diálogo espontâneo com a clínica.'}
                  {category === 'satisfacao' &&
                    '⭐ Coleta avaliação rápida. É interligada com o módulo de pesquisa da clínica e insere o link rastreável pelo código {{link_pesquisa}}.'}
                  {category === 'vacina' &&
                    '💉 Alerta preventivo com antecedência configurada, reforçando a proteção e a saúde do pet.'}
                  {category === 'consulta' &&
                    '🩺 Lembrete padrão de véspera para confirmação e presença no horário agendado.'}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reminder-name">Nome da regra</Label>
                <Input
                  id="reminder-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Lembrete do dia anterior"
                  aria-invalid={nameError}
                  className="min-h-11"
                />
                {nameError && (
                  <p className="text-sm text-destructive" role="alert">
                    Informe um nome para identificar esta regra.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-time">Horário de envio</Label>
                  <div className="relative">
                    <Clock3
                      className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="reminder-time"
                      type="time"
                      value={sendTime}
                      onChange={(event) => setSendTime(event.target.value)}
                      className="min-h-11 pl-9 tabular-nums"
                      aria-invalid={timeError}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Horário de Brasília. O primeiro envio sai alguns segundos depois.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reminder-days">Quando avisar</Label>
                  <Select
                    value={String(daysInAdvance)}
                    onValueChange={(value) => setDaysInAdvance(Number(value))}
                  >
                    <SelectTrigger id="reminder-days" className="min-h-11">
                      <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((days) => (
                        <SelectItem key={days} value={String(days)}>
                          {daysInAdvanceLabel(days)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Em relação à data do atendimento na agenda.
                  </p>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Serviços atendidos por esta regra</legend>
                <p className="text-xs text-muted-foreground">
                  Agendamentos sem regra escolhida usam a regra do serviço deles. Nenhum marcado =
                  todos os serviços.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <label
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm',
                      serviceIds.length === 0 && 'border-primary bg-primary/5'
                    )}
                  >
                    <Checkbox
                      checked={serviceIds.length === 0}
                      onCheckedChange={(checked) => checked && setServiceIds([])}
                    />
                    Todos
                  </label>
                  {services
                    .filter((service) => service.active || serviceIds.includes(service.id))
                    .map((service) => (
                      <label
                        key={service.id}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3',
                          serviceIds.includes(service.id) && 'border-primary bg-primary/5'
                        )}
                      >
                        <Checkbox
                          checked={serviceIds.includes(service.id)}
                          onCheckedChange={(checked) => toggleService(service.id, checked === true)}
                        />
                        <ServiceBadge name={service.name} service={service} />
                      </label>
                    ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-interval-min">Intervalo mínimo (s)</Label>
                  <Input
                    id="reminder-interval-min"
                    type="number"
                    min={5}
                    max={600}
                    value={intervalMin}
                    onChange={(event) => setIntervalMin(Number(event.target.value))}
                    className="min-h-11 tabular-nums"
                    aria-invalid={intervalError}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-interval-max">Intervalo máximo (s)</Label>
                  <Input
                    id="reminder-interval-max"
                    type="number"
                    min={5}
                    max={600}
                    value={intervalMax}
                    onChange={(event) => setIntervalMax(Number(event.target.value))}
                    className="min-h-11 tabular-nums"
                    aria-invalid={intervalError}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-window">Prazo para enviar</Label>
                  <Select value={String(sendWindow)} onValueChange={(value) => setSendWindow(Number(value))}>
                    <SelectTrigger id="reminder-window" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6].map((hours) => (
                        <SelectItem key={hours} value={String(hours)}>
                          Até {hours}h depois
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p
                className={cn('-mt-2 text-xs', intervalError ? 'text-destructive' : 'text-muted-foreground')}
                role={intervalError ? 'alert' : undefined}
              >
                {intervalError
                  ? 'Use um intervalo entre 5 e 600 segundos, com o máximo maior ou igual ao mínimo.'
                  : `Entre uma mensagem e outra o sistema espera um tempo aleatório entre ${intervalMin} e ${intervalMax} segundos, para o WhatsApp não tratar os envios como disparo em massa. O que não sair até o prazo fica marcado como "não enviado".`}
              </p>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="reminder-confirm-buttons" className="font-medium text-emerald-950 dark:text-emerald-100">
                      Mensagem de confirmação com 2 botões (WhatsApp)
                    </Label>
                    <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-[10px]">
                      Confirmar / Não Confirmar
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Envia 2 botões interativos via Uazapi: [Confirmar] e [Não Confirmar]. Recomendado para consultas veterinárias, vacinas, banhos e serviços. Para aniversários e pesquisas de opinião, deixe desligado.
                  </p>
                </div>
                <Switch
                  id="reminder-confirm-buttons"
                  checked={botoesConfirmacao}
                  onCheckedChange={setBotoesConfirmacao}
                />
              </div>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <Label htmlFor="reminder-only-confirmed">Somente agendamentos confirmados</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ligado: só entra na fila quem está com status CONFIRMADO. Desligado: entram todos, menos
                    cancelados, desmarcados, faltas e remarcados.
                  </p>
                </div>
                <Switch id="reminder-only-confirmed" checked={onlyConfirmed} onCheckedChange={setOnlyConfirmed} />
              </div>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <Label htmlFor="reminder-enabled">Regra ativa</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Regras pausadas não enviam lembretes.
                  </p>
                </div>
                <Switch id="reminder-enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </TabsContent>

            {/* ----------------------------------------------------------- Frases */}
            <TabsContent value="frases" className="mt-4 space-y-4">
              <div className="rounded-md border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
                Escreva frases <strong className="text-foreground">genéricas</strong>: elas valem para
                qualquer serviço da regra. Os dados de cada tutor entram pelas variáveis. Clique numa
                variável para inserir no ponto em que o cursor está.
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Variáveis dinâmicas disponíveis:</span>
                  <span className="text-[11px] text-muted-foreground">Clique para inserir na frase em foco</span>
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Variáveis da mensagem">
                  {VARIAVEIS_LEMBRETE.map((variable) => (
                    <Button
                      key={variable.token}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-8 px-2.5 font-mono text-xs hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => insertVariable(variable.token)}
                      title={`${variable.token} — Inserir ${variable.rotulo}`}
                    >
                      <span className="font-semibold text-primary">{variable.token}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground font-sans">({variable.rotulo})</span>
                    </Button>
                  ))}
                </div>
              </div>

              {examplesError && (
                <p className="text-sm text-destructive" role="alert">
                  Escreva pelo menos uma frase de exemplo.
                </p>
              )}

              <ol className="space-y-4">
                {examples.map((example, index) => {
                  return (
                    <li key={index} className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                        <Label htmlFor={`example-${index}`} className="text-sm">
                          Frase {index + 1}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-9 gap-1 text-muted-foreground hover:text-destructive"
                          onClick={() => setExamples((current) => current.filter((_, i) => i !== index))}
                          disabled={examples.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Remover
                        </Button>
                      </div>
                      <div className="grid gap-0 md:grid-cols-2">
                        <Textarea
                          id={`example-${index}`}
                          ref={(element) => {
                            textareas.current[index] = element;
                          }}
                          value={example}
                          onFocus={() => {
                            lastFocused.current = index;
                          }}
                          onChange={(event) => updateExample(index, event.target.value)}
                          className="min-h-40 resize-y rounded-none border-0 border-b font-mono text-xs leading-5 focus-visible:ring-0 md:border-b-0 md:border-r"
                          placeholder="Olá, {{nome_tutor}}! ..."
                        />
                        <div className="bg-muted/30 p-3">
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Como o tutor vê
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-6">
                            {example.trim()
                              ? renderReminderPreview(example, clinicName, daysInAdvance)
                              : 'A prévia aparece aqui.'}
                          </p>
                          {botoesConfirmacao && example.trim() && (
                            <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-2">
                              <div className="flex items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-500/10 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Confirmar
                              </div>
                              <div className="flex items-center justify-center rounded-md border border-rose-600/30 bg-rose-500/10 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                Não Confirmar
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-1.5"
                  onClick={() => setExamples((current) => [...current, ''])}
                  disabled={examples.length >= MAX_EXAMPLES}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Adicionar frase
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Modelos de Frases
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Modelos Prontos</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {EXAMPLE_MESSAGE_PRESETS.map((preset) => (
                      <DropdownMenuItem
                        key={preset.id}
                        onClick={() => {
                          setExamples(preset.examples);
                          if (preset.aiInstructions) setAiInstructions(preset.aiInstructions);
                          toast.success(`Frases do modelo "${preset.title}" carregadas!`);
                        }}
                        className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                      >
                        <span className="font-medium text-xs text-foreground">{preset.title}</span>
                        <span className="text-[11px] text-muted-foreground">{preset.description}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 gap-1.5"
                  onClick={() => setExamples(defaultExamples)}
                  disabled={defaultExamples.length === 0}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restaurar as 5 frases padrão
                </Button>
              </div>
            </TabsContent>

            {/* --------------------------------------------------------------- IA */}
            <TabsContent value="ia" className="mt-4 space-y-5">
              <div className="flex min-h-14 items-center justify-between gap-4 rounded-md border p-3">
                <div>
                  <Label htmlFor="reminder-ai">Reescrever com IA (OpenAI)</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ligado: cada tutor recebe um texto diferente, inspirado nas frases. Desligado:
                    sai uma das frases sorteada, só com as variáveis preenchidas.
                  </p>
                </div>
                <Switch id="reminder-ai" checked={useAi} onCheckedChange={setUseAi} />
              </div>

              <div className={cn('space-y-5', !useAi && 'pointer-events-none opacity-50')}>
                <div className="space-y-1.5">
                  <Label htmlFor="reminder-model">Modelo</Label>
                  <Select value={aiModel} onValueChange={setAiModel} disabled={!useAi}>
                    <SelectTrigger id="reminder-model" className="min-h-11 sm:w-72">
                      <Bot className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REMINDER_AI_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reminder-instructions">Instruções extras do prompt para a IA (opcional)</Label>
                    <span className="text-xs text-muted-foreground">{aiInstructions.length} / 1.000</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {VARIAVEIS_LEMBRETE.map((variable) => (
                      <Button
                        key={variable.token}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 font-mono text-[11px]"
                        onClick={() => {
                          setAiInstructions((prev) => `${prev ? prev + ' ' : ''}${variable.token}`);
                        }}
                        disabled={!useAi}
                        title={`Inserir ${variable.token} (${variable.rotulo}) nas instruções`}
                      >
                        {variable.token}
                      </Button>
                    ))}
                  </div>
                  <Textarea
                    id="reminder-instructions"
                    value={aiInstructions}
                    onChange={(event) => setAiInstructions(event.target.value)}
                    maxLength={1000}
                    className="min-h-28 resize-y text-sm font-sans"
                    placeholder='Ex.: Adote um tom acolhedor e carinhoso. Enfatize a importância de trazer a carteirinha e convide o tutor a confirmar a presença clicando nos botões abaixo.'
                    disabled={!useAi}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Personalize o tom de voz e regras de negócio da IA. A IA respeita estritamente o serviço informado e os dados do tutor. Se a resposta da IA violar essas diretrizes ou falhar, o sistema usa automaticamente uma das frases configuradas.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                  <p className="text-sm font-medium">Prévia com um tutor fictício</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-9 gap-1.5"
                    onClick={runPreview}
                    disabled={previewPending || filledExamples.length === 0}
                  >
                    {previewPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    )}
                    {previews.length ? 'Gerar de novo' : 'Gerar prévia'}
                  </Button>
                </div>
                {previews.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Gere uma prévia para ver como a IA escreve com as frases e instruções atuais
                    (nada é enviado).
                  </p>
                ) : (
                  <ul className="grid gap-3 p-3 md:grid-cols-2">
                    {previews.map((preview, index) => (
                      <li key={index} className="rounded-md border bg-muted/30 p-3">
                        <Badge variant="outline" className="mb-2 font-normal">
                          {preview.origem === 'ia'
                            ? 'Escrita pela IA'
                            : `Frase ${(preview.exemplo_indice ?? 0) + 1}`}
                        </Badge>
                        <p className="whitespace-pre-wrap text-sm leading-6">{preview.texto}</p>
                        {botoesConfirmacao && (
                          <div className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-2">
                            <div className="flex items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-500/10 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              Confirmar
                            </div>
                            <div className="flex items-center justify-center rounded-md border border-rose-600/30 bg-rose-500/10 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              Não Confirmar
                            </div>
                          </div>
                        )}
                        {preview.aviso && (
                          <p className="mt-2 text-xs text-warning">{preview.aviso}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {reminder ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderFormDialog;
