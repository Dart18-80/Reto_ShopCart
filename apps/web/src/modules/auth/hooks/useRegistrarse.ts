import { registrarse } from '../auth.api';
import { useAbrirSesion } from './useAbrirSesion';

export const useRegistrarse = () => useAbrirSesion(registrarse);
