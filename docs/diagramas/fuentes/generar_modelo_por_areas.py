# Genera los .dot del modelo por áreas. Uso: python generar_modelo_por_areas.py && dot -Tsvg ../modelo-datos-area-a.dot -o ../modelo-datos-area-a.svg
import sys, re
import os
AQUI=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(AQUI,'tablas_y_relaciones.py'),encoding="utf-8").read()
# reuse table + relation definitions from er.py
ns={}
exec(src.split("def esc")[0].replace("out = sys.argv[1]","out=None"), ns)
T, R, mods, F = ns["T"], ns["R"], ns["mods"], ns["F"]
def esc(s): return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
badge={"PK":("#1F2937","#FFFFFF","PK"),"PF":("#1F2937","#FFFFFF","PK·FK"),"FK":("#DCE3EC","#1F2937","FK"),"UQ":("#FFF1C2","#7A5A00","UQ")}
AREAS={
 "A":("Área A — Usuarios, direcciones, catálogo e inventario",["seg","dir","cat","inv"],"TB"),
 "B":("Área B — Carrito, cupones y checkout",["car","chk"],"LR"),
 "C":("Área C — Pedidos, devoluciones y bitácora",["ped","bit"],"LR"),
}
AREA_OF={k:a for a,(_,ms,_) in AREAS.items() for k in ms}
def table_html(name, ghost=False):
    m,cols=T[name]; lbl,bg,col=mods[m]
    if ghost:
        pk=[c for c in cols if c.split(":")[0] in("PK","PF")]
        rows=[f'<tr><td colspan="3" bgcolor="#E5E7EB" align="left" cellpadding="6"><font color="#4B5563" point-size="13"><b>{name}</b></font></td></tr>']
        for c in pk:
            fl,n,ty=c.split(":",2)
            rows.append(f'<tr><td bgcolor="#9CA3AF" cellpadding="3"><font color="white" point-size="9"><b>PK</b></font></td><td align="left" cellpadding="4"><font point-size="12" color="#4B5563">{esc(n)}</font></td><td align="left" cellpadding="4"><font point-size="10" color="#9CA3AF">{esc(ty)}</font></td></tr>')
        rows.append(f'<tr><td colspan="3" align="left" cellpadding="4"><font point-size="10" color="#6B7280"><i>{lbl} · ver área {AREA_OF[m]}</i></font></td></tr>')
        return f'<table border="1" cellborder="0" cellspacing="0" color="#9CA3AF" bgcolor="#F9FAFB" style="dashed">{"".join(rows)}</table>'
    rows=[f'<tr><td colspan="3" bgcolor="{col}" align="left" cellpadding="7"><font color="white" point-size="15"><b>{name}</b></font></td></tr>']
    for c in cols:
        fl,n,ty=c.split(":",2)
        if fl in badge:
            b,fc,tx=badge[fl]; bt=f'<td bgcolor="{b}" cellpadding="3"><font color="{fc}" point-size="9"><b>{tx}</b></font></td>'
        else: bt='<td></td>'
        nn=f"<b>{esc(n)}</b>" if fl in("PK","PF") else esc(n)
        rows.append(f'<tr>{bt}<td align="left" cellpadding="4"><font point-size="12" color="#1F2937">{nn}</font></td><td align="left" cellpadding="4"><font point-size="11" color="#6B7280">{esc(ty)}</font></td></tr>')
    return f'<table border="1" cellborder="0" cellspacing="0" color="{col}" bgcolor="white">{"".join(rows)}</table>'
tails={"1":"teetee","01":"teeodot"}; heads={"n0":"crowodot","n1":"crowtee","01":"teeodot"}
for a,(title,ms,rd) in AREAS.items():
    own=[n for n,(m,_) in T.items() if m in ms]
    rels=[r for r in R if r[0] in own or r[1] in own]
    ghosts=sorted({x for r in rels for x in r[:2] if x not in own})
    L=[f'digraph ER{a} {{ graph [rankdir={rd}, fontname="{F}", bgcolor="white", pad=0.6, nodesep=0.7, ranksep=0.9, splines=ortho, fontsize=26, labelloc=t, label=<<b>ShopCart — Modelo entidad-relación</b><br/><font point-size="18" color="#374151">{title}</font><br/><font point-size="13" color="#6B7280">Tablas en gris: pertenecen a otra área y se muestran solo como referencia</font>>];',
       f'node [shape=plaintext, fontname="{F}"]; edge [color="#64748B", penwidth=1.4, dir=both, arrowsize=0.9];']
    for key in ms:
        lbl,bg,col=mods[key]
        L.append(f'subgraph cluster_{key} {{ label=<<b>{lbl}</b>>; fontsize=19; fontcolor="{col}"; style="rounded,filled"; fillcolor="{bg}"; color="{col}"; penwidth=1.5; margin=20;')
        for n in own:
            if T[n][0]==key: L.append(f'"{n}" [label=<{table_html(n)}>];')
        L.append('}')
    for g in ghosts: L.append(f'"{g}" [label=<{table_html(g,True)}>];')
    for p,c,pc,cc in rels:
        L.append(f'"{p}" -> "{c}" [arrowtail={tails[pc]}, arrowhead={heads[cc]}];')
    L.append('}')
    open(os.path.join(AQUI,"..",f"modelo-datos-area-{a.lower()}.dot"),"w",encoding="utf-8",newline="\n").write("\n".join(L))
print("ok")
