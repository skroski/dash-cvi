import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, Plus, Settings2, Tag as TagIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags } from '@/hooks/useTags';
import { Tag, TAG_COLORS } from '@/types/crm';
import TagManagerDialog from './TagManagerDialog';

interface TagPickerProps {
  clientId: number;
  trigger?: React.ReactNode;
}

const TagPicker = ({ clientId, trigger }: TagPickerProps) => {
  const { tags, tagsPorCliente, createTag, assignTag, unassignTag } = useTags();
  const [open, setOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const clientTagIds = new Set((tagsPorCliente.get(clientId) || []).map((tag) => tag.id));

  const toggleTag = (tagId: number) => {
    if (clientTagIds.has(tagId)) {
      unassignTag.mutate({ clientId, tagId });
    } else {
      assignTag.mutate({ clientId, tagId });
    }
  };

  const handleQuickCreate = () => {
    const nome = search.trim();
    if (!nome) return;
    const cor = TAG_COLORS[tags.length % TAG_COLORS.length];
    createTag.mutate(
      { nome, cor },
      {
        onSuccess: (tag) => {
          assignTag.mutate({ clientId, tagId: tag.id });
          setSearch('');
        },
      }
    );
  };

  const exactMatch = tags.some((tag) => tag.nome.toLowerCase() === search.trim().toLowerCase());

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger || (
            <Button size="sm" variant="outline" className="h-7 gap-1 border-dashed px-2 text-xs">
              <TagIcon className="h-3 w-3" />
              Tags
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar ou criar tag..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? 'Nenhuma tag encontrada.' : 'Nenhuma tag criada ainda.'}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const selected = clientTagIds.has(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.nome}
                      onSelect={() => toggleTag(tag.id)}
                      className="gap-2"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.cor }}
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{tag.nome}</span>
                      <Check
                        className={cn('h-4 w-4 text-primary', selected ? 'opacity-100' : 'opacity-0')}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {search.trim() && !exactMatch && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value={`criar-${search}`}
                      onSelect={handleQuickCreate}
                      className="gap-2 text-primary"
                    >
                      <Plus className="h-4 w-4" />
                      Criar tag "{search.trim()}"
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground"
              onClick={() => {
                setOpen(false);
                setManagerOpen(true);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Gerenciar tags
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <TagManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
};

export default TagPicker;
