import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tag } from '@/types/crm';

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
}

const TagBadge = ({ tag, onRemove, className }: TagBadgeProps) => (
  <span
    className={cn(
      'inline-flex max-w-[140px] items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
      className
    )}
    style={{
      backgroundColor: `${tag.cor}1a`,
      borderColor: `${tag.cor}4d`,
      color: tag.cor,
    }}
    title={tag.nome}
  >
    <span className="truncate">{tag.nome}</span>
    {onRemove && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 rounded-full opacity-60 transition-opacity hover:opacity-100"
        aria-label={`Remover tag ${tag.nome}`}
      >
        <X className="h-3 w-3" />
      </button>
    )}
  </span>
);

export default TagBadge;
