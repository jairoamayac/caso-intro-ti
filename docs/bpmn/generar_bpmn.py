"""Genera los diagramas BPMN 2.0 (AS-IS y TO-BE) con coordenadas (BPMN DI).

Uso:  python3 docs/bpmn/generar_bpmn.py
Salida: docs/bpmn/as-is.bpmn y docs/bpmn/to-be.bpmn (abrir en Camunda Modeler o https://demo.bpmn.io)
"""
from pathlib import Path
from xml.sax.saxutils import escape

COL_W, ROW_H, LANE_HEADER, X0, Y0 = 160, 120, 30, 120, 40
SIZE = {
    "startEvent": (36, 36), "endEvent": (36, 36), "intermediateCatchEvent": (36, 36),
    "exclusiveGateway": (50, 50), "parallelGateway": (50, 50),
}
TASK = (120, 72)


def size(t):
    return SIZE.get(t, TASK)


def build(name, lanes, nodes, flows):
    """lanes: [(id, nombre, filas)]; nodes: [(id, tipo, nombre, lane, col, fila)]; flows: [(src, tgt, nombre)]"""
    lane_y, y = {}, Y0
    for lid, _, rows in lanes:
        lane_y[lid] = (y, rows * ROW_H)
        y += rows * ROW_H
    pool_h = y - Y0
    max_col = max(n[4] for n in nodes)
    pool_w = LANE_HEADER + (max_col + 1) * COL_W + 60

    pos = {}
    for nid, t, _, lane, col, row in nodes:
        w, h = size(t)
        ly, _ = lane_y[lane]
        cx = X0 + LANE_HEADER + 40 + col * COL_W + TASK[0] / 2
        cy = ly + row * ROW_H + ROW_H / 2
        pos[nid] = (cx - w / 2, cy - h / 2, w, h)

    inc = {n[0]: [] for n in nodes}
    out = {n[0]: [] for n in nodes}
    for i, (s, t, _) in enumerate(flows):
        fid = f"Flow_{i}"
        out[s].append(fid)
        inc[t].append(fid)

    p = []
    p.append('<?xml version="1.0" encoding="UTF-8"?>')
    p.append('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" '
             'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" '
             'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" '
             'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" '
             f'id="Defs_{name}" targetNamespace="http://niagara.example/pa">')
    p.append(f'  <bpmn:collaboration id="Collab_{name}">')
    p.append(f'    <bpmn:participant id="Pool_{name}" name="Autorización previa ({name.upper()})" processRef="Proc_{name}" />')
    p.append('  </bpmn:collaboration>')
    p.append(f'  <bpmn:process id="Proc_{name}" isExecutable="false">')
    p.append('    <bpmn:laneSet id="LaneSet_1">')
    for lid, lname, _ in lanes:
        p.append(f'      <bpmn:lane id="{lid}" name="{escape(lname)}">')
        for n in nodes:
            if n[3] == lid:
                p.append(f'        <bpmn:flowNodeRef>{n[0]}</bpmn:flowNodeRef>')
        p.append('      </bpmn:lane>')
    p.append('    </bpmn:laneSet>')
    for nid, t, nm, *_ in nodes:
        p.append(f'    <bpmn:{t} id="{nid}" name="{escape(nm)}">')
        for f in inc[nid]:
            p.append(f'      <bpmn:incoming>{f}</bpmn:incoming>')
        for f in out[nid]:
            p.append(f'      <bpmn:outgoing>{f}</bpmn:outgoing>')
        if t == "intermediateCatchEvent":
            p.append('      <bpmn:timerEventDefinition id="Timer_%s" />' % nid)
        p.append(f'    </bpmn:{t}>')
    for i, (s, t, nm) in enumerate(flows):
        nattr = f' name="{escape(nm)}"' if nm else ""
        p.append(f'    <bpmn:sequenceFlow id="Flow_{i}"{nattr} sourceRef="{s}" targetRef="{t}" />')
    p.append('  </bpmn:process>')

    p.append(f'  <bpmndi:BPMNDiagram id="Diagram_{name}">')
    p.append(f'    <bpmndi:BPMNPlane id="Plane_{name}" bpmnElement="Collab_{name}">')
    p.append(f'      <bpmndi:BPMNShape id="Pool_{name}_di" bpmnElement="Pool_{name}" isHorizontal="true">'
             f'<dc:Bounds x="{X0}" y="{Y0}" width="{pool_w}" height="{pool_h}" /></bpmndi:BPMNShape>')
    for lid, _, _ in lanes:
        ly, lh = lane_y[lid]
        p.append(f'      <bpmndi:BPMNShape id="{lid}_di" bpmnElement="{lid}" isHorizontal="true">'
                 f'<dc:Bounds x="{X0 + LANE_HEADER}" y="{ly}" width="{pool_w - LANE_HEADER}" height="{lh}" /></bpmndi:BPMNShape>')
    for nid, t, *_ in nodes:
        x, y, w, h = pos[nid]
        extra = ' isMarkerVisible="true"' if t == "exclusiveGateway" else ""
        p.append(f'      <bpmndi:BPMNShape id="{nid}_di" bpmnElement="{nid}"{extra}>'
                 f'<dc:Bounds x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" /></bpmndi:BPMNShape>')
    for i, (s, t, _) in enumerate(flows):
        sx, sy, sw, sh = pos[s]
        tx, ty, tw, th = pos[t]
        scx, scy, tcx, tcy = sx + sw / 2, sy + sh / 2, tx + tw / 2, ty + th / 2
        if tcx > scx + 1:  # hacia adelante
            a, b = (sx + sw, scy), (tx, tcy)
            mid = (a[0] + b[0]) / 2
            pts = [a, (mid, a[1]), (mid, b[1]), b] if abs(a[1] - b[1]) > 1 else [a, b]
        elif abs(tcx - scx) <= 1:  # misma columna, vertical
            pts = [(scx, sy + sh), (tcx, ty)] if tcy > scy else [(scx, sy), (tcx, ty + th)]
        else:  # hacia atrás: rodear por arriba
            top = min(sy, ty) - 22
            pts = [(scx, sy), (scx, top), (tcx, top), (tcx, ty)]
        p.append(f'      <bpmndi:BPMNEdge id="Flow_{i}_di" bpmnElement="Flow_{i}">')
        for x, y in pts:
            p.append(f'        <di:waypoint x="{x:.0f}" y="{y:.0f}" />')
        p.append('      </bpmndi:BPMNEdge>')
    p.append('    </bpmndi:BPMNPlane>')
    p.append('  </bpmndi:BPMNDiagram>')
    p.append('</bpmn:definitions>')
    return "\n".join(p)


# ----------------------------------------------------------------------------- AS-IS
AS_IS_LANES = [
    ("L_med", "Médico / Consulta", 1),
    ("L_coord", "Coordinador PA (manual + Excel)", 2),
    ("L_pag", "Pagador (EPS / Prepagada / Sisbén)", 1),
    ("L_pac", "Paciente", 1),
]
AS_IS_NODES = [
    ("S", "startEvent", "Necesidad de servicio", "L_med", 0, 0),
    ("A1", "task", "Enviar orden (sistema citas / fax / teléfono)", "L_med", 1, 0),
    ("A2", "userTask", "Transcribir caso al Excel compartido", "L_coord", 2, 0),
    ("A3", "userTask", "Login portal o llamar para verificar cobertura", "L_coord", 3, 0),
    ("G1", "exclusiveGateway", "¿Requiere PA?", "L_coord", 4, 0),
    ("A4", "userTask", "Llamar a consulta para pedir documentos", "L_coord", 5, 0),
    ("A5", "task", "Buscar y enviar notas / resultados", "L_med", 6, 0),
    ("G2", "exclusiveGateway", "¿Documentación completa? (68% NO, 2,3 contactos)", "L_coord", 7, 0),
    ("A6", "userTask", "Compilar paquete y radicar (portal / fax / WhatsApp)", "L_coord", 8, 0),
    ("P1", "task", "Revisar solicitud (mismo día a 14+ días)", "L_pag", 9, 0),
    ("T1", "intermediateCatchEvent", "Esperar 1 día", "L_coord", 9, 1),
    ("A7", "userTask", "Consultar estado en portal manualmente", "L_coord", 10, 1),
    ("G3", "exclusiveGateway", "¿Hay decisión?", "L_coord", 11, 1),
    ("G4", "exclusiveGateway", "¿Aprobada? (18,4% negada)", "L_coord", 12, 0),
    ("A8", "userTask", "Registrar aprobación y notificar", "L_coord", 13, 0),
    ("A9", "task", "Agendar y prestar servicio", "L_med", 14, 0),
    ("E1", "endEvent", "Servicio prestado", "L_med", 15, 0),
    ("G5", "exclusiveGateway", "¿Hay tiempo para revisar?", "L_coord", 13, 1),
    ("E2", "endEvent", "Negación abandonada (59%)", "L_coord", 14, 1),
    ("A10", "userTask", "Programar llamada de revisión (48-72 h)", "L_coord", 14, 1),
    ("G6", "exclusiveGateway", "¿Revocada?", "L_coord", 15, 1),
    ("A11", "task", "Preparar carta de tutela con pruebas", "L_pac", 15, 0),
    ("E3", "endEvent", "Tutela radicada (31% éxito)", "L_pac", 16, 0),
]
# corregir colisión E2/A10: E2 debajo en la fila de paciente es más claro
AS_IS_NODES = [n if n[0] != "E2" else ("E2", "endEvent", "Negación abandonada (59%)", "L_pac", 13, 0) for n in AS_IS_NODES]
AS_IS_FLOWS = [
    ("S", "A1", ""), ("A1", "A2", ""), ("A2", "A3", ""), ("A3", "G1", ""),
    ("G1", "A9", "No"), ("G1", "A4", "Sí"), ("A4", "A5", ""), ("A5", "G2", ""),
    ("G2", "A4", "No"), ("G2", "A6", "Sí"), ("A6", "P1", ""), ("P1", "T1", ""),
    ("T1", "A7", ""), ("A7", "G3", ""), ("G3", "T1", "No"), ("G3", "G4", "Sí"),
    ("G4", "A8", "Sí"), ("A8", "A9", ""), ("A9", "E1", ""),
    ("G4", "G5", "No"), ("G5", "E2", "No"), ("G5", "A10", "Sí"), ("A10", "G6", ""),
    ("G6", "A8", "Sí"), ("G6", "A11", "No"), ("A11", "E3", ""),
]

# ----------------------------------------------------------------------------- TO-BE
TO_BE_LANES = [
    ("L_med", "Médico (dentro de la HCE)", 1),
    ("L_plat", "Plataforma PA (automatización + IA)", 2),
    ("L_coord", "Gestor clínico PA (excepciones)", 1),
    ("L_pag", "Pagador (API / RPA)", 1),
    ("L_pac", "Paciente", 1),
]
TO_BE_NODES = [
    ("S", "startEvent", "Orden creada en la HCE", "L_med", 0, 0),
    ("B1", "serviceTask", "Capturar orden (API / OCR de fax) y normalizar", "L_plat", 1, 0),
    ("B2", "serviceTask", "Verificar elegibilidad y regla PA (pagador + CUPS)", "L_plat", 2, 0),
    ("G1", "exclusiveGateway", "¿Requiere PA?", "L_plat", 3, 0),
    ("B3", "serviceTask", "Extraer evidencia de la HCE (IA) y armar checklist", "L_plat", 4, 0),
    ("G2", "exclusiveGateway", "¿Completitud = 100%?", "L_plat", 5, 0),
    ("M1", "userTask", "Completar solo lo faltante (in-basket, 1 clic)", "L_med", 5, 0),
    ("B4", "businessRuleTask", "Puntuar necesidad médica y riesgo de negación", "L_plat", 6, 0),
    ("G3", "exclusiveGateway", "¿Riesgo alto / alto costo?", "L_plat", 7, 0),
    ("C1", "userTask", "Revisión clínica del caso", "L_coord", 7, 0),
    ("B5", "serviceTask", "Radicar vía adaptador del pagador (API / RPA)", "L_plat", 8, 0),
    ("P1", "task", "Decidir solicitud", "L_pag", 9, 0),
    ("B6", "receiveTask", "Monitorear estado (webhook / RPA) y SLA", "L_plat", 9, 1),
    ("G4", "exclusiveGateway", "¿Resultado?", "L_plat", 10, 1),
    ("C2", "userTask", "Escalar con el pagador (SLA vencido)", "L_coord", 10, 0),
    ("B7", "serviceTask", "Notificar y autoagendar", "L_plat", 13, 0),
    ("N1", "task", "Recibir cita y recordatorios", "L_pac", 14, 0),
    ("E1", "endEvent", "Servicio prestado", "L_pac", 15, 0),
    ("B8", "serviceTask", "Clasificar motivo y calcular valor esperado de apelar", "L_plat", 11, 1),
    ("B9", "serviceTask", "Redactar apelación con evidencia (IA)", "L_plat", 12, 1),
    ("C3", "userTask", "Validar y firmar apelación", "L_coord", 12, 0),
    ("P2", "task", "Revisar apelación", "L_pag", 13, 0),
    ("G5", "exclusiveGateway", "¿Revocada?", "L_pag", 14, 0),
    ("C4", "userTask", "Preparar expediente de tutela con el paciente", "L_coord", 15, 0),
    ("E2", "endEvent", "Tutela acompañada", "L_coord", 16, 0),
]
TO_BE_FLOWS = [
    ("S", "B1", ""), ("B1", "B2", ""), ("B2", "G1", ""),
    ("G1", "B7", "No"), ("G1", "B3", "Sí"), ("B3", "G2", ""),
    ("G2", "M1", "No"), ("M1", "B3", ""), ("G2", "B4", "Sí"),
    ("B4", "G3", ""), ("G3", "C1", "Sí"), ("C1", "B5", ""), ("G3", "B5", "No"),
    ("B5", "P1", ""), ("P1", "B6", ""), ("B6", "G4", ""),
    ("G4", "C2", "SLA vencido"), ("C2", "B6", ""),
    ("G4", "B7", "Aprobada"), ("B7", "N1", ""), ("N1", "E1", ""),
    ("G4", "B8", "Negada"), ("B8", "B9", "Valor esperado > umbral"), ("B9", "C3", ""),
    ("C3", "P2", ""), ("P2", "G5", ""), ("G5", "B7", "Sí"), ("G5", "C4", "No"), ("C4", "E2", ""),
]

if __name__ == "__main__":
    here = Path(__file__).parent
    (here / "as-is.bpmn").write_text(build("as_is", AS_IS_LANES, AS_IS_NODES, AS_IS_FLOWS), encoding="utf-8")
    (here / "to-be.bpmn").write_text(build("to_be", TO_BE_LANES, TO_BE_NODES, TO_BE_FLOWS), encoding="utf-8")
    print("OK: as-is.bpmn, to-be.bpmn")
