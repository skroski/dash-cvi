import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CornerDownLeft,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useQuickReplies } from '@/hooks/useQuickReplies';
import { UazapiQuickReply, UazapiQuickReplyInput } from '@/services/uazapi';
import FormattedMessage from './FormattedMessage';

interface QuickRepliesDialogProps {
  /** Coloca o texto do modelo no campo de mensagem. */
  onInsert: (text: string) => void;
  /** Chamado depois que o diálogo fecha, para o campo receber o foco. */
  onFocusField?: () => void;
  /** Sem conversa aberta dá para gerenciar os modelos, mas não usar. */
  canInsert: boolean;
}

type DialogView = 'list' | 'form';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const QuickRepliesDialog = ({
  onInsert,
  onFocusField,
  canInsert,
}: QuickRepliesDialogProps) => {
  const {
    replies,
    configured,
    loading,
    error,
    refreshing,
    refresh,
    saveReply,
    removeReply,
  } = useQuickReplies();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>('list');
  const [search, setSearch] = useState('');
  const [editingReply, setEditingReply] = useState<UazapiQuickReply | null>(null);
  const [replyToDelete, setReplyToDelete] = useState<UazapiQuickReply | null>(null);
  const [shortCut, setShortCut] = useState('');
  const [text, setText] = useState('');
  const [onWhatsApp, setOnWhatsApp] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) return;
    setView('list');
    setSearch('');
    setEditingReply(null);
    setReplyToDelete(null);
    setSubmitted(false);
  }, [open]);

  const filteredReplies = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return replies;
    return replies.filter(
      (reply) =>
        normalize(reply.shortCut).includes(term) ||
        normalize(reply.text).includes(term)
    );
  }, [replies, search]);

  const openCreateForm = () => {
    setEditingReply(null);
    setShortCut('');
    setText('');
    setOnWhatsApp(true);
    setSubmitted(false);
    setView('form');
  };

  const openEditForm = (reply: UazapiQuickReply) => {
    setEditingReply(reply);
    setShortCut(reply.shortCut);
    setText(reply.text);
    setOnWhatsApp(reply.onWhatsApp);
    setSubmitted(false);
    setView('form');
  };

  // Ao fechar, o Radix devolve o foco ao botão que abriu o diálogo. Depois de
  // inserir um modelo o foco tem que ir para o campo de mensagem, então a
  // devolução padrão é cancelada só nesse caso.
  const focusFieldOnClose = useRef(false);

  const handleInsert = (reply: UazapiQuickReply) => {
    onInsert(reply.text);
    focusFieldOnClose.current = true;
    setOpen(false);
  };

  const shortCutError = submitted && shortCut.trim().length === 0;
  const textError = submitted && text.trim().length === 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (!shortCut.trim() || !text.trim() || saveReply.isPending) return;

    const input: UazapiQuickReplyInput = {
      id: editingReply?.id,
      shortCut: shortCut.trim(),
      text: text.trim(),
      type: editingReply?.type ?? 'text',
      // Só type=text sincroniza com o app; editar um modelo já sincronizado
      // precisa reenviar a flag para não perder o vínculo.
      onWhatsApp: (editingReply?.type ?? 'text') === 'text' ? onWhatsApp : false,
      file: editingReply?.file,
      docName: editingReply?.docName,
    };

    saveReply.mutate(input, { onSuccess: () => setView('list') });
  };

  const listContent = () => {
    if (!configured) {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <AlertCircle className="mb-3 h-9 w-9 text-destructive" aria-hidden="true" />
          <p className="font-medium">Uazapi não configurada</p>
          <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
            Informe o servidor e o token da instância em Configurações para
            carregar os modelos do WhatsApp Business.
          </p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-3" role="status" aria-label="Carregando modelos">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <AlertCircle className="mb-3 h-9 w-9 text-destructive" aria-hidden="true" />
          <p className="font-medium">Não foi possível carregar os modelos</p>
          <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">
            {error instanceof Error ? error.message : 'Tente novamente em instantes.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    if (replies.length === 0) {
      return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MessageSquareText className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="font-medium">Nenhum modelo cadastrado</p>
          <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">
            Crie um modelo aqui ou cadastre as respostas rápidas no WhatsApp
            Business — elas aparecem nesta lista.
          </p>
          <Button type="button" size="sm" className="mt-4 gap-1.5" onClick={openCreateForm}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar primeiro modelo
          </Button>
        </div>
      );
    }

    if (filteredReplies.length === 0) {
      return (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <Search className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Nenhum modelo encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum atalho ou texto corresponde a “{search.trim()}”.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredReplies.map((reply) => {
          const isText = reply.type === 'text';

          return (
            <article
              key={reply.id}
              className="group rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="max-w-full truncate font-medium">
                    {reply.shortCut}
                  </Badge>
                  {reply.onWhatsApp && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <Smartphone className="h-3 w-3" aria-hidden="true" />
                      WhatsApp Business
                    </span>
                  )}
                  {!isText && (
                    <Badge variant="outline" className="font-normal uppercase">
                      {reply.type}
                    </Badge>
                  )}
                </div>

                <div className="flex shrink-0 items-start gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => openEditForm(reply)}
                    aria-label={`Editar modelo ${reply.shortCut}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setReplyToDelete(reply)}
                    aria-label={`Remover modelo ${reply.shortCut}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
                <FormattedMessage content={reply.text} />
              </div>

              <div className="mt-3 flex justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={canInsert && isText ? -1 : 0}>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        disabled={!canInsert || !isText}
                        onClick={() => handleInsert(reply)}
                      >
                        <CornerDownLeft className="h-4 w-4" aria-hidden="true" />
                        Usar modelo
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {!canInsert
                      ? 'Abra uma conversa para usar o modelo'
                      : !isText
                        ? 'Modelos com mídia só podem ser usados pelo WhatsApp Business'
                        : 'Coloca o texto no campo de mensagem para revisar antes de enviar'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Modelos de mensagem"
                className="flex-shrink-0 hover:border-primary hover:text-primary"
              >
                <MessageSquareText size={18} />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="font-semibold">Modelos de mensagem</p>
            <p className="text-xs text-muted-foreground">
              Respostas rápidas do WhatsApp Business
            </p>
          </TooltipContent>
        </Tooltip>

        <DialogContent
          className="flex max-h-[92vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            if (!focusFieldOnClose.current) return;
            focusFieldOnClose.current = false;
            // Cancela a devolução do foco ao botão; o campo de mensagem assume.
            event.preventDefault();
            onFocusField?.();
          }}
        >
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <div className="flex items-center gap-2">
              {view === 'form' && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="-ml-2 h-8 w-8"
                  onClick={() => setView('list')}
                  aria-label="Voltar para os modelos"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div>
                <DialogTitle>
                  {view === 'form'
                    ? editingReply
                      ? 'Editar modelo'
                      : 'Novo modelo'
                    : 'Modelos de mensagem'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {view === 'form'
                    ? 'Defina o atalho e o texto que será usado nas conversas.'
                    : 'Respostas rápidas da instância — inclui as cadastradas no WhatsApp Business.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {view === 'list' ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por atalho ou texto"
                    aria-label="Buscar modelo de mensagem"
                    className="pl-9"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => refresh()}
                      disabled={!configured || refreshing}
                      aria-label="Atualizar lista de modelos"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Atualizar modelos</TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  onClick={openCreateForm}
                  disabled={!configured}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Novo modelo
                </Button>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="p-5">{listContent()}</div>
              </ScrollArea>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 p-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="quick-reply-shortcut">Atalho</Label>
                    <Input
                      id="quick-reply-shortcut"
                      value={shortCut}
                      onChange={(event) => setShortCut(event.target.value)}
                      placeholder="Ex.: saudacao"
                      aria-invalid={shortCutError}
                      aria-describedby={
                        shortCutError ? 'quick-reply-shortcut-error' : 'quick-reply-shortcut-helper'
                      }
                      autoFocus
                    />
                    {shortCutError ? (
                      <p
                        id="quick-reply-shortcut-error"
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        Dê um atalho para identificar o modelo.
                      </p>
                    ) : (
                      <p id="quick-reply-shortcut-helper" className="text-xs text-muted-foreground">
                        É o nome pelo qual o modelo aparece aqui e no WhatsApp Business.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="quick-reply-text">Mensagem</Label>
                    <Textarea
                      id="quick-reply-text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Digite o texto do modelo..."
                      className="min-h-40 resize-y leading-6"
                      aria-invalid={textError}
                      aria-describedby={textError ? 'quick-reply-text-error' : undefined}
                    />
                    {textError && (
                      <p id="quick-reply-text-error" className="text-sm text-destructive" role="alert">
                        Escreva o texto do modelo.
                      </p>
                    )}
                  </div>

                  {(editingReply?.type ?? 'text') === 'text' ? (
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                      <Checkbox
                        id="quick-reply-onwhatsapp"
                        checked={onWhatsApp}
                        onCheckedChange={(checked) => setOnWhatsApp(checked === true)}
                        disabled={!!editingReply}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <Label htmlFor="quick-reply-onwhatsapp" className="font-medium">
                          Salvar também no WhatsApp Business
                        </Label>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {editingReply
                            ? editingReply.onWhatsApp
                              ? 'Este modelo veio do WhatsApp Business e a edição tenta manter a sincronização.'
                              : 'Este modelo existe só no painel. A API não permite convertê-lo em resposta rápida do app — crie um novo para isso.'
                            : 'Deixa o modelo disponível também nas respostas rápidas do celular.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                      <p className="text-sm leading-5 text-muted-foreground">
                        Modelo do tipo <span className="font-medium uppercase">{editingReply?.type}</span>:
                        o arquivo anexado é preservado, aqui você edita apenas o atalho e o texto.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="gap-2 border-t px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setView('list')}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="min-h-11 gap-1.5" disabled={saveReply.isPending}>
                  {saveReply.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  )}
                  {editingReply ? 'Salvar alterações' : 'Criar modelo'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(replyToDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setReplyToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              {replyToDelete?.onWhatsApp
                ? 'O modelo sai desta lista. Como ele está sincronizado, confira depois no celular se também saiu das respostas rápidas do WhatsApp Business.'
                : 'O modelo deixará de aparecer para a equipe.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {replyToDelete && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <Badge variant="secondary" className="font-medium">
                {replyToDelete.shortCut}
              </Badge>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                {replyToDelete.text}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeReply.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!replyToDelete || removeReply.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!replyToDelete) return;
                removeReply.mutate(replyToDelete, {
                  onSuccess: () => setReplyToDelete(null),
                });
              }}
            >
              {removeReply.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default QuickRepliesDialog;
