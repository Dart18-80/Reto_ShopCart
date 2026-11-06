// Generado por `pnpm openapi:exportar` desde openapi.json (FE-13). No se edita a mano.

export interface paths {
    "/api/v1/admin/atributos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Atributos con sus valores, en orden (Admin) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Atributos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Atributo"][];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un atributo; nombre único; sin orden va al final (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearAtributo"];
                };
            };
            responses: {
                /** @description Atributo creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Atributo"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/atributos/{id}/valores": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Agrega un valor a un atributo; único dentro del atributo; sin orden va al final (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearValorAtributo"];
                };
            };
            responses: {
                /** @description Valor creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ValorAtributo"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categorias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Todas las categorías, activas o no, con cuántos productos tienen (M6-H02) (Admin) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categorías */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["CategoriaAdmin"][];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea una categoría; nombre único sin distinguir mayúsculas (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearCategoria"];
                };
            };
            responses: {
                /** @description Categoría creada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Categoria"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categorias/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Borra una categoría sin productos (N-14) (Admin) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categoría borrada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Edita una categoría; descripcion en null se quita (Admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarCategoria"];
                };
            };
            responses: {
                /** @description Categoría actualizada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Categoria"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/categorias/{id}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activa una categoría (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categoría activa */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Categoria"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/categorias/{id}/desactivar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Desactiva una categoría sin productos activos (N-14) (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categoría inactiva */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Categoria"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/configuracion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Parámetros del sistema (plazos, umbrales y envío gratis) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Parámetros */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Configuracion"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Cambia parámetros del sistema (montoEnvioGratis en null lo quita); queda en la bitácora */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarConfiguracion"];
                };
            };
            responses: {
                /** @description Parámetros actualizados */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Configuracion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/cupones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cupones (los más recientes primero), opcionalmente por estado */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    activo?: "true" | "false";
                    /** @description Columna del orden (por defecto, vigencia); el desempate es siempre la PK. */
                    orden?: "codigo" | "vigencia" | "usos";
                    /** @description asc o desc (por defecto, desc). */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de cupones */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un cupón (código en mayúsculas, único sin distinguir mayúsculas) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearCupon"];
                };
            };
            responses: {
                /** @description Cupón creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/cupones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Un cupón */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Cupón */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Edita un cupón: con usos no cambia tipo ni valor (409); el límite total no baja de los usos comprometidos (422) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarCupon"];
                };
            };
            responses: {
                /** @description Cupón actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/cupones/{id}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activa un cupón (idempotente) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Cupón */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/cupones/{id}/desactivar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Desactiva un cupón (idempotente) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Cupón */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cupon"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/envios/metodos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Cambia la tarifa, el nombre, los días estimados y el estado de un método (queda en la bitácora) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarMetodoEnvio"];
                };
            };
            responses: {
                /** @description Método actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["MetodoEnvio"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/exportaciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Mis exportaciones (las más recientes primero) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de exportaciones */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Exportacion"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/exportaciones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** El estado de una de mis exportaciones (una ajena responde 404) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description La exportación */
                200: {
                    headers: {
                        /** @description Segundos para volver a consultar, mientras está Pendiente o Procesando */
                        "Retry-After"?: number;
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Exportacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/exportaciones/{id}/archivo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Descarga el archivo de una exportación Completada (por streaming) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description El archivo, con Content-Disposition (el reporte y la fecha local) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/pdf": string;
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": string;
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Ya no está disponible */
                410: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pagos/en-revision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** E9-H04: los pagos en revisión manual (con pedido: su autorización ya no existía; sin pedido: un cobro capturado) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de pagos en revisión */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["PagoEnRevision"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pagos/{id}/resolver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** E9-H04: resuelve un pago en revisión con la evidencia de la pasarela: CobroVerificado, SinCobro (cancela el pedido) o Reembolsar (cobro sin pedido) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ResolverPago"];
                };
            };
            responses: {
                /** @description El pago resuelto */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ResolucionPago"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Error */
                504: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pedidos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Gestión de pedidos con filtros por estado, cliente y días de Guatemala (FechaPagoLocal), paginada */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                    pagina?: number;
                    tamano?: number;
                    /** @description Columna del orden (por defecto, fecha); el desempate es siempre la PK. */
                    orden?: "fecha" | "total" | "numero" | "estado";
                    /** @description asc o desc (por defecto, desc). */
                    direccion?: "asc" | "desc";
                    estado?: "Pagado" | "EnPreparacion" | "Despachado" | "Entregado" | "Cancelado" | "DevueltoParcial" | "Devuelto";
                    idCliente?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de pedidos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ResumenPedidoGestion"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pedidos/{id}/cancelar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancela el pedido completo (solo Pagado o EnPreparacion, motivo obligatorio): reingreso al inventario, cupón revertido y reembolso del total con envío (N-09), desde la gestión */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CancelarPedido"];
                };
            };
            responses: {
                /** @description Pedido cancelado; el reembolso queda Completado o, si la pasarela falló, Pendiente para el job */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cancelacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pedidos/{id}/devoluciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Registra una devolución por línea (Entregado o DevueltoParcial, dentro de 30 días): reingreso al inventario, estado derivado y reembolso proporcional sin envío (N-10) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RegistrarDevolucion"];
                };
            };
            responses: {
                /** @description Devolución registrada; el reembolso queda Completado o Pendiente para el job */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["DevolucionRegistrada"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/pedidos/{id}/estado": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mueve el pedido por su ciclo (Pagado → EnPreparacion → Despachado → Entregado) si sigue en estadoEsperado (N-08) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CambiarEstadoPedido"];
                };
            };
            responses: {
                /** @description El pedido con su nuevo estado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Pedido"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/productos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Productos paginados, activos o no, con filtros de categoría, estado y texto (Admin) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    categoria?: number;
                    activo?: "true" | "false";
                    texto?: string;
                    /** @description Columna del orden (por defecto, nombre); el desempate es siempre la PK. */
                    orden?: "nombre" | "categoria" | "recientes";
                    /** @description asc o desc (por defecto, asc). */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Productos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoResumen"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un producto; activo solo en una categoría activa (N-14) (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearProducto"];
                };
            };
            responses: {
                /** @description Producto creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/productos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Producto con variantes inactivas y existencia exacta (Admin) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Borra un producto sin historial (N-14) (Admin) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto borrado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Edita un producto; descripcion en null se quita; un activo no se mueve a una categoría inactiva (Admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarProducto"];
                };
            };
            responses: {
                /** @description Producto actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/productos/{id}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activa un producto; su categoría debe estar activa (N-14) (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto activo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/productos/{id}/desactivar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Desactiva un producto: deja de mostrarse en la tienda (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto inactivo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/productos/{id}/imagenes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reemplaza las imágenes del producto: una sola principal y órdenes únicos (N-19) (Admin) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["GuardarImagenes"];
                };
            };
            responses: {
                /** @description Producto con sus imágenes */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/productos/{id}/variantes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Crea una variante con su precio inicial; mismo conjunto de atributos que las demás (N-14) (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearVariante"];
                };
            };
            responses: {
                /** @description Producto con la variante nueva */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reembolsos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Reembolsos (los más recientes primero); estado=Fallido es la lista para resolver a mano */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    estado?: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de reembolsos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Reembolso"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reembolsos/{id}/reintentar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Vuelve a Pendiente un reembolso Fallido y lo procesa con la misma llave (nunca reembolsa dos veces) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description El estado del reembolso después del reintento */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: {
                                /** @enum {string} */
                                estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                                idReembolso: number;
                            };
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reembolsos/{id}/resolver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** E9-H04: resuelve a mano un reembolso Fallido (ResueltoManual, con motivo y referencia); cuenta como reembolsado. Solo pasado un plazo desde su último intento (409 REEMBOLSO_RECIENTE). Antes consulta la pasarela: si ya lo procesó, queda Completado y responde 409 REEMBOLSO_YA_PROCESADO; si el cobro nunca se capturó o se anuló, queda NoAplica y responde 409 REEMBOLSO_SIN_COBRO */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ResolverReembolso"];
                };
            };
            responses: {
                /** @description El reembolso resuelto */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Reembolso"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado. Con REEMBOLSO_YA_PROCESADO y REEMBOLSO_SIN_COBRO el reembolso sí cambió: detalles.estado dice en qué estado quedó (Completado o NoAplica) */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResolucionReembolso"];
                    };
                };
                /** @description Error */
                504: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reportes/eventos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Dashboard en tiempo real (SSE): avisa cuando cambian las ventas o los carritos
         * @description E9-H02 (A-25): `text/event-stream`. El token va en `Authorization` (usa fetch con el cuerpo como stream, no EventSource). Al conectar llega `versiones` con las versiones actuales; después, `cambio` con `{ dominio, version }` (como máximo uno por dominio cada 2 s) y un comentario de latido cada 15 s. El `id` de cada evento son las versiones (`ventas3.carritos7`): al reconectar, envía `Last-Event-ID` y `versiones` dirá si hay que recargar. El stream se cierra al vencer el token o al revocarse la sesión.
         */
        get: {
            parameters: {
                query?: never;
                header?: {
                    "last-event-id"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Stream de eventos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/reportes/{reporte}/exportaciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Solicita la exportación de un reporte del dashboard a Excel o PDF (asíncrona). Los filtros son los del mismo reporte; una solicitud igual vigente devuelve la existente */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    reporte: "resumen" | "ventas" | "ventas-por-categoria" | "top-productos" | "carritos-abandonados";
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["SolicitarExportacion"];
                };
            };
            responses: {
                /** @description Solicitud aceptada; Location apunta a su estado */
                202: {
                    headers: {
                        /** @description La URL del estado de la exportación */
                        Location?: string;
                        /** @description Segundos para volver a consultar, mientras está Pendiente o Procesando */
                        "Retry-After"?: number;
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Exportacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/variantes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Borra una variante sin historial (N-14) (Admin) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Variante borrada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Edita el SKU o la combinación; con historial la combinación no cambia (N-14) (Admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarVariante"];
                };
            };
            responses: {
                /** @description Producto actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/variantes/{id}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activa una variante (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/variantes/{id}/desactivar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Desactiva una variante: deja de mostrarse en la tienda (Admin) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoAdmin"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/variantes/{id}/precio": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Cambia el precio: cierra la versión vigente e inserta la nueva en una transacción (N-02) (Admin) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CambiarPrecio"];
                };
            };
            responses: {
                /** @description Historial con la versión nueva: de la versión más reciente a la más antigua */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["VersionPrecio"][];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/variantes/{id}/precios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Historial de precios de una variante (Admin) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Historial: de la versión más reciente a la más antigua */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["VersionPrecio"][];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Inicio de sesión (mensaje genérico ante credenciales incorrectas) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["Login"];
                };
            };
            responses: {
                /** @description Sesión abierta. El refresh token llega en la cookie httpOnly "refresh" (Path=/api/v1/auth). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Sesion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cierra la sesión: revoca el refresh token de la cookie y la borra */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión cerrada (también si no había cookie) */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rota el refresh token de la cookie y emite otro access token (A-07)
         * @description Reusar un refresh ya rotado revoca toda la sesión: 401 REFRESH_REUTILIZADO.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión renovada. El refresh token llega en la cookie httpOnly "refresh" (Path=/api/v1/auth). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Sesion"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/registro": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Registro de un cliente (N-15: el registro público solo crea Clientes) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["Registro"];
                };
            };
            responses: {
                /** @description Cliente creado con la sesión abierta. El refresh token llega en la cookie httpOnly "refresh" (Path=/api/v1/auth). */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Sesion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/bitacora": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Bitácora (lo más reciente primero) con filtros por módulo, entidad y días de Guatemala, paginada en el servidor (RF-09) */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                    pagina?: number;
                    tamano?: number;
                    modulo?: "Catalogo" | "Inventario" | "Cupones" | "Pedidos" | "Envios" | "Usuarios" | "Configuracion";
                    entidad?: string;
                    /** @description Columna del orden (por defecto, fecha); el desempate es siempre la PK. */
                    orden?: "fecha";
                    /** @description asc o desc (por defecto, desc). */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de la bitácora */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["RegistroBitacora"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carrito": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** El carrito del cliente o del invitado, con el estado de cada línea (vacío si no hay) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Carrito. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carrito/avisos/vistos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca como vistas las alertas "El precio cambió de Q… a Q…" (N-02) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Carrito sin alertas pendientes. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carrito/cupon": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Aplica un cupón como vista previa (N-12): cada causa de rechazo tiene su código; el mínimo trae lo que falta */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["AplicarCupon"];
                };
            };
            responses: {
                /** @description Carrito con el descuento repartido por línea. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        /** Quita el cupón del carrito (idempotente) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Carrito sin cupón. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carrito/lineas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Agrega una variante o suma la cantidad si ya está (N-06). Un invitado sin carrito recibe la cookie al crearlo (20 por minuto por IP) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["AgregarLineaCarrito"];
                };
            };
            responses: {
                /** @description Carrito actualizado. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carrito/lineas/{idLinea}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Quita una línea del carrito (una de otro carrito responde 404, RF-01) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    idLinea: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Carrito actualizado. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Cambia la cantidad de una línea (para quitarla, DELETE); una NoDisponible solo se elimina */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    idLinea: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarCantidadCarrito"];
                };
            };
            responses: {
                /** @description Carrito actualizado. Un invitado recibe el carrito de su cookie httpOnly "carrito_invitado" (Path=/api/v1). */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Carrito"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/categorias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Categorías activas de la tienda (público) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Categorías */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["CategoriaPublica"][];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/checkout/sesion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** La sesión de pago Activa del cliente */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión Activa */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["SesionPago"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Inicia el pago: reserva todo o nada por MinutosReserva y congela precios, descuento y envío (01 §6.1) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["IniciarSesionPago"];
                };
            };
            responses: {
                /** @description El carrito no cambió: la misma sesión Activa */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["SesionPago"];
                        };
                    };
                };
                /** @description Sesión creada (la anterior, si había, se canceló y liberó) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["SesionPago"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Cancela la sesión de pago y libera reservas y cupón (no si hay un pago en curso) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Sesión cancelada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/checkout/sesion/pagos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Paga la sesión: autoriza, crea el pedido (atómico) y captura. Idempotency-Key obligatoria: la misma llave da el mismo resultado (01 §6.2) */
        post: {
            parameters: {
                query?: never;
                header: {
                    "idempotency-key": string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["Pagar"];
                };
            };
            responses: {
                /** @description Ya pagado: el pedido existente */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Pedido"];
                        };
                    };
                };
                /** @description Pedido creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Pedido"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Error */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Error */
                504: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/carritos-abandonados": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Carritos abandonados (N-13) cuya última actividad cae en el periodo, con su monto potencial perdido
         * @description Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.
         */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                    pagina?: number;
                    tamano?: number;
                    /** @description Columna del orden (por defecto, total); el desempate es siempre la PK. */
                    orden?: "inactividad" | "total";
                    /** @description asc o desc (por defecto, desc). */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de carritos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["CarritoAbandonado"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/resumen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ventas, pedidos, ticket promedio, devoluciones, envío y carritos abandonados del periodo
         * @description Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.
         */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description El resumen */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ResumenDashboard"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/top-productos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Los 10 productos más vendidos por unidades
         * @description Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.
         */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Hasta 10 productos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoVendido"][];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/ventas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ventas y pedidos por día, semana (desde el lunes) o mes
         * @description Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.
         */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                    agrupacion?: "dia" | "semana" | "mes";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Un periodo por fila, en orden */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["VentasDelPeriodo"][];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dashboard/ventas-por-categoria": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ventas y unidades por categoría, de mayor a menor
         * @description Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.
         */
        get: {
            parameters: {
                query?: {
                    desde?: string;
                    hasta?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Una categoría por fila */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["VentasDeCategoria"][];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/departamentos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Los 22 departamentos de Guatemala */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Departamentos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: {
                                idDepartamento: number;
                                nombre: string;
                            }[];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/departamentos/{id}/municipios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Los municipios de un departamento */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Municipios */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: {
                                idMunicipio: number;
                                nombre: string;
                            }[];
                        };
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/direcciones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Direcciones del cliente de la sesión (la predeterminada primero) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Direcciones */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Direccion"][];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Agrega una dirección (máximo 10; una sola predeterminada) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearDireccion"];
                };
            };
            responses: {
                /** @description Dirección creada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Direccion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/direcciones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Una dirección propia (una ajena responde 404, RF-01) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Dirección */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Direccion"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Elimina una dirección propia (los pedidos guardan su copia) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Dirección eliminada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Edita una dirección propia (alias y referencia en null se quitan) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarDireccion"];
                };
            };
            responses: {
                /** @description Dirección actualizada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Direccion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/envios/metodos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Métodos de envío activos con su costo para el carrito actual (N-04: envío gratis sobre el subtotal después del cupón) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Métodos y envío gratis. Un invitado envía su cookie "carrito_invitado"; sin carrito, el monto es 0. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["MetodosEnvioParaCarrito"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Estado de la réplica, de SQL Server y de Redis
         * @description Pública: la usa el healthcheck de Docker. Solo devuelve estados; la versión y la hora de SQL Server van al log.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description La réplica atiende. `redis: "degradado"` si Redis no responde. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["EstadoSalud"];
                        };
                    };
                };
                /** @description Error inesperado */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description La base de datos no responde: la réplica sale de la rotación. */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["EstadoSalud"];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/ajustes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ajusta la existencia con motivo obligatorio; nunca en negativo ni por debajo de lo reservado (Operador o Admin; N-07) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RegistrarAjuste"];
                };
            };
            responses: {
                /** @description Movimiento registrado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Movimiento"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Regla de negocio incumplida */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/bodega": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Existencia en bodega: física más unidades pagadas por despachar (Operador o Admin; N-07) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    variante?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Existencia en bodega */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ExistenciaBodega"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/conciliacion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Variantes cuya existencia no cuadra con el kardex; debe estar vacía (Operador o Admin; N-07) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Descuadres */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Descuadre"][];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/entradas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Registra una entrada con motivo obligatorio y referencia opcional (Operador o Admin; N-16) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["RegistrarEntrada"];
                };
            };
            responses: {
                /** @description Movimiento registrado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Movimiento"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/existencias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Existencia física, reservada y disponible por variante (Operador o Admin) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    variante?: number;
                    texto?: string;
                    /** @description Columna del orden (por defecto, disponible); el desempate es siempre la PK. */
                    orden?: "sku" | "producto" | "disponible";
                    /** @description asc o desc (por defecto, asc). */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Existencias */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Existencia"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventario/kardex": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kardex de una variante, del movimiento más reciente al más antiguo (Operador o Admin) */
        get: {
            parameters: {
                query: {
                    pagina?: number;
                    tamano?: number;
                    variante: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Movimientos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Movimiento"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pedidos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Mis pedidos (los más recientes primero) */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de pedidos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ResumenPedido"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pedidos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Uno de mis pedidos, con su detalle y su historial de estados (uno ajeno responde 404) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description El pedido */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Pedido"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/pedidos/{id}/cancelar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancela el pedido completo (solo Pagado o EnPreparacion, motivo obligatorio): reingreso al inventario, cupón revertido y reembolso del total con envío (N-09) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CancelarPedido"];
                };
            };
            responses: {
                /** @description Pedido cancelado; el reembolso queda Completado o, si la pasarela falló, Pendiente para el job */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Cancelacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/productos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Búsqueda de la tienda (público): texto sin tildes ni mayúsculas, categoría, precio, disponibilidad, orden de lista blanca y paginación */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    texto?: string;
                    categoria?: number;
                    precioMin?: string;
                    precioMax?: string;
                    disponible?: "true" | "false";
                    /** @description relevancia (por defecto): primero lo que empieza con el texto; sin texto equivale a nombre ascendente. precio: el menor precio vigente entre las variantes activas. nombre. recientes: FechaCreacion descendente. Todo orden termina con idProducto, así la paginación no repite ni pierde productos. */
                    orden?: "relevancia" | "precio" | "nombre" | "recientes";
                    /** @description asc (por defecto) o desc; no aplica a relevancia ni a recientes. */
                    direccion?: "asc" | "desc";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Productos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoBusqueda"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/productos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Producto de la tienda (público): variantes activas, precio vigente y estado de existencia (N-06) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Producto */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["ProductoTienda"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listado paginado de usuarios (Admin), con filtro por rol y estado */
        get: {
            parameters: {
                query?: {
                    pagina?: number;
                    tamano?: number;
                    /** @description Columna del orden (por defecto, recientes); el desempate es siempre la PK. */
                    orden?: "nombre" | "correo" | "rol" | "recientes";
                    /** @description asc o desc (por defecto, desc). */
                    direccion?: "asc" | "desc";
                    rol?: "Cliente" | "Operador" | "Administrador";
                    activo?: "true" | "false";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Página de usuarios */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"][];
                            paginacion: components["schemas"]["Paginacion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Crea un Operador o un Admin con una contraseña inicial (N-15) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CrearUsuarioInterno"];
                };
            };
            responses: {
                /** @description Usuario creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Perfil del usuario de la sesión */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Perfil */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Edita el nombre y el teléfono propios (telefono: null lo quita) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarPerfil"];
                };
            };
            responses: {
                /** @description Perfil actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/usuarios/me/contrasena": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cambia la contraseña: corta las otras sesiones y renueva esta (5 intentos por minuto por usuario) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["CambiarContrasena"];
                };
            };
            responses: {
                /** @description Sesión nueva; el refresh token llega en la cookie "refresh" */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Sesion"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Demasiadas peticiones */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Edita el nombre o el rol de un usuario (Admin) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": components["schemas"]["ActualizarUsuario"];
                };
            };
            responses: {
                /** @description Usuario actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Datos inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/usuarios/{id}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activa un usuario */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usuario */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/usuarios/{id}/desactivar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Desactiva un usuario: revoca sus sesiones y su access token deja de servir (N-15) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Usuario */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            datos: components["schemas"]["Usuario"];
                        };
                    };
                };
                /** @description Sin sesión o token inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description El rol no tiene permiso */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No existe o pertenece a otro cliente */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Conflicto de estado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ActualizarCantidadCarrito: {
            cantidad: number;
        };
        ActualizarCategoria: {
            descripcion?: string | null;
            /** @enum {string} */
            ilustracion?: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            nombre?: string;
        };
        ActualizarConfiguracion: {
            diasExpiracionCarritoInvitado?: number;
            diasGarantiaPrecio?: number;
            diasPlazoDevolucion?: number;
            horasCarritoAbandonado?: number;
            maxIntentosPagoRechazados?: number;
            maxLineasCarrito?: number;
            minutosReserva?: number;
            montoEnvioGratis?: string | null;
            umbralUltimasUnidades?: number;
        };
        ActualizarCupon: {
            /** @description Se guarda en mayúsculas; único sin distinguir mayúsculas */
            codigo?: string;
            descripcion?: string;
            /** Format: date-time */
            fechaFin?: string;
            /** Format: date-time */
            fechaInicio?: string;
            idCategoria?: number | null;
            limiteUsosPorCliente?: number;
            limiteUsosTotal?: number;
            montoMaximoDescuento?: string | null;
            montoMinimoCompra?: string;
            /** @enum {string} */
            tipo?: "Porcentaje" | "MontoFijo";
            valor?: string;
        };
        ActualizarDireccion: {
            alias?: string | null;
            direccionLinea?: string;
            esPredeterminada?: boolean;
            idMunicipio?: number;
            nombreRecibe?: string;
            referencia?: string | null;
            telefonoRecibe?: string;
        };
        ActualizarMetodoEnvio: {
            activo: boolean;
            costo: string;
            diasMax: number;
            diasMin: number;
            nombre: string;
        };
        ActualizarPerfil: {
            nombre?: string;
            telefono?: string | null;
        };
        ActualizarProducto: {
            descripcion?: string | null;
            idCategoria?: number;
            nombre?: string;
        };
        ActualizarUsuario: {
            nombre?: string;
            /** @enum {string} */
            rol?: "Cliente" | "Operador" | "Administrador";
        };
        ActualizarVariante: {
            sku?: string;
            valores?: number[];
        };
        AgregarLineaCarrito: {
            cantidad: number;
            idVariante: number;
        };
        AplicarCupon: {
            codigo: string;
        };
        Atributo: {
            idAtributo: number;
            nombre: string;
            orden: number;
            valores: {
                idValorAtributo: number;
                orden: number;
                valor: string;
            }[];
        };
        AvisoFusionCarrito: {
            cantidadFinal: number;
            cantidadSolicitada: number;
            idVariante: number;
            producto: string;
            /** @enum {string} */
            tipo: "CantidadAjustada" | "NoFusionada";
        } | {
            mensaje: string;
            /** @enum {string} */
            tipo: "FusionPendiente";
        };
        CambiarContrasena: {
            contrasenaActual: string;
            contrasenaNueva: string;
        };
        CambiarEstadoPedido: {
            /** @enum {string} */
            estadoEsperado: "Pagado" | "EnPreparacion" | "Despachado" | "Entregado" | "Cancelado" | "DevueltoParcial" | "Devuelto";
            /** @enum {string} */
            estadoNuevo: "Pagado" | "EnPreparacion" | "Despachado" | "Entregado" | "Cancelado" | "DevueltoParcial" | "Devuelto";
            motivo?: string;
        };
        CambiarPrecio: {
            precio: string;
        };
        Cancelacion: {
            pedido: components["schemas"]["Pedido"];
            reembolso: {
                /** @enum {string} */
                estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                idReembolso: number;
            };
        };
        CancelarPedido: {
            motivo: string;
        };
        Carrito: {
            lineas: components["schemas"]["LineaCarrito"][];
            resumen: {
                cupon: {
                    codigo: string;
                    descripcion: string;
                } | null;
                /** @description N-12: el cupón dejó de ser válido y se quitó en esta consulta */
                cuponRetirado: {
                    codigo: string;
                    mensaje: string;
                    motivo: string;
                } | null;
                descuento: string;
                /** @description N-04: cuánto falta para el envío gratis, sobre el total después del cupón; null sin carrito o sin envío gratis */
                envioGratis: {
                    alcanzado: boolean;
                    faltante: string;
                    montoMinimo: string;
                } | null;
                lineas: number;
                puedePagar: boolean;
                subtotal: string;
                total: string;
                unidades: number;
            };
        };
        CarritoAbandonado: {
            cliente: {
                idUsuario: number;
                nombre: string;
            } | null;
            /** Format: date-time */
            fechaUltimaActividad: string;
            idCarrito: number;
            lineas: number;
            montoPotencial: string;
            unidades: number;
        };
        Categoria: components["schemas"]["CategoriaPublica"] & {
            activo: boolean;
        };
        CategoriaAdmin: components["schemas"]["Categoria"] & {
            productos: number;
        };
        CategoriaPublica: {
            descripcion: string | null;
            idCategoria: number;
            /** @enum {string} */
            ilustracion: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            nombre: string;
        };
        Configuracion: {
            diasExpiracionCarritoInvitado: number;
            diasGarantiaPrecio: number;
            diasPlazoDevolucion: number;
            /** Format: date-time */
            fechaActualizacion: string;
            horasCarritoAbandonado: number;
            maxIntentosPagoRechazados: number;
            maxLineasCarrito: number;
            minutosReserva: number;
            montoEnvioGratis: string | null;
            umbralUltimasUnidades: number;
        };
        CrearAtributo: {
            nombre: string;
            orden?: number;
        };
        CrearCategoria: {
            descripcion?: string;
            /** @enum {string} */
            ilustracion?: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            nombre: string;
        };
        CrearCupon: {
            /** @default true */
            activo: boolean;
            /** @description Se guarda en mayúsculas; único sin distinguir mayúsculas */
            codigo: string;
            descripcion: string;
            /** Format: date-time */
            fechaFin: string;
            /** Format: date-time */
            fechaInicio: string;
            idCategoria?: number;
            /** @default 1 */
            limiteUsosPorCliente: number;
            limiteUsosTotal: number;
            montoMaximoDescuento?: string;
            /**
             * @default {
             *       "d": [
             *         0
             *       ],
             *       "e": 0,
             *       "s": 1
             *     }
             */
            montoMinimoCompra: string;
            /** @enum {string} */
            tipo: "Porcentaje" | "MontoFijo";
            valor: string;
        };
        CrearDireccion: {
            alias?: string;
            direccionLinea: string;
            /** @default false */
            esPredeterminada: boolean;
            idMunicipio: number;
            nombreRecibe: string;
            referencia?: string;
            telefonoRecibe: string;
        };
        CrearProducto: {
            /** @default true */
            activo: boolean;
            descripcion?: string;
            idCategoria: number;
            nombre: string;
        };
        CrearUsuarioInterno: {
            contrasena: string;
            correo: string;
            nombre: string;
            /** @enum {string} */
            rol: "Operador" | "Administrador";
            telefono?: string;
        };
        CrearValorAtributo: {
            orden?: number;
            valor: string;
        };
        CrearVariante: {
            precio: string;
            sku: string;
            valores: number[];
        };
        Cupon: {
            activo: boolean;
            categoria: {
                idCategoria: number;
                nombre: string;
            } | null;
            codigo: string;
            descripcion: string;
            /** Format: date-time */
            fechaFin: string;
            /** Format: date-time */
            fechaInicio: string;
            idCupon: number;
            limiteUsosPorCliente: number;
            limiteUsosTotal: number;
            montoMaximoDescuento: string | null;
            montoMinimoCompra: string;
            /** @enum {string} */
            tipo: "Porcentaje" | "MontoFijo";
            usado: boolean;
            usosComprometidos: number;
            valor: string;
        };
        Descuadre: {
            existenciaFisica: number;
            existenciaUltimoMovimiento: number | null;
            idVariante: number;
            sku: string;
            sumaKardex: number;
        };
        DevolucionRegistrada: {
            devolucion: {
                idDevolucion: number;
                montoReembolso: string;
            };
            pedido: components["schemas"]["Pedido"];
            reembolso: {
                /** @enum {string} */
                estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                idReembolso: number;
            };
        };
        Direccion: {
            alias: string | null;
            direccionLinea: string;
            esPredeterminada: boolean;
            idDireccion: number;
            municipio: {
                departamento: {
                    idDepartamento: number;
                    nombre: string;
                };
                idMunicipio: number;
                nombre: string;
            };
            nombreRecibe: string;
            referencia: string | null;
            telefonoRecibe: string;
        };
        /** @description N-04: sobre el subtotal de productos después del cupón; null si no hay envío gratis */
        EnvioGratis: {
            alcanzado: boolean;
            faltante: string;
            montoMinimo: string;
        } | null;
        Error: {
            error: {
                /** @example PARAMETRO_INVALIDO */
                codigo: string;
                detalles?: unknown;
                /** @example Los datos enviados no son válidos. */
                mensaje: string;
                /** Format: uuid */
                requestId: string;
            };
        };
        ErrorResolucionReembolso: {
            error: {
                codigo: string;
                detalles?: {
                    /** @enum {string} */
                    estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                };
                mensaje: string;
                /** Format: uuid */
                requestId: string;
            };
        };
        EstadoSalud: {
            /** @enum {string} */
            baseDatos: "ok" | "caida";
            /**
             * @description ok: todo responde · degradado: Redis caído, se sigue vendiendo (RNF-2) · caido: sin base
             * @enum {string}
             */
            estado: "ok" | "degradado" | "caido";
            /** @example api-1 */
            instancia: string;
            /** @enum {string} */
            redis: "ok" | "degradado";
        };
        Existencia: {
            activo: boolean;
            descripcionAtributos: string;
            disponible: number;
            existenciaFisica: number;
            idProducto: number;
            idVariante: number;
            producto: string;
            reservado: number;
            sku: string;
        };
        ExistenciaBodega: {
            existenciaBodega: number;
            existenciaFisica: number;
            idVariante: number;
            sku: string;
            unidadesPorDespachar: number;
        };
        Exportacion: {
            archivo: string | null;
            error: string | null;
            /** @enum {string} */
            estado: "Pendiente" | "Procesando" | "Completada" | "Fallida" | "Expirada";
            /** Format: date-time */
            fechaCreacion: string;
            /** Format: date-time */
            fechaExpiracion: string | null;
            /** Format: date-time */
            fechaFinalizacion: string | null;
            filtros: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            formato: "xlsx" | "pdf";
            idExportacion: number;
            intentos: number;
            /** @enum {string} */
            reporte: "resumen" | "ventas" | "ventas-por-categoria" | "top-productos" | "carritos-abandonados";
            tamanoBytes: number | null;
        };
        GuardarImagenes: {
            imagenes: {
                esPrincipal: boolean;
                orden: number;
                textoAlternativo: string;
                url: string;
            }[];
        };
        IniciarSesionPago: {
            idDireccion: number;
            idMetodoEnvio: number;
        };
        LineaCarrito: {
            ajustarA: number | null;
            aviso: {
                precioAnterior: string | null;
                /** @enum {string} */
                tipo: "PrecioGarantizado" | "BajoDePrecio" | "CambioDePrecio";
            } | null;
            cantidad: number;
            /** @description FE-16: el valor del atributo Color de la variante; null si no tiene */
            color: string | null;
            descripcionAtributos: string;
            descuentoLinea: string;
            /** @enum {string} */
            estado: "Disponible" | "CantidadExcedida" | "Agotado" | "NoDisponible";
            existencia: {
                /** @enum {string} */
                estado: "Disponible" | "UltimasUnidades" | "Agotado";
                unidadesRestantes: number | null;
            };
            /** Format: date-time */
            garantiaHasta: string;
            idLinea: number;
            idProducto: number;
            idVariante: number;
            /** @enum {string} */
            ilustracion: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            imagen: string | null;
            precioUnitario: string;
            producto: string;
            sku: string;
            /** @description N-12: lo que la línea puede comprar ahora; es lo que suman el subtotal y el descuento */
            totalComprable: string;
            totalLinea: string;
        };
        Login: {
            contrasena: string;
            correo: string;
        };
        MetodoEnvio: {
            activo: boolean;
            codigo: string;
            costo: string;
            diasMax: number;
            diasMin: number;
            idMetodoEnvio: number;
            nombre: string;
        };
        MetodosEnvioParaCarrito: {
            envioGratis: components["schemas"]["EnvioGratis"];
            metodos: {
                codigo: string;
                costo: string;
                diasMax: number;
                diasMin: number;
                envioGratis: boolean;
                idMetodoEnvio: number;
                nombre: string;
                tarifa: string;
                /** @description El total del carrito después del cupón más el costo de este método */
                totalConEnvio: string;
            }[];
            /** @description Lo que dura la reserva de los productos al iniciar el pago (MinutosReserva) */
            minutosReserva: number;
        };
        Movimiento: {
            cantidad: number;
            existenciaAnterior: number;
            existenciaResultante: number;
            /** Format: date-time */
            fecha: string;
            idDevolucion: number | null;
            idMovimientoKardex: number;
            idPedido: number | null;
            idVariante: number;
            motivo: string;
            referencia: string | null;
            signo: number;
            /** @enum {string} */
            tipo: "EntradaCompra" | "SalidaVenta" | "AjustePositivo" | "AjusteNegativo" | "ReingresoCancelacion" | "ReingresoDevolucion";
            usuario: {
                idUsuario: number;
                nombre: string;
            };
        };
        Pagar: {
            anioVencimiento: number;
            cvv: string;
            mesVencimiento: number;
            numeroTarjeta: string;
        };
        Paginacion: {
            pagina: number;
            tamano: number;
            total: number;
            totalPaginas: number;
        };
        PagoEnRevision: {
            /** @enum {string} */
            causa: "AutorizacionInexistente" | "CobroSinPedido";
            cliente: {
                correo: string;
                idUsuario: number;
                nombre: string;
            };
            /** Format: date-time */
            fecha: string;
            idIntentoPago: number;
            idPedido: number | null;
            idTransaccion: string | null;
            monto: string;
            numeroPedido: string | null;
            tarjeta: {
                marca: string | null;
                ultimosDigitos: string | null;
            };
        };
        Pedido: {
            baseImponible: string;
            codigoCupon: string | null;
            costoEnvio: string;
            descuento: string;
            direccion: {
                departamento: string;
                direccionLinea: string;
                municipio: string;
                nombreRecibe: string;
                referencia: string | null;
                telefonoRecibe: string;
            };
            envio: {
                /** Format: date */
                fechaEstimadaEntrega: string;
                nombre: string;
            };
            estado: string;
            /** @enum {string} */
            estadoPago: "Confirmado" | "EnVerificacion";
            /** Format: date-time */
            fechaPago: string;
            /** Format: date */
            fechaPagoLocal: string;
            historial: {
                estadoAnterior: string | null;
                estadoNuevo: string;
                /** Format: date-time */
                fecha: string;
                motivo: string | null;
                rol: string;
            }[];
            idPedido: number;
            iva: string;
            lineas: {
                cantidad: number;
                cantidadDevuelta: number;
                categoria: string;
                descripcionVariante: string;
                descuentoLinea: string;
                idDetallePedido: number;
                idVariante: number;
                precioUnitario: string;
                producto: string;
                sku: string;
                totalLinea: string;
            }[];
            montoReembolsado: string;
            numeroPedido: string;
            /** @description M5-H01: si quien pide puede cancelarlo ahora (TransicionEstadoPedido para su rol y el pago no está en verificación) */
            puedeCancelar: boolean;
            subtotal: string;
            tarjeta: {
                marca: string;
                ultimosDigitos: string;
            };
            total: string;
        };
        ProductoAdmin: {
            activo: boolean;
            categoria: string;
            descripcion: string | null;
            idCategoria: number;
            idProducto: number;
            imagenes: {
                esPrincipal: boolean;
                idImagenProducto: number;
                orden: number;
                textoAlternativo: string;
                url: string;
            }[];
            nombre: string;
            variantes: {
                activo: boolean;
                descripcionAtributos: string;
                disponible: number;
                existenciaFisica: number;
                idVariante: number;
                precio: string | null;
                reservado: number;
                sku: string;
                valores: {
                    atributo: string;
                    idAtributo: number;
                    idValorAtributo: number;
                    valor: string;
                }[];
            }[];
        };
        ProductoBusqueda: {
            categoria: string;
            /** @description FE-16: los valores distintos del atributo Color de las variantes activas, en su orden, hasta 5 */
            colores: string[];
            disponible: boolean;
            idCategoria: number;
            idProducto: number;
            /** @enum {string} */
            ilustracion: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            imagenPrincipal: string | null;
            nombre: string;
            precioMinimo: string;
        };
        ProductoResumen: {
            activo: boolean;
            categoria: string;
            idCategoria: number;
            idProducto: number;
            nombre: string;
            variantes: number;
            variantesActivas: number;
        };
        ProductoTienda: {
            categoria: string;
            descripcion: string | null;
            /** @description N-02: días que el carrito garantiza el precio de una línea; lo configura el Admin */
            diasGarantiaPrecio: number;
            idCategoria: number;
            idProducto: number;
            /** @enum {string} */
            ilustracion: "Camisa" | "Pantalon" | "Vestido" | "Chaqueta" | "Tenis" | "Gorra";
            imagenes: {
                esPrincipal: boolean;
                idImagenProducto: number;
                orden: number;
                textoAlternativo: string;
                url: string;
            }[];
            nombre: string;
            variantes: {
                descripcionAtributos: string;
                /** @enum {string} */
                estadoExistencia: "Disponible" | "UltimasUnidades" | "Agotado";
                idVariante: number;
                precio: string;
                sku: string;
                unidadesRestantes?: number;
                valores: {
                    atributo: string;
                    idAtributo: number;
                    idValorAtributo: number;
                    /** @description ValorAtributo.Orden: la tienda muestra las opciones de cada atributo en este orden */
                    orden: number;
                    valor: string;
                }[];
            }[];
        };
        ProductoVendido: {
            idProducto: number;
            producto: string;
            unidades: number;
            ventas: string;
        };
        Reembolso: {
            /** @enum {string} */
            estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
            /** Format: date-time */
            fechaCompletado: string | null;
            /** Format: date-time */
            fechaCreacion: string;
            /** Format: date-time */
            fechaProximoIntento: string | null;
            /** Format: date-time */
            fechaResolucion: string | null;
            idDevolucion: number | null;
            idIntentoPago: number | null;
            idPedido: number | null;
            idReembolso: number;
            idTransaccionReembolso: string | null;
            intentos: number;
            monto: string;
            motivoResolucion: string | null;
            numeroPedido: string | null;
            /** @enum {string} */
            origen: "Cancelacion" | "Devolucion" | "SinPedido";
            referenciaResolucion: string | null;
            ultimoError: string | null;
        };
        RegistrarAjuste: {
            cantidad: number;
            idVariante: number;
            motivo?: string;
        };
        RegistrarDevolucion: {
            lineas: {
                cantidad: number;
                idDetallePedido: number;
            }[];
            motivo: string;
        };
        RegistrarEntrada: {
            cantidad: number;
            idVariante: number;
            motivo?: string;
            referencia?: string;
        };
        Registro: {
            contrasena: string;
            correo: string;
            nombre: string;
            telefono?: string;
        };
        RegistroBitacora: {
            accion: string;
            entidad: string;
            /** Format: date-time */
            fecha: string;
            idBitacora: string;
            idEntidad: string;
            modulo: string;
            requestId: string | null;
            usuario: {
                idUsuario: number;
                nombre: string;
            } | null;
            valorAnterior?: unknown;
            valorNuevo?: unknown;
        };
        ResolucionPago: {
            /** @enum {string} */
            estado: "Capturado" | "Anulado";
            /** Format: date-time */
            fechaResolucion: string;
            idIntentoPago: number;
            motivo: string;
            pedido: components["schemas"]["Pedido"] & (Record<string, never> | null);
            reembolso: {
                /** @enum {string} */
                estado: "Pendiente" | "Completado" | "Fallido" | "ResueltoManual" | "NoAplica";
                idReembolso: number;
            } | null;
            /** @enum {string} */
            resolucion: "CobroVerificado" | "SinCobro" | "Reembolsar";
        };
        ResolverPago: {
            motivo: string;
            /** @enum {string} */
            resolucion: "CobroVerificado" | "SinCobro" | "Reembolsar";
        };
        ResolverReembolso: {
            motivo: string;
            referencia: string;
        };
        ResumenDashboard: {
            carritosAbandonados: number;
            /** Format: date */
            desde: string;
            devoluciones: string;
            envio: string;
            /** Format: date */
            hasta: string;
            montoPotencialPerdido: string;
            pedidos: number;
            ticketPromedio: string;
            unidades: number;
            ventas: string;
        };
        ResumenPedido: {
            articulos: number;
            estado: string;
            /** @enum {string} */
            estadoPago: "Confirmado" | "EnVerificacion";
            /** Format: date-time */
            fechaPago: string;
            /** Format: date */
            fechaPagoLocal: string;
            idPedido: number;
            numeroPedido: string;
            total: string;
        };
        ResumenPedidoGestion: components["schemas"]["ResumenPedido"] & {
            cliente: {
                correo: string;
                idUsuario: number;
                nombre: string;
            };
        };
        Sesion: {
            /** @description JWT de 15 minutos: header Authorization: Bearer */
            accessToken: string;
            /** @description Solo al iniciar sesión o registrarse (N-05): líneas del carrito de invitado que no pasaron completas, o FusionPendiente si no se pudo pasar (la cookie se conserva) */
            avisosCarrito?: components["schemas"]["AvisoFusionCarrito"][];
            /** @description Segundos de vigencia del access token */
            expiraEn: number;
            usuario: {
                correo: string;
                idUsuario: number;
                nombre: string;
                /** @enum {string} */
                rol: "Cliente" | "Operador" | "Administrador";
            };
        };
        SesionPago: {
            codigoCupon: string | null;
            descuento: string;
            direccion: {
                departamento: string;
                direccionLinea: string;
                idMunicipio: number;
                municipio: string;
                nombreRecibe: string;
                referencia: string | null;
                telefonoRecibe: string;
            };
            envio: {
                costo: string;
                diasMax: number;
                diasMin: number;
                idMetodoEnvio: number;
                nombre: string;
            };
            /** Format: date-time */
            expiraEn: string;
            idSesion: number;
            intentosRechazados: number;
            lineas: {
                cantidad: number;
                descripcionAtributos: string;
                descuentoLinea: string;
                idProducto: number;
                idVariante: number;
                precioUnitario: string;
                producto: string;
                sku: string;
                totalLinea: string;
            }[];
            subtotal: string;
            total: string;
        };
        SolicitarExportacion: {
            /** @default {} */
            filtros: {
                [key: string]: unknown;
            };
            /** @enum {string} */
            formato: "xlsx" | "pdf";
        };
        Usuario: {
            activo: boolean;
            correo: string;
            idUsuario: number;
            nombre: string;
            /** @enum {string} */
            rol: "Cliente" | "Operador" | "Administrador";
            telefono: string | null;
        };
        ValorAtributo: {
            idAtributo: number;
            idValorAtributo: number;
            orden: number;
            valor: string;
        };
        VentasDeCategoria: {
            categoria: string;
            idCategoria: number;
            unidades: number;
            ventas: string;
        };
        VentasDelPeriodo: {
            pedidos: number;
            /** Format: date */
            periodo: string;
            ventas: string;
        };
        VersionPrecio: {
            idPrecioVariante: number;
            precio: string;
            usuario: {
                idUsuario: number;
                nombre: string;
            };
            /** Format: date-time */
            vigenteDesde: string;
            /** Format: date-time */
            vigenteHasta: string | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
