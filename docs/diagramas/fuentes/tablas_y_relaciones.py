import sys
out = sys.argv[1]
F = "Inter"
mods = {
 "seg":  ("Seguridad y usuarios", "#E8F0FE", "#3B6FD8"),
 "dir":  ("Direcciones",          "#E6F6F4", "#1F8A7A"),
 "cat":  ("Catálogo",             "#EAF6E8", "#3E8E3A"),
 "inv":  ("Inventario",           "#FFF4E0", "#C27C0E"),
 "car":  ("Carrito y cupones",    "#F1EAFB", "#7A4FC4"),
 "chk":  ("Checkout y pago",      "#FDEBF3", "#B8417A"),
 "ped":  ("Pedidos y devoluciones","#FDECEA", "#C2412D"),
 "bit":  ("Bitácora",             "#EEF0F2", "#5B6470"),
}
T = {}  # name -> (mod, cols)
def t(mod, name, *cols): T[name] = (mod, cols)
# cols: "flag:Nombre:tipo"  flag in PK FK UQ PF or ''
t("seg","Rol","PK:IDRol:int","UQ:Codigo:varchar(20)")
t("seg","Usuario","PK:IDUsuario:int","UQ:Correo:nvarchar(254)",":HashContrasena:varchar(255)","FK:IDRol:int",":Activo:bit")
t("seg","RefreshToken","PK:IDRefreshToken:bigint","FK:IDUsuario:int",":IDFamilia:uniqueidentifier","UQ:HashToken:binary(32)",":FechaUso:datetime2",":FechaRevocacion:datetime2")
t("dir","Departamento","PK:IDDepartamento:int","UQ:Nombre:nvarchar(50)")
t("dir","Municipio","PK:IDMunicipio:int","FK:IDDepartamento:int",":Nombre:nvarchar(80)")
t("dir","Direccion","PK:IDDireccion:int","FK:IDUsuario:int","FK:IDMunicipio:int",":NombreRecibe:nvarchar(100)",":TelefonoRecibe:varchar(8)",":EsPredeterminada:bit")
t("cat","Categoria","PK:IDCategoria:int","UQ:Nombre:nvarchar(80)",":Activo:bit")
t("cat","Producto","PK:IDProducto:int","FK:IDCategoria:int",":Nombre:nvarchar(150)",":NombreBusqueda:CI_AI",":Activo:bit")
t("cat","ImagenProducto","PK:IDImagenProducto:int","FK:IDProducto:int",":Url:nvarchar(500)",":Orden:smallint",":EsPrincipal:bit")
t("cat","Atributo","PK:IDAtributo:int","UQ:Nombre:nvarchar(50)")
t("cat","ValorAtributo","PK:IDValorAtributo:int","FK:IDAtributo:int",":Valor:nvarchar(50)")
t("cat","Variante","PK:IDVariante:int","FK:IDProducto:int","UQ:SKU:varchar(40)",":FirmaAtributos:varchar(200)",":ExistenciaFisica:int  ≥ 0",":Activo:bit")
t("cat","VarianteValorAtributo","PF:IDVariante:int","PK:IDAtributo:int","FK:IDValorAtributo:int")
t("cat","PrecioVariante","PK:IDPrecioVariante:int","FK:IDVariante:int",":Precio:decimal(12,2)",":VigenteDesde:datetime2",":VigenteHasta:datetime2 NULL")
t("inv","TipoMovimiento","PK:IDTipoMovimiento:int","UQ:Codigo:varchar(30)",":Signo:smallint ±1")
t("inv","MovimientoKardex","PK:IDMovimientoKardex:bigint","FK:IDVariante:int","FK:IDTipoMovimiento:int",":Cantidad:int > 0",":ExistenciaAnterior:int",":ExistenciaResultante:int",":Motivo:nvarchar(250)","FK:IDPedido:int NULL","FK:IDDevolucion:int NULL")
t("inv","Reserva","PK:IDReserva:bigint","FK:IDSesionCheckout:int","FK:IDVariante:int",":Cantidad:int",":Estado:varchar(10)",":FechaExpiracion:datetime2")
t("car","Carrito","PK:IDCarrito:int","FK:IDUsuario:int NULL",":HashTokenInvitado:binary(32)",":Estado:varchar(12)","FK:IDCupon:int NULL",":FechaUltimaActividad:datetime2")
t("car","LineaCarrito","PK:IDLineaCarrito:int","FK:IDCarrito:int","FK:IDVariante:int",":Cantidad:int","FK:IDPrecioVarianteGarantizado:int",":FechaGarantiaHasta:datetime2")
t("car","Cupon","PK:IDCupon:int","UQ:Codigo:varchar(30)",":Tipo:varchar(10)",":Valor:decimal(12,2)","FK:IDCategoria:int NULL",":LimiteUsosTotal:int",":UsosComprometidos:int ≤ límite")
t("car","UsoCupon","PK:IDUsoCupon:int","FK:IDCupon:int","FK:IDUsuario:int","UQ:IDSesionCheckout:int","FK:IDPedido:int NULL",":Estado:varchar(10)")
t("chk","MetodoEnvio","PK:IDMetodoEnvio:int","UQ:Codigo:varchar(20)",":Costo:decimal(12,2)",":DiasMin / DiasMax:tinyint")
t("chk","ParametroSistema","PK:IDParametroSistema:int = 1",":DiasGarantiaPrecio:tinyint",":MinutosReserva:smallint",":MontoEnvioGratis:decimal(12,2)",":HorasCarritoAbandonado:smallint")
t("chk","SesionCheckout","PK:IDSesionCheckout:int","FK:IDUsuario:int","FK:IDCarrito:int","FK:IDMetodoEnvio:int","FK:IDCupon:int NULL",":Estado:varchar(10)",":Subtotal · Descuento · Envío:decimal(12,2)",":Total:decimal(12,2)",":FechaExpiracion:datetime2")
t("chk","LineaSesionCheckout","PK:IDLineaSesionCheckout:int","FK:IDSesionCheckout:int","FK:IDVariante:int","FK:IDPrecioVariante:int",":Cantidad:int",":PrecioUnitario:decimal(12,2)",":DescuentoLinea:decimal(12,2)",":TotalLinea:decimal(12,2)")
t("chk","IntentoPago","PK:IDIntentoPago:bigint","FK:IDSesionCheckout:int","UQ:LlaveIdempotencia:uniqueidentifier",":Monto:decimal(12,2)",":Estado:varchar(12)",":IDTransaccionPasarela:varchar(64)")
t("ped","EstadoPedido","PK:IDEstadoPedido:int","UQ:Codigo:varchar(20)",":EsFinal:bit")
t("ped","TransicionEstadoPedido","PK:IDTransicionEstadoPedido:int","FK:IDEstadoOrigen:int","FK:IDEstadoDestino:int","FK:IDRol:int")
t("ped","Pedido","PK:IDPedido:int","UQ:NumeroPedido:SC-000000","FK:IDUsuario:int","UQ:IDSesionCheckout:int","UQ:IDIntentoPago:bigint","FK:IDEstadoPedido:int",":Subtotal · Descuento · Envío:decimal(12,2)",":Total · BaseImponible · IVA:decimal(12,2)",":MontoReembolsado:≤ Total",":FechaPagoLocal:date")
t("ped","DetallePedido","PK:IDDetallePedido:int","FK:IDPedido:int","FK:IDVariante:int","FK:IDPrecioVariante:int",":IDCategoria (copia):int",":Cantidad:int",":PrecioUnitario:decimal(12,2)",":DescuentoLinea:decimal(12,2)",":CantidadDevuelta:≤ Cantidad")
t("ped","HistorialEstadoPedido","PK:IDHistorialEstadoPedido:bigint","FK:IDPedido:int","FK:IDEstadoAnterior:int NULL","FK:IDEstadoNuevo:int","FK:IDUsuario:int",":Motivo:nvarchar(250)")
t("ped","Devolucion","PK:IDDevolucion:int","FK:IDPedido:int","FK:IDUsuario:int",":MontoReembolso:decimal(12,2)",":FechaLocal:date")
t("ped","DetalleDevolucion","PK:IDDetalleDevolucion:int","FK:IDDevolucion:int","FK:IDDetallePedido:int",":Cantidad:int > 0")
t("ped","Reembolso","PK:IDReembolso:int","FK:IDPedido:int","FK:IDDevolucion:int NULL",":Origen:varchar(12)",":Monto:decimal(12,2)",":Estado:varchar(10)","UQ:LlaveIdempotencia:uniqueidentifier")
t("bit","Bitacora","PK:IDBitacora:bigint",":Modulo · Entidad:varchar",":IDEntidad:varchar(50)",":Accion:varchar(20)",":ValorAnterior / Nuevo:JSON","FK:IDUsuario:int NULL",":RequestId:uniqueidentifier")

# relations: parent, child, parent_card ('1' or '01'), child_card ('n0' zero-many, 'n1' one-many, '01' zero-one)
R = [
 ("Rol","Usuario","1","n0"),("Usuario","RefreshToken","1","n0"),("Usuario","Direccion","1","n0"),
 ("Departamento","Municipio","1","n1"),("Municipio","Direccion","1","n0"),
 ("Categoria","Producto","1","n0"),("Producto","ImagenProducto","1","n0"),("Producto","Variante","1","n1"),
 ("Atributo","ValorAtributo","1","n0"),("Variante","VarianteValorAtributo","1","n1"),("ValorAtributo","VarianteValorAtributo","1","n0"),
 ("Variante","PrecioVariante","1","n1"),
 ("TipoMovimiento","MovimientoKardex","1","n0"),("Variante","MovimientoKardex","1","n0"),
 ("Usuario","Carrito","01","n0"),("Carrito","LineaCarrito","1","n0"),("Variante","LineaCarrito","1","n0"),("PrecioVariante","LineaCarrito","1","n0"),
 ("Cupon","Carrito","01","n0"),("Categoria","Cupon","01","n0"),
 ("Usuario","SesionCheckout","1","n0"),("Carrito","SesionCheckout","1","n0"),("MetodoEnvio","SesionCheckout","1","n0"),
 ("SesionCheckout","LineaSesionCheckout","1","n1"),("SesionCheckout","Reserva","1","n1"),("Variante","Reserva","1","n0"),
 ("SesionCheckout","IntentoPago","1","n0"),("Cupon","UsoCupon","1","n0"),("SesionCheckout","UsoCupon","1","01"),
 ("Usuario","Pedido","1","n0"),("SesionCheckout","Pedido","1","01"),("IntentoPago","Pedido","1","01"),("EstadoPedido","Pedido","1","n0"),
 ("Pedido","DetallePedido","1","n1"),("Variante","DetallePedido","1","n0"),("Pedido","HistorialEstadoPedido","1","n1"),
 ("EstadoPedido","TransicionEstadoPedido","1","n0"),("Rol","TransicionEstadoPedido","1","n0"),
 ("Pedido","Devolucion","1","n0"),("Devolucion","DetalleDevolucion","1","n1"),("DetallePedido","DetalleDevolucion","1","n0"),
 ("Pedido","Reembolso","1","n0"),("Devolucion","Reembolso","01","01"),
 ("Pedido","MovimientoKardex","01","n0"),("Devolucion","MovimientoKardex","01","n0"),
 ("Usuario","Bitacora","01","n0"),
]
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
L=[]
L.append(f'digraph ER {{ graph [rankdir=LR, fontname="{F}", fontsize=30, bgcolor="white", pad=0.6, nodesep=0.6, ranksep=1.1, splines=ortho, newrank=true, label=<<b>ShopCart — Modelo entidad-relación</b><br/><font point-size="16" color="#5B6470">SQL Server 2022 · las FK de auditoría (IDUsuario en precios, kardex, historial y devoluciones) no se dibujan para reducir el ruido</font>>, labelloc=t];')
L.append(f'node [shape=plaintext, fontname="{F}"]; edge [fontname="{F}", color="#64748B", penwidth=1.4, dir=both, arrowsize=0.9];')
badge={"PK":("#1F2937","#FFFFFF","PK"),"PF":("#1F2937","#FFFFFF","PK·FK"),"FK":("#DCE3EC","#1F2937","FK"),"UQ":("#FFF1C2","#7A5A00","UQ"),"":("white","white","")}
for key,(label,bg,col) in mods.items():
    L.append(f'subgraph cluster_{key} {{ label=<<b>{label}</b>>; fontsize=20; fontcolor="{col}"; style="rounded,filled"; fillcolor="{bg}"; color="{col}"; penwidth=1.6; margin=18;')
    for name,(m,cols) in T.items():
        if m!=key: continue
        rows=[f'<tr><td colspan="3" bgcolor="{col}" align="left" cellpadding="7"><font color="white" point-size="15"><b>{name}</b></font></td></tr>']
        for c in cols:
            fl,n,ty=c.split(":",2)
            b,fc,tx=badge[fl]
            badge_td = f'<td bgcolor="{b}" cellpadding="3"><font color="{fc}" point-size="9"><b>{tx}</b></font></td>' if tx else '<td></td>'
            nn = f"<b>{esc(n)}</b>" if fl in("PK","PF") else esc(n)
            rows.append(f'<tr>{badge_td}<td align="left" cellpadding="4"><font point-size="12" color="#1F2937">{nn}</font></td><td align="left" cellpadding="4"><font point-size="11" color="#6B7280">{esc(ty)}</font></td></tr>')
        L.append(f'"{name}" [label=<<table border="1" cellborder="0" cellspacing="0" color="{col}" bgcolor="white">{"".join(rows)}</table>>];')
    L.append('}')
tails={"1":"teetee","01":"teeodot"}
heads={"n0":"crowodot","n1":"crowtee","01":"teeodot"}
for p,c,pc,cc in R:
    L.append(f'"{p}" -> "{c}" [arrowtail={tails[pc]}, arrowhead={heads[cc]}];')
# legend
L.append(f'''legend [label=<<table border="1" cellborder="0" cellspacing="0" cellpadding="6" color="#9AA3AF" bgcolor="white">
<tr><td colspan="2" align="left"><b>Leyenda</b></td></tr>
<tr><td bgcolor="#1F2937"><font color="white" point-size="10"><b>PK</b></font></td><td align="left"><font point-size="12">Llave primaria (IDENTITY)</font></td></tr>
<tr><td bgcolor="#DCE3EC"><font point-size="10"><b>FK</b></font></td><td align="left"><font point-size="12">Llave foránea</font></td></tr>
<tr><td bgcolor="#FFF1C2"><font color="#7A5A00" point-size="10"><b>UQ</b></font></td><td align="left"><font point-size="12">Único (o índice único filtrado)</font></td></tr>
<tr><td>┼┼ ──&lt;○</td><td align="left"><font point-size="12">uno a cero-o-muchos</font></td></tr>
<tr><td>┼┼ ──&lt;┼</td><td align="left"><font point-size="12">uno a uno-o-muchos</font></td></tr>
<tr><td>┼○ ──○┼</td><td align="left"><font point-size="12">cero-o-uno</font></td></tr>
<tr><td colspan="2" align="left"><font point-size="11" color="#6B7280">Tablas inmutables: MovimientoKardex, HistorialEstadoPedido, Bitacora</font></td></tr>
</table>>];''')
L.append('}')
open(out,"w").write("\n".join(L))
