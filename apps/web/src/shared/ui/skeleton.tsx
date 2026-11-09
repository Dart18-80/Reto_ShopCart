import { cn } from './cn';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('esqueleto-brillo rounded-control bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
