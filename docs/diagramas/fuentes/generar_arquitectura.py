# Genera el SVG de arquitectura. Uso: python generar_arquitectura.py ../arquitectura.svg
import sys
W,H=2040,1250
F="Inter, 'Segoe UI', Arial, sans-serif"
INK="#1F2937"; MUTED="#6B7280"; LINE="#374151"; BORDER="#CBD5E1"
out=[]
def a(s): out.append(s)
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def text(x,y,s,size=13,weight=400,color=INK,anchor="start",italic=False):
    st=' font-style="italic"' if italic else ''
    a(f'<text x="{x}" y="{y}" font-family="{F}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}"{st}>{esc(s)}</text>')
def rect(x,y,w,h,fill="white",stroke=BORDER,sw=1.5,rx=8,dash=None):
    d=f' stroke-dasharray="{dash}"' if dash else ''
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
def card(x,y,w,h,title,color,sub=None,lines=(),hh=34,size=13,gap=21,lx=14):
    rect(x,y,w,h)
    a(f'<path d="M{x} {y+8} a8 8 0 0 1 8 -8 h{w-16} a8 8 0 0 1 8 8 v{hh-8} h-{w} z" fill="{color}"/>')
    text(x+lx,y+22,title,15,700,"white")
    if sub: text(x+w-12,y+22,sub,11.5,500,"#FFFFFFD9",anchor="end")
    cy=y+hh+gap
    for ln in lines:
        if isinstance(ln,tuple): s,c,wt=ln
        else: s,c,wt=ln,INK,400
        text(x+lx,cy,s,size,wt,c); cy+=gap
def arrow(x1,y1,x2,y2,label=None,dash=False,color=LINE,lx=None,ly=None,lanchor="middle",lcolor=None):
    d=' stroke-dasharray="7 5"' if dash else ''
    mid="arrD" if dash else "arr"
    a(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.8"{d} marker-end="url(#{mid})"/>')
    if label:
        lx = (x1+x2)/2 if lx is None else lx
        ly = (min(y1,y2)-8) if ly is None else ly
        for i,l in enumerate(label.split("\n")):
            text(lx,ly+i*15,l,12,600,lcolor or color,anchor=lanchor)

a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
a('<defs>'
  f'<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="{LINE}"/></marker>'
  f'<marker id="arrD" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#4B5563"/></marker>'
  '</defs>')
a(f'<rect width="{W}" height="{H}" fill="white"/>')
# title
text(30,48,"ShopCart — Arquitectura y despliegue",28,700)
text(30,76,"Docker Compose en un solo host · monolito modular stateless con 2 réplicas balanceadas · SQL Server como fuente de verdad (acceso exclusivo por stored procedures)",14,400,MUTED)
# lanes
lanes=[("CLIENTE",20,300),("BORDE",320,650),("APLICACIÓN",670,1340),("DATOS",1360,1740),("OPERACIÓN",1760,2020)]
for i,(n,x1,x2) in enumerate(lanes):
    rect(x1,100,x2-x1,1130,fill="#F8FAFC" if i%2==0 else "#F1F5F9",stroke="none",rx=0)
    text((x1+x2)/2,124,n,12.5,700,"#475569",anchor="middle")
    a(f'<line x1="{x1+20}" y1="134" x2="{x2-20}" y2="134" stroke="#CBD5E1" stroke-width="1"/>')
# compose boundary
rect(330,150,1680,1060,fill="none",stroke="#64748B",sw=1.6,rx=12,dash="9 6")
a(f'<rect x="350" y="140" width="292" height="22" fill="#F1F5F9"/>')
text(358,156,"docker compose · red interna shopcart",13,700,"#475569")

# ---- CLIENTE
card(40,200,240,150,"Navegador","#3B6FD8",lines=[("React 18 + TypeScript (SPA)",INK,600),("Access JWT en memoria",MUTED,400),("Cookies httpOnly:",MUTED,400),("refresh · carrito_invitado",MUTED,400)])
# legend
rect(40,430,240,230)
text(54,456,"Leyenda",14,700)
arrow(56,484,116,484); text(128,488,"Petición síncrona",12.5)
arrow(56,514,116,514,dash=True,color="#4B5563"); text(128,518,"Opcional / one-shot",12.5)
for i,(c,n) in enumerate([("#3B6FD8","Cliente"),("#1F8A7A","Borde (balanceo)"),("#6D4BB8","Aplicación"),("#B9412E","Persistencia"),("#B7791F","Estado volátil"),("#5B6470","Operación")]):
    rect(56,536+i*19,14,12,fill=c,stroke="none",rx=2); text(78,546+i*19,n,12)
# startup
rect(40,690,240,250)
text(54,716,"Arranque ordenado",14,700)
for i,s in enumerate(["1. sqlserver  → healthy","2. db-migrator  → completed","3. redis  → healthy","4. api-1 · api-2  → /health OK","5. web (nginx)"]):
    text(54,746+i*24,s,12.5)
text(54,880,"docker compose up -d",12,600,"#475569")
text(54,902,"+ --profile observability",12,400,MUTED)
text(54,922,"(opcional)",12,400,MUTED)

# ---- BORDE
card(340,190,290,300,"web · nginx","#1F8A7A",sub=":8080",lines=[
  ("Balanceador de carga + estáticos",INK,700),
  ("upstream api (round-robin)",INK,600),
  ("  server api-1:3000  max_fails=3",MUTED,400),
  ("  server api-2:3000  max_fails=3",MUTED,400),
  ("/          → SPA (build de React)",INK,400),
  ("/static  → imágenes del catálogo",INK,400),
  ("/api      → upstream api",INK,400),
  ("Cabeceras de seguridad · gzip",MUTED,400),
  ("Un solo origen (SameSite=Strict)",MUTED,400)],gap=24)
arrow(280,285,340,285,"HTTP\n:8080",lx=303,ly=258)
# demo callout
rect(340,530,290,160,fill="#FFFBEB",stroke="#F2C94C")
text(354,556,"Tolerancia a fallas (demo)",14,700,"#7A5A00")
for i,s in enumerate(["docker compose stop api-1","→ nginx marca api-1 como caída","→ api-2 atiende todo el tráfico","→ el header X-Instancia lo muestra","Punto único: nginx (en K8s: Ingress","con réplicas o balanceador cloud)"]):
    text(354,582+i*18,s,12,600 if i==0 else 400,"#5C4400" if i<4 else "#8A6D1F")

# ---- APLICACIÓN
rect(690,170,630,1020,fill="#FAF8FF",stroke="#6D4BB8",sw=1.6,rx=10)
text(710,198,"API · Node 24 + Express 5 + TypeScript strict",16,700,"#4C2F99")
text(710,218,"Monolito modular stateless · 2 réplicas idénticas detrás del balanceador",12.5,400,MUTED)
card(720,235,240,70,"api-1","#6D4BB8",lines=[("INSTANCIA_ID=api-1 · :3000",MUTED,400)],gap=20)
card(720,355,240,70,"api-2","#6D4BB8",lines=[("INSTANCIA_ID=api-2 · :3000",MUTED,400)],gap=20)
arrow(630,270,720,270,"/api",ly=262)
arrow(630,390,720,390,"/api",ly=382)
rect(990,235,300,190)
text(1004,260,"Común a ambas réplicas",13.5,700)
for i,s in enumerate(["• Misma imagen y configuración","• Sin estado en memoria (stateless)","• GET /api/v1/health (BD + Redis)","• Header X-Instancia en respuestas","• Apagado ordenado con SIGTERM","• Escala a N réplicas sin cambios"]):
    text(1004,284+i*22,s,12.5)
# internal panel
rect(710,450,590,720,fill="white",stroke="#B9A7E6",sw=1.4,rx=8)
a('<path d="M710 458 a8 8 0 0 1 8 -8 h574 a8 8 0 0 1 8 8 v24 h-590 z" fill="#EDE7FA"/>')
text(726,472,"Arquitectura interna de cada réplica",13.5,700,"#4C2F99")
# layer stack
layers=[("Middlewares transversales","requestId · autenticar · autorizar(rol)","validar(Zod) · rateLimit · idempotencia"),
        ("Rutas + Controladores","HTTP ↔ caso de uso, sin lógica",None),
        ("Servicios","reglas de negocio y orquestación",None),
        ("Repositorios","solo EXEC SP con parámetros tipados",None)]
y=500
ys=[]
for i,(t,l1,l2) in enumerate(layers):
    h=74 if l2 else 56
    rect(730,y,270,h,fill="#F6F2FE",stroke="#B9A7E6")
    text(744,y+21,t,13,700,"#3B2380")
    text(744,y+40,l1,11.5,400,MUTED)
    if l2: text(744,y+57,l2,11.5,400,MUTED)
    ys.append((y,h)); y+=h+22
for i in range(len(ys)-1):
    y0=ys[i][0]+ys[i][1]; y1=ys[i+1][0]
    arrow(865,y0,865,y1)
# modules
mx=1020; text(mx,516,"13 módulos de dominio",13,700,"#3B2380")
mods=["auth","usuarios","direcciones","catalogo","inventario","carrito","cupones","envios","checkout","pedidos","reportes","bitacora","configuracion"]
for i,m in enumerate(mods):
    r,c=divmod(i,2)
    w=125 if not (i==12) else 260
    xx=mx+c*135; yy=528+r*36
    rect(xx,yy,w,28,fill="white",stroke="#B9A7E6",rx=5)
    text(xx+w/2,yy+19,m,12,600,"#3B2380",anchor="middle")
text(mx,800,"Un módulo solo usa a otro por su index.ts",11.5,400,MUTED)
text(mx,816,"(regla verificada con lint)",11.5,400,MUTED)
# adapters / jobs
yb=845
rect(730,yb,270,160,fill="#FDF2F8",stroke="#E9B8D3")
text(744,yb+24,"Puertos → Adaptadores",13,700,"#8A2E5D")
for i,s in enumerate(["PasarelaPago → PasarelaSimulada","Cache → Redis","ListaRevocados → Redis","Reloj → sistema"]):
    text(744,yb+50+i*24,s,12.5)
rect(1020,yb,260,160,fill="#FFF7E6",stroke="#EBC98A")
text(1034,yb+24,"Tareas periódicas",13,700,"#7A4E00")
text(1034,yb+42,"(coordinadas con sp_getapplock)",11.5,400,MUTED)
for i,s in enumerate(["Expirar sesiones · 1 min","Conciliar pagos · 2 min","Reintentar reembolsos · 5 min","Expirar carritos invitado · 1 h"]):
    text(1034,yb+66+i*23,s,12.5)
# footer
rect(730,1025,550,125,fill="#F8FAFC",stroke=BORDER)
text(744,1049,"Transversal",13,700)
for i,s in enumerate(["Configuración validada con Zod al arrancar · .env (sin secretos en el repo)",
                      "Errores centralizados: THROW 5xxxx en SP → código estable → HTTP",
                      "OpenAPI 3.1 en /api/docs generado desde los esquemas Zod",
                      "OpenTelemetry + pino (requestId, traceId, redacción de datos sensibles)"]):
    text(744,1073+i*21,s,12.2)

# ---- DATOS
card(1420,190,300,268,"sqlserver","#B9412E",sub="SQL Server 2022",lines=[
  ("Fuente de verdad del sistema",INK,700),
  ("READ_COMMITTED_SNAPSHOT ON",INK,400),
  ("SPs: UPDLOCK · XACT_ABORT",INK,400),
  ("Errores de negocio: THROW 5xxxx",INK,400),
  ("CHECK · UNIQUE · triggers",INK,400),
  ("Kardex, historial y bitácora",INK,400),
  ("inmutables",INK,400),
  ("Login shopcart_app: solo EXECUTE",MUTED,400),
  ("(DENY sobre tablas)",MUTED,400)],gap=22)
card(1420,540,300,190,"redis","#B7791F",sub="7",lines=[
  ("Estado compartido entre réplicas",INK,700),
  ("Rate limiting",INK,400),
  ("Lista de usuarios revocados",INK,400),
  ("Caché de reportes (por versión)",INK,400),
  ("Solo datos que se pueden perder",MUTED,400)],gap=24)
arrow(1320,300,1420,300,"mssql\nsolo EXEC SP",ly=268)
arrow(1320,630,1420,630,"ioredis",ly=620)

# ---- OPERACIÓN
card(1780,190,220,150,"db-migrator","#5B6470",sub="one-shot",lines=[
  ("V### migraciones (inmutables)",INK,400),("R__ SPs · vistas · funciones",INK,400),("S### semillas",INK,400),("Checksum en HistorialMigracion",MUTED,400)],gap=22,size=12.2)
arrow(1780,265,1720,265,"DDL +\nsemillas",dash=True,color="#4B5563",ly=238)
rect(1772,800,236,210,fill="none",stroke="#3E8E3A",sw=1.4,rx=10,dash="7 5")
text(1786,824,"perfil opcional: observability",12.5,700,"#2F6E2C")
card(1786,840,208,155,"otel-lgtm","#3E8E3A",sub="Grafana :3001",lines=[("Loki · logs",INK,400),("Tempo · trazas",INK,400),("Prometheus · métricas",INK,400),("Dashboards provisionados",MUTED,400)],gap=22,size=12.2)
arrow(1320,915,1786,915,"OTLP · trazas y logs de ambas réplicas",dash=True,color="#4B5563",ly=905)
a('</svg>')
open(sys.argv[1],"w").write("\n".join(out))
