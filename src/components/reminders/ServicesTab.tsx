import { FormEvent, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import {
  REMINDER_SERVICE_COLORS,
  ReminderConfiguration,
  ReminderService,
  ReminderServiceColor,
} from '@/types/reminder';
import { ServiceBadge } from './reminderUi';

interface ServicesTabProps {
  services: ReminderService[];
  configurations: ReminderConfiguration[];
  uncategorized: string[];
  loading: boolean;
  saving: boolean;
  onSave: (input: {
    id?: number;
    name: string;
    color: ReminderServiceColor;
    active?: boolean;
    messageText?: string | null;
  }) => Promise<unknown>;
  onDelete: (service: ReminderService) => void;
}

const COLORS = Object.keys(REMINDER_SERVICE_COLORS) as ReminderServiceColor[];

const ColorPicker = ({
  value,
  onChange,
  idPrefix,
}: {
  value: ReminderServiceColor;
  onChange: (color: ReminderServiceColor) => void;
  idPrefix: string;
}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor">
    {COLORS.map((color) => (
      <button
        key={color}
        id={`${idPrefix}-${color}`}
        type="button"
        role="radio"
        aria-checked={value === color}
        aria-label={REMINDER_SERVICE_COLORS[color].label}
        onClick={() => onChange(color)}
        className={cn(
          'grid h-9 w-9 place-items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          value === color ? 'border-foreground' : 'border-transparent'
        )}
      >
        <span className={cn('h-5 w-5 rounded-full', REMINDER_SERVICE_COLORS[color].dot)} />
      </button>
    ))}
  </div>
);

const ServicesTab = ({
  services,
  configurations,
  uncategorized,
  loading,
  saving,
  onSave,
  onDelete,
}: ServicesTabProps) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ReminderServiceColor>('azul');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [editColor, setEditColor] = useState<ReminderServiceColor>('azul');

  const rulesFor = (serviceId: number) =>
    configurations.filter(
      (configuration) => configuration.serviceIds.length === 0 || configuration.serviceIds.includes(serviceId)
    );

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await onSave({ name: newName, color: newColor, messageText: newText });
    setNewName('');
    setNewText('');
  };

  const startEdit = (service: ReminderService) => {
    setEditingId(service.id);
    setEditName(service.name);
    setEditText(service.messageText ?? '');
    setEditColor(service.color);
  };

  const saveEdit = async (service: ReminderService) => {
    if (!editName.trim()) return;
    await onSave({
      id: service.id,
      name: editName,
      color: editColor,
      active: service.active,
      messageText: editText,
    });
    setEditingId(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviços</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            As categorias do campo "Serviços" da agenda. O que vale em "Como aparece na mensagem"
            entra no texto pela variável {'{{servico}}'}. Cada agendamento ainda pode ter um texto próprio.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState
              icon={<Tags />}
              title="Nenhum serviço cadastrado"
              description="Crie o primeiro serviço ao lado."
              className="py-10"
            />
          ) : (
            <ul className="divide-y">
              {services.map((service) => {
                const rules = rulesFor(service.id);
                return (
                  <li key={service.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {editingId === service.id ? (
                      <div className="flex w-full flex-col gap-3">
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="min-h-11"
                            aria-label="Nome do serviço"
                            maxLength={80}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-11 w-11 shrink-0"
                            onClick={() => saveEdit(service)}
                            disabled={saving || !editName.trim()}
                            aria-label="Salvar serviço"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-11 w-11 shrink-0"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancelar edição"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`edit-text-${service.id}`}>Como aparece na mensagem</Label>
                          <Input
                            id={`edit-text-${service.id}`}
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                            placeholder={service.name}
                            className="min-h-11"
                            maxLength={80}
                          />
                          <p className="text-xs text-muted-foreground">
                            Prévia: "Hoje é dia de {editText.trim() || editName.trim() || service.name}."
                          </p>
                        </div>
                        <ColorPicker value={editColor} onChange={setEditColor} idPrefix={`edit-${service.id}`} />
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <ServiceBadge name={service.name} service={service} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            {rules.length === 0
                              ? 'Nenhuma regra envia lembrete para este serviço.'
                              : `Regra: ${rules.map((rule) => rule.name).join(', ')}`}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Na mensagem: "{service.messageText?.trim() || service.name}"
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={service.active}
                            onCheckedChange={(active) =>
                              onSave({ id: service.id, name: service.name, color: service.color, active })
                            }
                            aria-label={service.active ? `Ocultar ${service.name}` : `Mostrar ${service.name}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => startEdit(service)}
                            aria-label={`Editar ${service.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(service)}
                            aria-label={`Remover ${service.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="service-name">Nome</Label>
                <Input
                  id="service-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ex.: Ultrassom"
                  className="min-h-11"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="service-text">Como aparece na mensagem (opcional)</Label>
                <Input
                  id="service-text"
                  value={newText}
                  onChange={(event) => setNewText(event.target.value)}
                  placeholder="Ex.: ultrassom abdominal"
                  className="min-h-11"
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-service-azul">Cor</Label>
                <ColorPicker value={newColor} onChange={setNewColor} idPrefix="new-service" />
              </div>
              <Button type="submit" className="min-h-11 w-full gap-1.5" disabled={saving || !newName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar serviço
              </Button>
            </form>
          </CardContent>
        </Card>

        {uncategorized.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Na agenda, sem categoria</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Nomes que vieram da importação e não batem com nenhum serviço. Criar a categoria liga
                os atendimentos a ela.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {uncategorized.map((name) => (
                  <li key={name} className="flex items-center justify-between gap-2">
                    <ServiceBadge name={name} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      onClick={() => onSave({ name, color: 'cinza' })}
                      disabled={saving}
                    >
                      Criar categoria
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ServicesTab;
