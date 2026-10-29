-- Se ejecuta como sa dentro de la base destino. Es idempotente.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF USER_ID(N'shopcart_app') IS NULL
    CREATE USER shopcart_app FOR LOGIN shopcart_app;

IF USER_ID(N'shopcart_migrator') IS NULL
    CREATE USER shopcart_migrator FOR LOGIN shopcart_migrator;

-- §10: el migrador tiene DDL y GRANT/DENY sobre esta base, sin ser administrador del servidor.
IF IS_ROLEMEMBER(N'db_owner', N'shopcart_migrator') = 0
    ALTER ROLE db_owner ADD MEMBER shopcart_migrator;

-- A-09: una fila por cada aplicación de un script. Los R__ acumulan una fila por versión aplicada.
IF OBJECT_ID(N'dbo.HistorialMigracion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HistorialMigracion (
        IDHistorialMigracion INT IDENTITY(1,1) NOT NULL,
        Script NVARCHAR(260) NOT NULL,
        Tipo CHAR(1) NOT NULL,
        Checksum BINARY(32) NOT NULL,
        FechaCreacion DATETIME2(3) NOT NULL
            CONSTRAINT DF_HistorialMigracion_FechaCreacion DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_HistorialMigracion PRIMARY KEY (IDHistorialMigracion),
        CONSTRAINT CK_HistorialMigracion_Tipo CHECK (Tipo IN ('V', 'R', 'S'))
    );

    -- Un V### o S### solo puede aplicarse una vez, aunque dos migradores corrieran a la vez.
    CREATE UNIQUE INDEX UX_HistorialMigracion_VersionadoUnaVez
        ON dbo.HistorialMigracion (Script) WHERE Tipo <> 'R';

    CREATE INDEX IX_HistorialMigracion_Script
        ON dbo.HistorialMigracion (Script, IDHistorialMigracion DESC) INCLUDE (Tipo, Checksum);
END;
