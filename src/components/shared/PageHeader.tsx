import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Âncora para o tour guiado. Marca o cabeçalho com `data-tour={dataTour}` e o
   * bloco de ações com `data-tour={dataTour}-actions`. Puramente informativo.
   */
  dataTour?: string;
}

const PageHeader = ({ title, description, actions, className, dataTour }: PageHeaderProps) => {
  return (
    <div
      className={cn('mb-6 flex flex-wrap items-start justify-between gap-3', className)}
      data-tour={dataTour}
    >
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div
          className="flex flex-wrap items-center gap-2"
          data-tour={dataTour ? `${dataTour}-actions` : undefined}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
