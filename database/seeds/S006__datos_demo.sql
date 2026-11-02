-- S006 (E7-H03, RNF-1): los datos demo con fechas relativas a hoy: ~200 clientes (demo001@shopcart.gt…,
-- contraseña en el README), 1,500 pedidos en los últimos 90 días con cancelaciones, devoluciones y su kardex,
-- carritos abandonados y un cupón por cada mensaje de rechazo de RF-05. Es determinista (@Semilla) e idempotente.
-- Corre como Sistema: el kardex solo acepta la fecha de cada evento con ese rol (N-07).
EXEC dbo.SP_Semilla_GenerarDatosDemo @Pedidos = 1500, @Dias = 90, @Semilla = 2026, @RolActor = 'Sistema';

EXEC dbo.SP_Sistema_EstablecerContexto;
