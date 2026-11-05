import { ingresar } from '../auth.api';
import { useAbrirSesion } from './useAbrirSesion';

export const useIngresar = () => useAbrirSesion(ingresar);
