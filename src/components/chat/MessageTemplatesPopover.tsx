import React, { useState, useMemo } from 'react';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bookmark,
  Plus,
  Trash2,
  Sparkles,
  MessageSquareQuote,
  BellRing,
  Smile,
  UserCheck,
  Smartphone,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { MessageTemplate, MessageTemplateCategory } from '@/types/messageTemplate';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { Conversation } from '@/types/chat';

interface MessageTemplatesPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateText: string) => void;
  searchQuery?: string;
  conversation?: Conversation;
  children?: React.ReactNode;
}

const CATEGORY_BADGES: Record<
  MessageTemplateCategory,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ComponentType<{ className?: string }> }
> = {
  whatsapp: { label: 'WhatsApp (Telefone)', variant: 'default', icon: Smartphone },
  atendimento: { label: 'Atendimento', variant: 'secondary', icon: MessageSquareQuote },
  lembrete: { label: 'Lembrete', variant: 'outline', icon: BellRing },
  pesquisa: { label: 'Pesquisa', variant: 'secondary', icon: Smile },
  personalizado: { label: 'Personalizado', variant: 'destructive', icon: UserCheck },
};

export const MessageTemplatesPopover: React.FC<MessageTemplatesPopoverProps> = ({
  open,
  onOpenChange,
  onSelectTemplate,
  searchQuery = '',
  conversation,
  children,
}) => {
  const {
    templates,
    uazapiCount,
    isLoadingUazapi,
    refetchUazapi,
    addCustomTemplate,
    deleteCustomTemplate,
    populateTemplate,
  } = useMessageTemplates();

  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newShortcut, setNewShortcut] = useState('');
  const [newContent, setNewContent] = useState('');

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (selectedCategory !== 'todos' && t.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [templates, selectedCategory]);

  const handleSelect = (template: MessageTemplate) => {
    const formatted = populateTemplate(template.content, conversation);
    onSelectTemplate(formatted);
    onOpenChange(false);
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    addCustomTemplate({
      title: newTitle,
      shortcut: newShortcut || `/${newTitle.toLowerCase().replace(/\s+/g, '-')}`,
      content: newContent,
    });

    setNewTitle('');
    setNewShortcut('');
    setNewContent('');
    setIsAddDialogOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        {children ? <PopoverTrigger asChild>{children}</PopoverTrigger> : <PopoverAnchor />}
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[92vw] max-w-[500px] p-0 shadow-xl border border-border/80 bg-popover/95 backdrop-blur-md rounded-xl"
        >
          <Command defaultValue={searchQuery} className="rounded-xl">
            <div className="flex items-center justify-between border-b px-3 py-2 bg-muted/40">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span>Modelos de Mensagens</span>
                <span className="text-[10px] text-muted-foreground font-normal">(Atalho: /)</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="Sincronizar modelos do WhatsApp"
                  onClick={() => refetchUazapi()}
                  disabled={isLoadingUazapi}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingUazapi ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Novo</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b px-3 py-1.5 overflow-x-auto bg-card/60">
              <Button
                type="button"
                variant={selectedCategory === 'todos' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs px-2 rounded-full shrink-0"
                onClick={() => setSelectedCategory('todos')}
              >
                Todos
              </Button>
              {(Object.keys(CATEGORY_BADGES) as MessageTemplateCategory[]).map((cat) => {
                const badge = CATEGORY_BADGES[cat];
                const Icon = badge.icon;
                return (
                  <Button
                    key={cat}
                    type="button"
                    variant={selectedCategory === cat ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-xs px-2 gap-1 rounded-full shrink-0"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{badge.label}</span>
                  </Button>
                );
              })}
            </div>

            <CommandInput
              placeholder="Buscar modelo ou digitar /..."
              className="border-none focus:ring-0 text-sm"
              value={searchQuery}
            />

            <CommandList className="max-h-[300px] p-1">
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                Nenhum modelo de mensagem encontrado.
              </CommandEmpty>

              <CommandGroup heading="Modelos disponíveis">
                {filteredTemplates.map((template) => {
                  const badge = CATEGORY_BADGES[template.category];
                  const Icon = badge.icon;
                  const previewText = populateTemplate(template.content, conversation);

                  return (
                    <CommandItem
                      key={template.id}
                      value={`${template.title} ${template.shortcut} ${template.content}`}
                      onSelect={() => handleSelect(template)}
                      className="flex flex-col items-start gap-1 p-2.5 rounded-lg cursor-pointer transition-colors aria-selected:bg-accent/80 hover:bg-accent/50"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="font-medium text-xs truncate">{template.title}</span>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {template.shortcut}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={badge.variant} className="text-[10px] h-5 px-1.5">
                            {badge.label}
                          </Badge>
                          {template.category === 'personalizado' && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomTemplate(template.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 w-full text-left pl-5">
                        {previewText}
                      </p>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Modal de Criação de Modelo Personalizado */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateCustom}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-primary" />
                Criar Modelo Personalizado
              </DialogTitle>
              <DialogDescription>
                Salve uma mensagem rápida para usar em qualquer conversa digitando o atalho escolhido.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título do Modelo</Label>
                <Input
                  id="title"
                  placeholder="Ex: Confirmação de Retorno"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="shortcut">Atalho (opcional)</Label>
                <Input
                  id="shortcut"
                  placeholder="Ex: /retorno"
                  value={newShortcut}
                  onChange={(e) => setNewShortcut(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="content">Conteúdo da Mensagem</Label>
                <Textarea
                  id="content"
                  placeholder="Olá {{nome_tutor}}, lembre-se que o retorno do {{nome_pet}} é amanhã!"
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Variáveis automáticas: <code className="bg-muted px-1 rounded">{"{{nome_tutor}}"}</code>, <code className="bg-muted px-1 rounded">{"{{nome_pet}}"}</code>, <code className="bg-muted px-1 rounded">{"{{servico}}"}</code>.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar Modelo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
