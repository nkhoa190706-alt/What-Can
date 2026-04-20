import { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PageContainer({ title, description, action, children }: PageContainerProps) {
  return (
    <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm mt-1">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
