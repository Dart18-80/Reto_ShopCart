import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from './cn';
import { FOCO_VISIBLE } from './control';
import { Slot } from 'radix-ui';

// D1: botones con los tokens del sistema visual (radio de control, 44 px, foco con anillo al 30 %).
const buttonVariants = cva(
  `control-boton inline-flex shrink-0 items-center justify-center gap-2 rounded-control whitespace-nowrap transition-[color,background-color,border-color,box-shadow,scale,translate] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 ${FOCO_VISIBLE}`,
  {
    variants: {
      variant: {
        // El principal se levanta 3 px sobre su brillo; un ícono al final (nunca el spinner) avanza 4 px.
        default:
          'bg-primary text-primary-foreground shadow-glow-boton hover:bg-primario-hover motion-safe:active:scale-[.98] motion-safe:hover:-translate-y-[3px] [&>svg]:transition-[translate] [&>svg]:duration-(--dur-base) motion-safe:hover:[&>svg:last-child:not(.animate-spin)]:translate-x-1',
        // D1: lo destructivo en rojo (texto y borde); `oferta` es el rojo de texto del tema, AA en los dos temas.
        destructive:
          'border border-oferta/60 bg-card text-oferta hover:border-oferta hover:bg-destructive-suave focus-visible:border-oferta focus-visible:ring-oferta/30',
        outline:
          'border border-input bg-card shadow-xs hover:border-muted-foreground/60 hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        'ghost-destructive':
          'text-oferta hover:bg-destructive-suave focus-visible:border-oferta focus-visible:ring-oferta/30',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 has-[>svg]:px-3',
        xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-6 has-[>svg]:px-4',
        icon: 'size-11',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

/*
 * D1: mientras carga, un spinner con aria-hidden a la izquierda y el mismo texto, así el nombre accesible no
 * cambia. Para que el ancho tampoco cambie, el spinner y su separación salen del relleno izquierdo.
 */
type Tamano = NonNullable<VariantProps<typeof buttonVariants>['size']>;

// Relleno izquierdo + spinner + separación + relleno derecho = el relleno horizontal del tamaño (default: 4 + 16 + 4
// + 8 = 32, como px-4). Los tamaños de ícono no llevan texto: el spinner no se usa en ellos.
const RELLENO_CARGANDO: Partial<Record<Tamano, string>> = {
  default: 'gap-1 pl-1 pr-2',
  xs: 'gap-0.5 pl-0 pr-0.5 [&_svg]:size-3',
  sm: 'gap-1 pl-0 pr-1',
  lg: 'gap-2 pl-3 pr-3',
};

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  cargando = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Muestra el spinner (sin cambiar el texto ni el ancho). No deshabilita: eso lo decide quien lo usa. */
    cargando?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  const conSpinner = cargando && !asChild;
  const relleno = conSpinner && size ? RELLENO_CARGANDO[size] : undefined;

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }), relleno)}
      {...props}
    >
      {/* Slot exige un solo hijo: con asChild no hay spinner. */}
      {conSpinner ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
