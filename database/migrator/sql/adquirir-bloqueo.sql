-- Evita que dos migradores (por ejemplo, Compose y una ejecución manual) apliquen scripts a la vez.
-- El bloqueo es de sesión: dura mientras la conexión que lo pidió siga abierta.
-- Parámetros: @Recurso, @Espera (ms). Salida: @Resultado (< 0 si no se obtuvo).
EXEC @Resultado = sys.sp_getapplock
     @Resource    = @Recurso,
     @LockMode    = N'Exclusive',
     @LockOwner   = N'Session',
     @LockTimeout = @Espera;
