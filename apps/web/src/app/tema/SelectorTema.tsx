import { Moon, Sun } from 'lucide-react';
import { Button } from '../../shared/ui/button';
import { useTema } from './ProveedorTema';

export function SelectorTema() {
  const { tema, elegirTema } = useTema();
  const siguiente = tema === 'oscuro' ? 'claro' : 'oscuro';
  const Icono = tema === 'oscuro' ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Activar modo ${siguiente}`}
      onClick={() => {
        elegirTema(siguiente);
      }}
    >
      <Icono aria-hidden />
    </Button>
  );
}
