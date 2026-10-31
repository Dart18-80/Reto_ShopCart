-- A-18: el migrador escribe como un proceso del sistema. Los triggers de bitácora exigen Rol en
-- SESSION_CONTEXT; se fija antes de cada script (un script puede cambiarlo, como S004).
-- sys.sp_set_session_context y no SP_Sistema_EstablecerContexto: en los primeros V### el SP no existe.
EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = NULL;
EXEC sys.sp_set_session_context @key = N'Rol',       @value = N'Sistema';
EXEC sys.sp_set_session_context @key = N'RequestId', @value = NULL;
