import { useState } from 'react';
import {
  BellRing,
  Bot,
  CalendarDays,
  Check,
  Clock3,
  FlaskConical,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Tags,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import {
  REMINDER_AI_MODELS,
  ReminderConfiguration,
  ReminderService,
  daysInAdvanceLabel,
  renderReminderPreview,
} from '@/types/reminder';
import { ServiceBadge, formatDateTime } from './reminderUi';

interface RulesTabProps {
  configurations: ReminderConfiguration[];
  services: ReminderService[];
  clinicName: string;
  loading: boolean;
  togglePending: boolean;
  onCreate: () => void;
  onEdit: (rule: ReminderConfiguration, tab?: 'geral' | 'frases' | 'ia') => void;
  onToggle: (rule: ReminderConfiguration, enabled: boolean) => void;
  onDispatch: (rule: ReminderConfiguration) => void;
  onTest: (rule: ReminderConfiguration) => void;
  onDelete: (rule: ReminderConfiguration) => void;
}

type FilterCategory = 'todos' | 'com_botoes' | 'sem_botoes' | 'aniversario' | 'satisfacao';

const CATEGORY_LABEL: Record<string, string> = {
  consulta: 'Atendimento / Consulta',
  vacina: 'Vacinação',
  pos_atendimento: 'Pós-Atendimento',
  aniversario_pet: 'Aniversário Pet',
  aniversario_tutor: 'Aniversário Tutor',
  satisfacao: 'Pesquisa de Opinião',
};

const RulesTab = ({
  configurations,
  services,
  clinicName,
  loading,
  togglePending,
  onCreate,
  onEdit,
  onToggle,
  onDispatch,
  onTest,
  onDelete,
}: RulesTabProps) => {
  const [filter, setFilter] = useState<FilterCategory>('todos');

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item} className="shadow-sm">
            <CardHeader>
              <Skeleton className="h-5 w-52" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (configurations.length === 0) {
    return (
      <Card className="shadow-sm">
        <EmptyState
          icon={<BellRing />}
          title="Nenhuma regra de lembrete"
          description="Crie a primeira regra para definir quando e como os tutores são avisados."
          action={
            <Button onClick={onCreate} className="min-h-11">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar regra
            </Button>
          }
        />
      </Card>
    );
  }

  const serviceById = new Map(services.map((service) => [service.id, service]));

  const filteredConfigurations = configurations.filter((rule) => {
    if (filter === 'com_botoes') return rule.botoesConfirmacao;
    if (filter === 'sem_botoes') return !rule.botoesConfirmacao;
    if (filter === 'aniversario') {
      return rule.category === 'aniversario_pet' || rule.category === 'aniversario_tutor';
    }
    if (filter === 'satisfacao') {
      return rule.category === 'satisfacao' || rule.category === 'pos_atendimento';
    }
    return true;
  });

  const countComBotoes = configurations.filter((r) => r.botoesConfirmacao).length;
  const countSemBotoes = configurations.filter((r) => !r.botoesConfirmacao).length;
  const countAniversarios = configurations.filter(
    (r) => r.category === 'aniversario_pet' || r.category === 'aniversario_tutor'
  ).length;
  const countSatisfacao = configurations.filter(
    (r) => r.category === 'satisfacao' || r.category === 'pos_atendimento'
  ).length;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Criação de Regras */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={filter === 'todos' ? 'default' : 'outline'}
            className="h-8 text-xs font-normal"
            onClick={() => setFilter('todos')}
          >
            Todas ({configurations.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'com_botoes' ? 'default' : 'outline'}
            className={cn(
              'h-8 text-xs font-normal gap-1',
              filter !== 'com_botoes' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
            )}
            onClick={() => setFilter('com_botoes')}
          >
            <Check className="h-3 w-3" />
            Com 2 Botões ({countComBotoes})
          </Button>
          <Button
            size="sm"
            variant={filter === 'sem_botoes' ? 'default' : 'outline'}
            className={cn(
              'h-8 text-xs font-normal',
              filter !== 'sem_botoes' && 'border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10'
            )}
            onClick={() => setFilter('sem_botoes')}
          >
            Sem Confirmação ({countSemBotoes})
          </Button>
          <Button
            size="sm"
            variant={filter === 'aniversario' ? 'default' : 'outline'}
            className="h-8 text-xs font-normal"
            onClick={() => setFilter('aniversario')}
          >
            🎂 Aniversários ({countAniversarios})
          </Button>
          <Button
            size="sm"
            variant={filter === 'satisfacao' ? 'default' : 'outline'}
            className="h-8 text-xs font-normal"
            onClick={() => setFilter('satisfacao')}
          >
            ⭐ Opinião / Pós ({countSatisfacao})
          </Button>
        </div>

        <Button variant="outline" onClick={onCreate} className="min-h-10 gap-1.5 self-end sm:self-auto">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova regra
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredConfigurations.map((rule) => {
          const modelLabel =
            REMINDER_AI_MODELS.find((model) => model.value === rule.aiModel)?.label ?? rule.aiModel;
          const categoryName = rule.category ? CATEGORY_LABEL[rule.category] || rule.category : 'Consulta';

          return (
            <Card key={rule.id} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-normal',
                          rule.enabled ? 'border-success/20 bg-success/10 text-success' : 'text-muted-foreground'
                        )}
                      >
                        {rule.enabled ? 'Ativa' : 'Pausada'}
                      </Badge>

                      <Badge variant="secondary" className="font-normal text-[11px]">
                        {categoryName}
                      </Badge>

                      {rule.botoesConfirmacao ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-normal text-[11px] gap-1"
                        >
                          <Check className="h-3 w-3" /> 2 botões: Confirmar / Não Confirmar
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-muted text-muted-foreground font-normal text-[11px]"
                        >
                          Texto simples (sem confirmação)
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Atualizada em {formatDateTime(rule.updatedAt)}
                    </p>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    disabled={togglePending}
                    onCheckedChange={(enabled) => onToggle(rule, enabled)}
                    aria-label={rule.enabled ? `Pausar ${rule.name}` : `Ativar ${rule.name}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Envio</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {rule.sendTime} (Brasília)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Quando</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {daysInAdvanceLabel(rule.daysInAdvance)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Intervalo entre envios</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      <Timer className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {rule.intervalMinSeconds}–{rule.intervalMaxSeconds} s, aleatório
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Texto</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                      {rule.useAi ? (
                        <>
                          <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          IA ({modelLabel.replace(' (recomendado)', '')})
                        </>
                      ) : (
                        <>
                          <MessageSquareText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          Frases sorteadas
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                      Serviços
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {rule.serviceIds.length === 0 ? (
                        <span className="text-sm font-medium">Todos os serviços</span>
                      ) : (
                        rule.serviceIds.map((id) => (
                          <ServiceBadge key={id} name={`#${id}`} service={serviceById.get(id)} />
                        ))
                      )}
                    </dd>
                  </div>
                </dl>

                <Accordion type="single" collapsible>
                  <AccordionItem value="frases" className="rounded-md border px-3">
                    <AccordionTrigger className="min-h-11 py-2 text-sm hover:no-underline">
                      <span className="flex items-center gap-1.5">
                        <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
                        Frases de exemplo ({rule.examples.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-3">
                        {rule.examples.map((example, index) => (
                          <li key={index} className="rounded-md border bg-muted/30 p-3">
                            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Frase {index + 1}
                            </p>
                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {renderReminderPreview(example, clinicName, rule.daysInAdvance)}
                            </p>
                            {rule.botoesConfirmacao && (
                              <div className="mt-3 flex flex-col gap-1.5 border-t border-border/50 pt-2 max-w-sm">
                                <div className="flex items-center justify-center rounded-md border border-emerald-600/30 bg-emerald-500/10 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  ✓ Confirmar
                                </div>
                                <div className="flex items-center justify-center rounded-md border border-rose-600/30 bg-rose-500/10 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                  ✕ Não Confirmar
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                      <Button
                        variant="link"
                        className="mt-2 h-auto min-h-11 px-0"
                        onClick={() => onEdit(rule, 'frases')}
                      >
                        Editar frases
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="ghost"
                    className="min-h-11 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(rule)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remover
                  </Button>
                  <Button variant="outline" className="min-h-11 gap-1.5" onClick={() => onTest(rule)}>
                    <FlaskConical className="h-4 w-4" aria-hidden="true" />
                    Enviar teste
                  </Button>
                  <Button variant="outline" className="min-h-11 gap-1.5" onClick={() => onEdit(rule)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Editar
                  </Button>
                  <Button
                    className="min-h-11 gap-1.5"
                    onClick={() => onDispatch(rule)}
                    disabled={!rule.enabled}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Disparar agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default RulesTab;
