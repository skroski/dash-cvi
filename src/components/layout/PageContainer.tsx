import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer = ({ children, className }: PageContainerProps) => {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn('mx-auto w-full max-w-screen-2xl p-4 md:p-6', className)}>
        {children}
      </div>
    </div>
  );
};

export default PageContainer;
