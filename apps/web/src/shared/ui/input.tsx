import * as React from 'react';
import { cn } from './cn';
import { CLASE_CONTROL } from './control';

// D1: el marco común de los controles (control.ts) en lugar del de shadcn.
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        CLASE_CONTROL,
        'selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
