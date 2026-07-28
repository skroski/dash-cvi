import { FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_SATISFACTION_TEMPLATE,
  renderSatisfactionPreview,
  SATISFACTION_TEMPLATE_VARIABLES,
  SatisfactionConfiguration,
  SatisfactionConfigurationInput,
} from '@/types/satisfaction';

interface SatisfactionConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configuration?: SatisfactionConfiguration | null;
  isPending: boolean;
  onSubmit: (input: SatisfactionConfigurationInput) => void;
}

const SatisfactionConfigurationDialog = ({
  open,
  onOpenChange,
  configuration,
  isPending,
  onSubmit,
}: SatisfactionConfigurationDialogProps) => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [googleFormUrl, setGoogleFormUrl] = useState('');
  const [googleFormId, setGoogleFormId] = useState('');
  const [googleTokenEntryId, setGoogleTokenEntryId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    DEFAULT_SATISFACTION_TEMPLATE
  );
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(configuration?.name ?? 'Pesquisa após atendimento');
    setEnabled(configuration?.enabled ?? true);
    setGoogleFormUrl(configuration?.googleFormUrl ?? '');
    setGoogleFormId(configuration?.googleFormId ?? '');
    setGoogleTokenEntryId(configuration?.googleTokenEntryId ?? '');
    setMessageTemplate(
      configuration?.messageTemplate ?? DEFAULT_SATISFACTION_TEMPLATE
    );
    setSubmitted(false);
  }, [configuration, open]);

  const normalizedEntryId = googleTokenEntryId.trim().replace(/^entry\./, '');
  const effectiveFormId = googleFormId.trim();
  const formUrlIsValid =
    /^https:\/\/docs\.google\.com\/forms\/(?:d\/e|d)\/[^/]+\/viewform/i.test(
      googleFormUrl.trim()
    );
  const templateHasLink = messageTemplate.includes('{{link_pesquisa}}');
  const isValid =
    name.trim().length > 0 &&
    formUrlIsValid &&
    effectiveFormId.length > 0 &&
    /^\d+$/.test(normalizedEntryId) &&
    messageTemplate.trim().length > 0 &&
    templateHasLink;

  const handleUrlChange = (value: string) => {
    setGoogleFormUrl(value);
  };

  const insertVariable = (token: string) => {
    setMessageTemplate((current) => {
      const separator = current.length > 0 && !/\s$/.test(current) ? ' ' : '';
      return `${current}${separator}${token}`;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid || isPending) return;

    onSubmit({
      name,
      enabled,
      googleFormUrl,
      googleFormId: effectiveFormId,
      googleTokenEntryId: normalizedEntryId,
      messageTemplate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {configuration ? 'Editar campanha' : 'Nova campanha de satisfação'}
          </DialogTitle>
          <DialogDescription>
            Conecte o formulário público e defina a mensagem individual que o n8n
            enviará uma única vez para cada tutor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="satisfaction-name">Nome da campanha</Label>
            <Input
              id="satisfaction-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Pesquisa após atendimento"
              className="min-h-11"
              aria-invalid={submitted && name.trim().length === 0}
              autoFocus
            />
            {submitted && name.trim().length === 0 && (
              <p className="text-sm text-destructive" role="alert">
                Informe um nome para identificar esta campanha.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">Google Forms</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Use a URL completa do formulário publicado, não o link encurtado.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="google-form-url">URL pública do formulário</Label>
                <div className="relative">
                  <Link2
                    className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="google-form-url"
                    type="url"
                    value={googleFormUrl}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="min-h-11 pl-9"
                    aria-invalid={submitted && !formUrlIsValid}
                  />
                </div>
                {submitted && !formUrlIsValid && (
                  <p className="text-sm text-destructive" role="alert">
                    Informe a URL completa de um formulário do Google.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="google-form-id">ID do formulário</Label>
                  <Input
                    id="google-form-id"
                    value={googleFormId}
                    onChange={(event) => setGoogleFormId(event.target.value)}
                    placeholder="ID da URL de edição"
                    className="min-h-11 font-mono text-xs"
                    aria-invalid={submitted && effectiveFormId.length === 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Copie da URL de edição, entre <code>/d/</code> e{' '}
                    <code>/edit</code>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="google-token-entry-id">
                    ID da pergunta de acompanhamento
                  </Label>
                  <Input
                    id="google-token-entry-id"
                    inputMode="numeric"
                    value={googleTokenEntryId}
                    onChange={(event) => setGoogleTokenEntryId(event.target.value)}
                    placeholder="Ex.: 123456789"
                    className="min-h-11 font-mono"
                    aria-invalid={submitted && !/^\d+$/.test(normalizedEntryId)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Aceita somente o número depois de <code>entry.</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <Label htmlFor="satisfaction-message">Mensagem de envio</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O link individual é obrigatório para associar a resposta ao tutor certo.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Variáveis da mensagem">
              {SATISFACTION_TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable.token}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 font-mono text-xs"
                  onClick={() => insertVariable(variable.token)}
                >
                  {variable.token}
                </Button>
              ))}
            </div>
            <Textarea
              id="satisfaction-message"
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              className="min-h-32 resize-y leading-6"
              aria-invalid={
                submitted &&
                (messageTemplate.trim().length === 0 || !templateHasLink)
              }
            />
            {submitted && !templateHasLink && (
              <p className="text-sm text-destructive" role="alert">
                Inclua a variável {'{{link_pesquisa}}'} na mensagem.
              </p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium">Prévia para o tutor</p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {renderSatisfactionPreview(messageTemplate)}
            </p>
          </div>

          <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border px-4 py-3">
            <div>
              <Label htmlFor="satisfaction-enabled">Campanha ativa</Label>
              <p className="text-xs text-muted-foreground">
                Campanhas pausadas são ignoradas pelo n8n e pelo webhook.
              </p>
            </div>
            <Switch
              id="satisfaction-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {isValid && (
            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Formulário e rastreamento prontos para salvar.
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {googleFormUrl && formUrlIsValid && (
              <Button type="button" variant="ghost" asChild className="sm:mr-auto">
                <a href={googleFormUrl} target="_blank" rel="noreferrer">
                  Abrir formulário
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {configuration ? 'Salvar alterações' : 'Criar campanha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SatisfactionConfigurationDialog;
