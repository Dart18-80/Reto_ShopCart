-- N-14: el Admin agrega un valor a un atributo (M, Azul…). Un valor repetido dentro del mismo atributo,
-- sin distinguir mayúsculas, responde 50205 (UQ_ValorAtributo_IDAtributoValor es la autoridad). Sin
-- @Orden, va después del último valor del atributo. Devuelve el valor.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearValorAtributo
    @IDAtributo     INT,
    @Valor          NVARCHAR(50),
    @Orden          SMALLINT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDValorAtributo INT, @MaximoOrden SMALLINT = 32767;

    BEGIN TRY
        BEGIN TRAN;

        -- Orden de bloqueo: el atributo y después el rango de sus valores. Dos altas en el mismo atributo
        -- se serializan; en atributos distintos no se esperan.
        IF NOT EXISTS (SELECT 1 FROM dbo.Atributo WITH (UPDLOCK, ROWLOCK) WHERE IDAtributo = @IDAtributo)
            THROW 50001, N'El atributo no existe.', 1;

        IF EXISTS (SELECT 1 FROM dbo.ValorAtributo WITH (UPDLOCK, HOLDLOCK)
                   WHERE IDAtributo = @IDAtributo AND Valor = @Valor)
            THROW 50205, N'El atributo ya tiene ese valor.', 1;

        IF @Orden IS NULL
        BEGIN
            IF (SELECT MAX(Orden) FROM dbo.ValorAtributo WITH (UPDLOCK, HOLDLOCK)
                WHERE IDAtributo = @IDAtributo) >= @MaximoOrden
                THROW 50003, N'No hay un orden disponible: indica uno.', 1;
            SET @Orden = (SELECT ISNULL(MAX(Orden), 0) + 1 FROM dbo.ValorAtributo WITH (UPDLOCK, HOLDLOCK)
                          WHERE IDAtributo = @IDAtributo);
        END

        INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, Orden) VALUES (@IDAtributo, @Valor, @Orden);
        SET @IDValorAtributo = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_ValorAtributo_IDAtributoValor%'
            THROW 50205, N'El atributo ya tiene ese valor.', 1;
        THROW;
    END CATCH

    SELECT v.IDValorAtributo, v.IDAtributo, v.Valor, v.Orden
    FROM   dbo.ValorAtributo AS v
    WHERE  v.IDValorAtributo = @IDValorAtributo;
END
GO
