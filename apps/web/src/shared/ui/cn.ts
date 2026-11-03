import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases de Tailwind: la última gana cuando dos chocan (`px-2` y `px-4`). */
export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}
