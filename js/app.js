/* Lógica de las 4 ventanas: Registro, Carga de archivos, Dashboard de coordinadores y Archivos. */
(function () {
  const S = window.Store;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fecha = (iso) => (iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00' : iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB');

  const EPS = ['Nueva EPS', 'EPS Sura', 'Sanitas', 'Compensar', 'Famisanar', 'Salud Total', 'Coosalud', 'Mutual Ser', 'Colsanitas (Prepagada)', 'Medisanitas (Prepagada)', 'Sura Prepagada', 'Coomeva Prepagada', 'Sisbén / Subsidiado', 'Particular'];
  const SECCIONES = ['Medicina general', 'Ortopedia', 'Cardiología', 'Gastroenterología', 'Oftalmología', 'Neurología', 'Imágenes diagnósticas', 'Laboratorio clínico', 'Historia clínica / Archivo', 'Otra'];
  const TRATAMIENTOS = {
    'Resonancia magnética': ['Orden médica firmada', 'Historia clínica', 'Radiografía previa', 'Soporte de tratamiento previo (6 semanas)'],
    'Cirugía programada': ['Orden médica firmada', 'Historia clínica', 'Valoración prequirúrgica', 'Exámenes de laboratorio', 'Consentimiento informado'],
    'Colonoscopia': ['Orden médica firmada', 'Historia clínica', 'Exámenes de laboratorio'],
    'Ecocardiograma': ['Orden médica firmada', 'Historia clínica', 'Electrocardiograma'],
    'Consulta con especialista': ['Remisión del médico general', 'Historia clínica'],
    'Terapia física (10 sesiones)': ['Orden médica firmada', 'Historia clínica', 'Valoración de fisiatría'],
    'Medicamento de alto costo': ['Fórmula médica', 'Historia clínica', 'Justificación médica', 'Exámenes de laboratorio'],
    Otro: [],
  };
  const ESTADO = {
    nueva: ['Nueva', 'gray'],
    en_proceso: ['En proceso', 'blue'],
    aprobada: ['Aprobada', 'green'],
    revision_rechazo: ['Rechazada – en revisión', 'amber'],
    apelacion: ['En apelación', 'violet'],
    rechazada: ['Rechazada', 'red'],
  };
  const pill = (estado) => `<span class="pill t-${ESTADO[estado][1]}">${ESTADO[estado][0]}</span>`;

  // ================================================================== utilidades de estado
  function toast(msg, tipo = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast ' + tipo;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }

  async function guardar(msg) {
    try {
      await S.guardar();
      if (msg) toast(msg);
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  }

  const sol = (id) => S.state.solicitudes.find((s) => s.id === id);
  function hist(s, texto) {
    s.historial.push({ fecha: new Date().toISOString(), texto, por: coordinador() || 'Sistema' });
  }
  function notificar(s, para, texto) {
    const correo = para === 'Paciente' ? s.paciente.correo : S.config.coordinadorGeneral;
    S.state.notificaciones.unshift({ id: uid(), fecha: new Date().toISOString(), para, solicitudId: s.id, pacienteId: s.paciente.id, texto, correo });
  }
  const coordinador = () => sessionStorage.getItem('coordinador') || '';

  /** Revisa plazos vencidos de apelación: pasan a rechazadas (descartadas). */
  function vencerPlazos() {
    let cambios = false;
    for (const s of S.state.solicitudes) {
      if (s.estado === 'revision_rechazo' && s.rechazo && new Date(s.rechazo.limite) < new Date()) {
        s.estado = 'rechazada';
        s.rechazoFinal = { tipo: 'Descartada (sin apelación)', justificacion: s.rechazo.razon + ' · El paciente no envió carta de apelación antes del ' + fecha(s.rechazo.limite), fecha: new Date().toISOString() };
        hist(s, 'Plazo de apelación vencido: solicitud descartada');
        cambios = true;
      }
    }
    return cambios;
  }

  /** Marca requisitos cumplidos según los archivos cargados en la carpeta del paciente. */
  function sincronizarRequisitos(s) {
    const archivos = (S.state.carpetas[s.paciente.id] || {}).archivos || [];
    for (const r of s.requisitos) {
      const f = archivos.find((a) => a.requerimiento === r.texto);
      if (f && !r.archivoId) {
        r.archivoId = f.id;
        r.cumplido = true;
      }
    }
  }

  // ================================================================== VENTANA 1: REGISTRO
  function vistaRegistro() {
    return `
    <div class="page-head"><div><span class="eyebrow">Ventana 1</span><h1>Registro de solicitud</h1>
    <p>Crea la solicitud de tratamiento para los coordinadores y la carpeta de historia clínica del paciente.</p></div></div>
    <form id="f-registro" class="grid g-main">
      <div class="card">
        <h3>Paciente</h3>
        <div class="grid g2">
          <div class="field"><label>Nombre del paciente *</label><input class="input" name="pNombre" required></div>
          <div class="field"><label>ID del paciente (documento) *</label><input class="input" name="pId" required pattern="[A-Za-z0-9.\\-]+" placeholder="Ej. 1020774310"></div>
          <div class="field"><label>EPS o aseguradora *</label>
            <select class="input" name="eps" required><option value="">Seleccione…</option>${EPS.map((e) => `<option>${e}</option>`).join('')}</select></div>
          <div class="field"><label>Correo del paciente (para notificar)</label><input class="input" name="pCorreo" type="email" placeholder="opcional"></div>
        </div>
        <h3 style="margin-top:22px">Tratamiento</h3>
        <div class="grid g2">
          <div class="field"><label>Tratamiento que solicita *</label>
            <select class="input" name="tratamiento" id="sel-trat" required><option value="">Seleccione…</option>${Object.keys(TRATAMIENTOS).map((t) => `<option>${t}</option>`).join('')}</select></div>
          <div class="field" id="otro-trat" hidden><label>¿Cuál?</label><input class="input" name="tratamientoOtro"></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Requerimientos del tratamiento * <small>(uno por línea)</small></label>
          <textarea class="input" name="requisitos" id="txt-req" rows="5" required placeholder="Orden médica firmada&#10;Historia clínica"></textarea></div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card">
          <h3>Médico y cita</h3>
          <div class="field"><label>ID del médico *</label><input class="input" name="mId" required></div>
          <div class="field" style="margin-top:12px"><label>Nombre del médico *</label><input class="input" name="mNombre" required></div>
          <div class="field" style="margin-top:12px"><label>Fecha de la cita *</label><input class="input" name="cita" type="date" required></div>
          <label class="check" style="margin-top:16px"><input type="checkbox" name="prioritario"> <span><b>Paciente prioritario</b><br><small>Aparece primero en la cola de los coordinadores</small></span></label>
        </div>
        <button class="btn btn-blue btn-lg" type="submit">Registrar solicitud y crear carpeta</button>
        <div id="reg-ok"></div>
      </div>
    </form>`;
  }

  function initRegistro() {
    const f = $('#f-registro');
    $('#sel-trat').onchange = (e) => {
      $('#otro-trat').hidden = e.target.value !== 'Otro';
      $('#txt-req').value = (TRATAMIENTOS[e.target.value] || []).join('\n');
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const requisitos = d.requisitos.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!requisitos.length) return toast('Escriba al menos un requerimiento', 'error');
      const pid = d.pId.trim();
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const nueva = !S.existeCarpeta(pid);
        await S.crearCarpeta(pid, d.pNombre.trim());
        const s = {
          id: 'SOL-' + String(S.state.solicitudes.length + 1).padStart(4, '0') + '-' + uid().slice(-3).toUpperCase(),
          paciente: { nombre: d.pNombre.trim(), id: pid, correo: d.pCorreo.trim() },
          eps: d.eps,
          tratamiento: d.tratamiento === 'Otro' ? d.tratamientoOtro || 'Otro' : d.tratamiento,
          requisitos: requisitos.map((t) => ({ texto: t, cumplido: false, archivoId: null })),
          medico: { id: d.mId.trim(), nombre: d.mNombre.trim() },
          fechaCita: d.cita,
          prioritario: d.prioritario === 'on',
          estado: 'nueva',
          creada: new Date().toISOString(),
          historial: [],
        };
        hist(s, 'Solicitud registrada' + (s.prioritario ? ' como PRIORITARIA' : ''));
        sincronizarRequisitos(s);
        S.state.solicitudes.push(s);
        await guardar();
        $('#reg-ok').innerHTML = `<div class="banner t-green"><b>Solicitud ${s.id} registrada.</b><br>${nueva ? 'Se creó la carpeta' : 'Se usó la carpeta existente'} de historia clínica <b>${esc(pid)}</b>. Ya aparece en la cola de los coordinadores.</div>`;
        f.reset();
        $('#otro-trat').hidden = true;
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    };
  }

  // ================================================================== VENTANA 2: CARGA DE ARCHIVOS
  function vistaCarga() {
    return `
    <div class="page-head"><div><span class="eyebrow">Ventana 2</span><h1>Carga de archivos</h1>
    <p>La especialidad carga los documentos en la historia clínica del paciente. Primero se verifica que exista la carpeta.</p></div></div>
    <div class="grid g-main">
      <div class="card">
        <h3>1 · Buscar paciente</h3>
        <div class="row-input">
          <input class="input" id="c-pid" placeholder="Escriba el ID o el nombre del paciente" autocomplete="off">
          <button class="btn btn-dark" id="c-buscar">Buscar</button>
        </div>
        <div id="c-res" class="results"></div>
        <div id="c-verif" style="margin-top:12px"></div>
        <form id="f-carga"><fieldset id="c-fs" disabled>
          <h3 style="margin-top:22px">2 · Profesional que carga</h3>
          <div class="grid g3">
            <div class="field"><label>ID del profesional *</label><input class="input" name="profId" required></div>
            <div class="field"><label>Nombre del profesional *</label><input class="input" name="profNombre" required></div>
            <div class="field"><label>Sección / especialidad *</label><select class="input" name="seccion" required>${SECCIONES.map((x) => `<option>${x}</option>`).join('')}</select></div>
          </div>
          <h3 style="margin-top:22px">3 · Archivos</h3>
          <div class="field"><label>Requerimiento que cubre</label><select class="input" name="requerimiento" id="c-req"></select></div>
          <label class="drop" id="c-drop"><input type="file" id="c-files" multiple hidden>
            <b>Arrastre los archivos aquí</b><span>o haga clic para seleccionarlos (PDF, imágenes, documentos)</span></label>
          <ul class="filelist" id="c-sel"></ul>
          <button class="btn btn-blue btn-lg" type="submit" style="margin-top:14px">Cargar a la historia clínica</button>
        </fieldset><p class="note" id="c-hint" style="margin-top:10px">Verifique el ID del paciente para habilitar la carga.</p></form>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card"><h3>Mensajes de coordinadores <span class="pill t-amber" id="c-nmsg">0</span></h3><div id="c-msgs" class="list"></div></div>
        <div class="card"><h3>Archivos en la carpeta</h3><div id="c-files-list" class="list"><div class="empty">Verifique un paciente.</div></div></div>
      </div>
    </div>`;
  }

  function initCarga() {
    let pid = null;
    let elegidos = [];
    const pintarMensajes = () => {
      const msgs = S.state.mensajes.filter((m) => m.estado === 'pendiente' && (!pid || m.pacienteId === pid));
      $('#c-nmsg').textContent = msgs.length;
      $('#c-msgs').innerHTML = msgs.length
        ? msgs.map((m) => `<div class="msg"><div class="msg-h"><b>${esc(m.asunto)}</b><span>${fechaHora(m.fecha)}</span></div>
            <div>Para: <b>${esc(m.destinatario)}</b> · De: ${esc(m.de)}</div><div>Solicita: <b>${esc(m.archivo)}</b></div>${m.mensaje ? `<div class="note">${esc(m.mensaje)}</div>` : ''}
            <button class="btn btn-soft btn-sm" data-usar="${m.pacienteId}">Atender</button></div>`).join('')
        : '<div class="empty">Sin mensajes pendientes.</div>';
      $('#c-msgs').querySelectorAll('[data-usar]').forEach((b) => (b.onclick = () => (($('#c-pid').value = b.dataset.usar), verificar())));
    };
    const pintarArchivos = () => {
      const c = S.state.carpetas[pid];
      $('#c-files-list').innerHTML = c && c.archivos.length ? c.archivos.map(filaArchivo).join('') : '<div class="empty">La carpeta está vacía.</div>';
      enlazarArchivos($('#c-files-list'));
    };
    const carpetas = () => Object.values(S.state.carpetas);
    const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // lista de resultados mientras se escribe (por ID o por nombre)
    const buscar = () => {
      const q = norm($('#c-pid').value.trim());
      const todas = carpetas();
      if (!todas.length) {
        $('#c-res').innerHTML = `<div class="banner t-amber">Aún no hay pacientes registrados. Primero registre uno en <a class="link" href="#/registro">Registro</a> para crear su carpeta.</div>`;
        return;
      }
      const lista = q ? todas.filter((c) => norm(c.pacienteId + ' ' + c.paciente).includes(q)) : todas;
      $('#c-res').innerHTML = lista.length
        ? `<p class="note">${q ? `${lista.length} resultado(s)` : 'Pacientes registrados'} · clic para elegir</p><div class="list">${lista.slice(0, 8).map((c) =>
            `<button type="button" class="item result" data-pick="${esc(c.pacienteId)}"><b>${esc(c.paciente)}</b><span>ID ${esc(c.pacienteId)} · ${c.archivos.length} archivo(s)</span></button>`).join('')}</div>`
        : `<div class="banner t-red">No hay ningún paciente con “${esc($('#c-pid').value.trim())}”. Revise el dato o registre primero al paciente. <a class="btn btn-sm btn-blue" href="#/registro" style="margin-left:6px">Ir a Registro</a></div>`;
      $('#c-res').querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => elegir(b.dataset.pick)));
    };
    const limpiar = () => {
      pid = null;
      $('#c-fs').disabled = true;
      $('#c-hint').hidden = false;
      $('#c-verif').innerHTML = '';
      $('#c-files-list').innerHTML = '<div class="empty">Elija un paciente.</div>';
      pintarMensajes();
    };
    const elegir = (id) => {
      const c = S.state.carpetas[id];
      if (!c) return;
      pid = id;
      $('#c-pid').value = id;
      $('#c-res').innerHTML = '';
      const sols = S.state.solicitudes.filter((s) => s.paciente.id === pid && !['aprobada', 'rechazada'].includes(s.estado));
      const reqs = [...new Set(sols.flatMap((s) => s.requisitos.filter((r) => !r.cumplido).map((r) => r.texto)))];
      $('#c-req').innerHTML = `<option value="">— Ninguno / otro documento —</option>` + reqs.map((r) => `<option>${esc(r)}</option>`).join('');
      $('#c-verif').innerHTML = `<div class="banner t-green chosen"><div><b>${esc(c.paciente)}</b> · ID ${esc(pid)}<br><small>${sols.length} solicitud(es) activa(s)${reqs.length ? ` · faltan: ${reqs.map(esc).join(', ')}` : ''}</small></div>
        <button type="button" class="btn btn-ghost btn-sm" id="c-cambiar">Cambiar paciente</button></div>`;
      $('#c-cambiar').onclick = () => {
        $('#c-pid').value = '';
        limpiar();
        buscar();
        $('#c-pid').focus();
      };
      $('#c-fs').disabled = false;
      $('#c-hint').hidden = true;
      pintarMensajes();
      pintarArchivos();
    };
    // compatibilidad con "Atender" de los mensajes
    const verificar = () => {
      const v = $('#c-pid').value.trim();
      if (S.state.carpetas[v]) return elegir(v);
      const q = norm(v);
      const hits = carpetas().filter((c) => norm(c.pacienteId + ' ' + c.paciente).includes(q));
      if (v && hits.length === 1) return elegir(hits[0].pacienteId);
      limpiar();
      buscar();
    };
    $('#c-buscar').onclick = verificar;
    $('#c-pid').oninput = () => {
      if (pid) limpiar(); // al reescribir se suelta el paciente elegido
      if (S.state.carpetas[$('#c-pid').value.trim()]) return elegir($('#c-pid').value.trim());
      buscar();
    };
    $('#c-pid').onkeydown = (e) => e.key === 'Enter' && verificar();
    buscar();

    const pintarSel = () => ($('#c-sel').innerHTML = elegidos.map((f) => `<li>${esc(f.name)} <span>${kb(f.size)}</span></li>`).join(''));
    $('#c-files').onchange = (e) => ((elegidos = [...e.target.files]), pintarSel());
    const drop = $('#c-drop');
    drop.ondragover = (e) => (e.preventDefault(), drop.classList.add('over'));
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => (e.preventDefault(), drop.classList.remove('over'), pid && (elegidos = [...e.dataTransfer.files]), pintarSel());

    $('#f-carga').onsubmit = async (e) => {
      e.preventDefault();
      if (!pid) return;
      if (!elegidos.length) return toast('Seleccione al menos un archivo', 'error');
      const d = Object.fromEntries(new FormData(e.target));
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Cargando…';
      try {
        for (const file of elegidos) {
          await S.subirArchivo(pid, file, { profesionalId: d.profId.trim(), profesional: d.profNombre.trim(), seccion: d.seccion, requerimiento: d.requerimiento || null });
        }
        S.state.solicitudes.filter((s) => s.paciente.id === pid).forEach((s) => {
          sincronizarRequisitos(s);
          hist(s, `${elegidos.length} archivo(s) cargado(s) por ${d.profNombre} (${d.seccion})`);
        });
        // mensajes de esa sección para el paciente quedan atendidos
        S.state.mensajes.filter((m) => m.pacienteId === pid && m.estado === 'pendiente' && m.destinatario === d.seccion).forEach((m) => {
          m.estado = 'atendido';
          m.atendido = new Date().toISOString();
        });
        await guardar(`${elegidos.length} archivo(s) guardado(s) en la carpeta ${pid}`);
        elegidos = [];
        pintarSel();
        $('#c-files').value = '';
        verificar();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Cargar a la historia clínica';
      }
    };
    pintarMensajes();
  }

  // ================================================================== VENTANA 3: DASHBOARD
  let tabDash = 'general';
  let hoja = 'aprobadas';
  let abierta = null;

  function vistaDashboard() {
    const tabs = [
      ['general', 'Dashboard general'],
      ['cola', 'Cola de solicitudes'],
      ['proceso', 'En proceso'],
      ['hojas', 'Resultados'],
    ];
    return `
    <div class="page-head"><div><span class="eyebrow">Ventana 3</span><h1>Dashboard de coordinadores</h1></div>
      <div class="coord"><label>Coordinador</label><input class="input" id="d-coord" placeholder="Su nombre" value="${esc(coordinador())}"></div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tabDash === k ? 'on' : ''}">${l}${badge(k)}</button>`).join('')}</div>
    <div id="d-body" style="margin-top:18px"></div>`;
  }
  function badge(k) {
    const n = { cola: cuenta('nueva'), proceso: cuenta('en_proceso'), hojas: cuenta('revision_rechazo') + cuenta('apelacion') }[k];
    return n ? ` <span class="count">${n}</span>` : '';
  }
  const cuenta = (e) => S.state.solicitudes.filter((s) => s.estado === e).length;

  function initDashboard() {
    $('#d-coord').onchange = (e) => sessionStorage.setItem('coordinador', e.target.value.trim());
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => ((tabDash = b.dataset.tab), render())));
    const body = $('#d-body');
    if (tabDash === 'general') body.innerHTML = dashGeneral();
    if (tabDash === 'cola') body.innerHTML = dashCola();
    if (tabDash === 'proceso') body.innerHTML = dashProceso();
    if (tabDash === 'hojas') body.innerHTML = dashHojas();
    enlazarDashboard(body);
    enlazarArchivos(body);
  }

  function dashGeneral() {
    const t = S.state.solicitudes.length;
    const kpis = [
      ['Total de solicitudes', t, 'hero'],
      ['Aprobadas', cuenta('aprobada'), 'green'],
      ['Rechazadas', cuenta('rechazada'), 'red'],
      ['En proceso', cuenta('en_proceso') + cuenta('nueva'), 'blue', `${cuenta('nueva')} en cola · ${cuenta('en_proceso')} en gestión`],
      ['En apelación', cuenta('apelacion') + cuenta('revision_rechazo'), 'violet', `${cuenta('revision_rechazo')} esperando carta · ${cuenta('apelacion')} apeladas`],
    ];
    const max = Math.max(1, ...Object.keys(ESTADO).map(cuenta));
    const porEps = {};
    S.state.solicitudes.forEach((s) => (porEps[s.eps] = (porEps[s.eps] || 0) + 1));
    return `
    <div class="kpis">${kpis.map(([l, v, c, sub]) => `<div class="card kpi ${c === 'hero' ? 'hero-kpi' : ''}"><div class="label">${l}</div><div class="value ${c !== 'hero' ? 'c-' + c : ''}">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`).join('')}</div>
    <div class="grid g2" style="margin-top:18px">
      <div class="card"><h3>Solicitudes por estado</h3><div class="bars">${Object.keys(ESTADO).map((e) => `<div class="hbar"><div class="lbl"><span>${ESTADO[e][0]}</span><b>${cuenta(e)}</b></div><div class="track"><i class="bg-${ESTADO[e][1]}" style="width:${(cuenta(e) / max) * 100}%"></i></div></div>`).join('')}</div></div>
      <div class="card"><h3>Notificaciones enviadas</h3><div class="list">${S.state.notificaciones.slice(0, 8).map(filaNotif).join('') || '<div class="empty">Aún no hay notificaciones.</div>'}</div></div>
    </div>
    <div class="card" style="margin-top:18px"><h3>Solicitudes por aseguradora</h3><div class="chips">${Object.entries(porEps).sort((a, b) => b[1] - a[1]).map(([e, n]) => `<span class="tag">${esc(e)} · <b>${n}</b></span>`).join('') || '<div class="empty">Sin datos.</div>'}</div></div>`;
  }

  function filaNotif(n) {
    const mail = n.correo ? `<a class="link" href="mailto:${esc(n.correo)}?subject=${encodeURIComponent('Solicitud ' + n.solicitudId)}&body=${encodeURIComponent(n.texto)}">Enviar correo</a>` : '<span class="note">sin correo</span>';
    return `<div class="task"><div class="txt"><b>${esc(n.para)} · ${esc(n.solicitudId)}</b><span>${esc(n.texto)}</span></div><div class="right"><small>${fechaHora(n.fecha)}</small>${mail}</div></div>`;
  }

  function dashCola() {
    const cola = S.state.solicitudes.filter((s) => s.estado === 'nueva').sort((a, b) => b.prioritario - a.prioritario || a.creada.localeCompare(b.creada));
    if (!cola.length) return '<div class="card empty">No hay solicitudes nuevas en la cola.</div>';
    return `<div class="card"><h3>Cola de solicitudes <small>prioritarias primero · seleccione para procesar</small></h3>
    <table class="table"><thead><tr><th>Solicitud</th><th>Paciente</th><th>EPS</th><th>Tratamiento</th><th>Cita</th><th>Docs</th><th></th></tr></thead><tbody>
    ${cola.map((s) => {
      sincronizarRequisitos(s);
      const ok = s.requisitos.filter((r) => r.cumplido).length;
      return `<tr class="${s.prioritario ? 'prio' : ''}"><td><b>${s.id}</b>${s.prioritario ? ' <span class="pill t-red">Prioritario</span>' : ''}<div class="sub">${fechaHora(s.creada)}</div></td>
      <td>${esc(s.paciente.nombre)}<div class="sub">ID ${esc(s.paciente.id)}</div></td><td>${esc(s.eps)}</td><td>${esc(s.tratamiento)}<div class="sub">${esc(s.medico.nombre)}</div></td>
      <td>${fecha(s.fechaCita)}</td><td>${ok}/${s.requisitos.length}</td><td><button class="btn btn-blue btn-sm" data-tomar="${s.id}">Procesar</button></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function dashProceso() {
    const lista = S.state.solicitudes.filter((s) => s.estado === 'en_proceso');
    if (!lista.length) return '<div class="card empty">No hay solicitudes en proceso. Tome una desde la cola.</div>';
    if (!abierta || !lista.find((s) => s.id === abierta)) abierta = lista[0].id;
    const s = sol(abierta);
    sincronizarRequisitos(s);
    const carpeta = S.state.carpetas[s.paciente.id] || { archivos: [] };
    const faltan = s.requisitos.filter((r) => !r.cumplido);
    const completo = faltan.length === 0;
    const msgs = S.state.mensajes.filter((m) => m.solicitudId === s.id);
    return `<div class="grid g-side">
      <div class="card"><h3>En proceso <small>${lista.length}</small></h3><div class="list">
        ${lista.map((x) => `<button class="item ${x.id === s.id ? 'on' : ''}" data-abrir="${x.id}"><b>${esc(x.paciente.nombre)}</b><span>${x.id} · ${esc(x.tratamiento)}</span><span>Coord.: ${esc(x.coordinador || '—')}</span></button>`).join('')}
      </div></div>
      <div class="grid" style="align-content:start">
        <div class="card">
          <div class="case-head"><div><h2>${esc(s.paciente.nombre)} ${s.prioritario ? '<span class="pill t-red">Prioritario</span>' : ''}</h2><p class="note">${s.id} · tomada por ${esc(s.coordinador || '—')} el ${fechaHora(s.tomada)}</p></div>${pill(s.estado)}</div>
          <div class="meta">
            <div><span>ID paciente</span>${esc(s.paciente.id)}</div><div><span>EPS / aseguradora</span>${esc(s.eps)}</div>
            <div><span>Tratamiento</span>${esc(s.tratamiento)}</div><div><span>Médico</span>${esc(s.medico.nombre)} (${esc(s.medico.id)})</div>
            <div><span>Fecha de la cita</span>${fecha(s.fechaCita)}</div><div><span>Correo</span>${esc(s.paciente.correo || '—')}</div>
          </div>
        </div>
        <div class="grid g2">
          <div class="card"><h3>Requerimientos <small>${s.requisitos.length - faltan.length}/${s.requisitos.length} completos</small></h3>
            <div class="bar ${completo ? 'good' : ''}"><i style="width:${((s.requisitos.length - faltan.length) / s.requisitos.length) * 100}%"></i></div>
            <div class="list" style="margin-top:12px">${s.requisitos.map((r, i) => {
              const f = carpeta.archivos.find((a) => a.id === r.archivoId);
              return `<div class="req ${r.cumplido ? 'ok' : ''}"><label class="check"><input type="checkbox" data-req="${i}" ${r.cumplido ? 'checked' : ''}><span>${esc(r.texto)}${f ? `<br><small>📎 ${esc(f.nombre)}</small>` : ''}</span></label>
                ${r.cumplido ? '' : `<button class="btn btn-soft btn-sm" data-pedir="${i}">Solicitar archivo</button>`}</div>`;
            }).join('')}</div>
            <div id="form-msg"></div>
            ${msgs.length ? `<h4 style="margin-top:16px">Mensajes enviados</h4>${msgs.map((m) => `<div class="note">• ${esc(m.destinatario)}: ${esc(m.archivo)} — <b>${m.estado}</b></div>`).join('')}` : ''}
          </div>
          <div class="card"><h3>Archivos cargados <small>carpeta ${esc(s.paciente.id)}</small></h3>
            <div class="list">${carpeta.archivos.map(filaArchivo).join('') || '<div class="empty">Aún no hay archivos en la historia clínica.</div>'}</div></div>
        </div>
        <div class="card">
          <h3>Respuesta de la aseguradora</h3>
          ${completo ? '' : `<div class="banner t-amber" style="margin-bottom:12px">Faltan ${faltan.length} requerimiento(s). Puede solicitarlos a la sección correspondiente antes de radicar.</div>`}
          <div class="grid g2">
            <div><button class="btn btn-green btn-lg" data-aprobar="${s.id}" style="width:100%">✓ Aprobada por la aseguradora</button></div>
            <div><textarea class="input" id="razon" rows="2" placeholder="Razón del rechazo (obligatoria para rechazar)"></textarea>
              <button class="btn btn-danger btn-lg" data-rechazar="${s.id}" style="width:100%;margin-top:8px">✕ Rechazada por la aseguradora</button></div>
          </div>
          <button class="btn btn-ghost btn-sm" data-devolver="${s.id}" style="margin-top:12px">Devolver a la cola</button>
        </div>
        <div class="card"><h3>Historial</h3>${historial(s)}</div>
      </div></div>`;
  }

  const historial = (s) => `<div class="timeline">${[...s.historial].reverse().map((h) => `<div class="ev"><div class="h">${fechaHora(h.fecha)} · ${esc(h.por)}</div><div>${esc(h.texto)}</div></div>`).join('')}</div>`;

  function dashHojas() {
    const hojas = [
      ['aprobadas', 'Solicitudes aprobadas', 'aprobada'],
      ['revision', 'Revisión de rechazadas', 'revision_rechazo'],
      ['apelaciones', 'Apelaciones', 'apelacion'],
      ['rechazos', 'Rechazos', 'rechazada'],
    ];
    const actual = hojas.find((h) => h[0] === hoja);
    const lista = S.state.solicitudes.filter((s) => s.estado === actual[2]);
    let tabla = '';
    if (hoja === 'aprobadas')
      tabla = tablaHoja(lista, ['Aprobada', 'Vía', 'Justificación'], (s) => [fecha(s.aprobada), s.aprobadaVia || 'Aseguradora', esc((s.apelacion && s.apelacion.justificacion) || '—')]);
    if (hoja === 'revision')
      tabla = tablaHoja(lista, ['Fecha de rechazo', 'Razón', 'Límite carta', 'Acciones'], (s) => [
        fecha(s.rechazo.fecha), esc(s.rechazo.razon), `${fecha(s.rechazo.limite)}<div class="sub">${diasRestantes(s.rechazo.limite)}</div>`,
        `<label class="btn btn-soft btn-sm file-btn">Recibir carta…<input type="file" hidden data-carta="${s.id}"></label> <button class="btn btn-dark btn-sm" data-carta-sin="${s.id}">Carta recibida</button> <button class="btn btn-ghost btn-sm" data-descartar="${s.id}">Descartar</button>`,
      ], true);
    if (hoja === 'apelaciones')
      tabla = tablaHoja(lista, ['Razón del rechazo', 'Carta recibida', 'Resultado de la apelación'], (s) => [
        esc(s.rechazo.razon), fecha(s.apelacion.fecha) + (s.apelacion.archivoId ? ' 📎' : ''),
        `<div class="ap-box"><textarea class="input" rows="2" id="just-${s.id}" placeholder="Justificación de la decisión (obligatoria)"></textarea>
          <div class="actions"><button class="btn btn-green btn-sm" data-ap-ok="${s.id}">✓ Aprobar</button> <button class="btn btn-danger btn-sm" data-ap-no="${s.id}">✕ Rechazar</button></div></div>`,
      ], true);
    if (hoja === 'rechazos')
      tabla = tablaHoja(lista, ['Tipo', 'Justificación', 'Fecha'], (s) => [`<span class="pill t-red">${esc(s.rechazoFinal.tipo)}</span>`, esc(s.rechazoFinal.justificacion), fecha(s.rechazoFinal.fecha)]);
    return `<div class="subtabs">${hojas.map(([k, l, e]) => `<button data-hoja="${k}" class="${hoja === k ? 'on' : ''}">${l} <span>${cuenta(e)}</span></button>`).join('')}</div>
      <div class="card" style="margin-top:14px">${lista.length ? tabla : '<div class="empty">No hay solicitudes en esta hoja.</div>'}</div>`;
  }
  function diasRestantes(iso) {
    const d = Math.ceil((new Date(iso) - new Date()) / 86400000);
    return d >= 0 ? `${d} día(s) restantes` : 'vencido';
  }
  function tablaHoja(lista, cols, fila) {
    return `<table class="table"><thead><tr><th>Solicitud</th><th>Paciente</th><th>EPS</th><th>Tratamiento</th><th>Médico / cita</th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${lista.map((s) => `<tr><td><b>${s.id}</b>${s.prioritario ? ' <span class="pill t-red">P</span>' : ''}</td><td>${esc(s.paciente.nombre)}<div class="sub">ID ${esc(s.paciente.id)}</div></td><td>${esc(s.eps)}</td><td>${esc(s.tratamiento)}</td><td>${esc(s.medico.nombre)}<div class="sub">${fecha(s.fechaCita)}</div></td>${fila(s).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
  }

  function enlazarDashboard(root) {
    const on = (attr, fn) => root.querySelectorAll(`[${attr}]`).forEach((el) => (el.onclick = () => fn(el.getAttribute(attr), el)));
    const requiereCoord = () => {
      if (coordinador()) return true;
      toast('Escriba su nombre de coordinador arriba', 'error');
      $('#d-coord').focus();
      return false;
    };
    on('data-tomar', async (id) => {
      if (!requiereCoord()) return;
      await S.cargar(); // evitar que dos coordinadores tomen la misma
      const s = sol(id);
      if (s.estado !== 'nueva') return toast(`Ya fue tomada por ${s.coordinador}`, 'error'), render();
      Object.assign(s, { estado: 'en_proceso', coordinador: coordinador(), tomada: new Date().toISOString() });
      hist(s, 'Seleccionada para procesar');
      abierta = id;
      tabDash = 'proceso';
      await guardar(`${id} marcada en proceso`);
      render();
    });
    on('data-abrir', (id) => ((abierta = id), render()));
    on('data-hoja', (k) => ((hoja = k), render()));
    root.querySelectorAll('[data-req]').forEach((cb) => (cb.onchange = async () => {
      const s = sol(abierta);
      const r = s.requisitos[cb.dataset.req];
      r.cumplido = cb.checked;
      if (!cb.checked) r.archivoId = null;
      hist(s, `Requerimiento "${r.texto}" marcado como ${cb.checked ? 'completo' : 'pendiente'}`);
      await guardar();
      render();
    }));
    on('data-pedir', (i) => {
      const s = sol(abierta);
      $('#form-msg').innerHTML = `<form class="msgform" id="f-msg">
        <div class="msg-h"><b>Nuevo mensaje</b><button type="button" class="x" id="msg-x">✕</button></div>
        <div class="field"><label>Asunto</label><input class="input" value="Información paciente – ID ${esc(s.paciente.id)}" disabled></div>
        <div class="field"><label>Destinatario (sección) *</label><input class="input" name="dest" list="secciones" required placeholder="Ej. Imágenes diagnósticas"><datalist id="secciones">${SECCIONES.map((x) => `<option>${x}</option>`).join('')}</datalist></div>
        <div class="field"><label>Archivo que se solicita *</label><input class="input" name="archivo" required value="${esc(s.requisitos[i].texto)}"></div>
        <div class="field"><label>Mensaje</label><textarea class="input" name="mensaje" rows="2" placeholder="Opcional"></textarea></div>
        <button class="btn btn-blue btn-sm" type="submit">Enviar mensaje</button></form>`;
      $('#msg-x').onclick = () => ($('#form-msg').innerHTML = '');
      $('#f-msg').onsubmit = async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        S.state.mensajes.unshift({ id: uid(), fecha: new Date().toISOString(), solicitudId: s.id, pacienteId: s.paciente.id, asunto: `Información paciente – ID ${s.paciente.id}`, destinatario: d.dest.trim(), archivo: d.archivo.trim(), mensaje: d.mensaje.trim(), de: coordinador() || 'Coordinación PA', estado: 'pendiente' });
        hist(s, `Mensaje a ${d.dest}: solicita "${d.archivo}"`);
        await guardar('Mensaje enviado a ' + d.dest);
        render();
      };
    });
    on('data-aprobar', async (id) => {
      if (!requiereCoord()) return;
      const s = sol(id);
      Object.assign(s, { estado: 'aprobada', aprobada: new Date().toISOString(), aprobadaVia: 'Aseguradora' });
      hist(s, 'Aprobada por la aseguradora');
      notificar(s, 'Paciente', `Su solicitud de ${s.tratamiento} fue APROBADA por ${s.eps}. Cita: ${fecha(s.fechaCita)}.`);
      notificar(s, 'Coordinador general', `Solicitud ${s.id} (${s.paciente.nombre}, ${s.tratamiento}) aprobada por ${s.eps}.`);
      await guardar(`${id} aprobada · paciente y coordinador general notificados`);
      render();
    });
    on('data-rechazar', async (id) => {
      if (!requiereCoord()) return;
      const razon = $('#razon').value.trim();
      if (!razon) return toast('Escriba la razón del rechazo', 'error'), $('#razon').focus();
      const s = sol(id);
      const limite = new Date(Date.now() + S.config.diasApelacion * 86400000).toISOString();
      Object.assign(s, { estado: 'revision_rechazo', rechazo: { fecha: new Date().toISOString(), razon, limite } });
      hist(s, 'Rechazada por la aseguradora: ' + razon);
      notificar(s, 'Paciente', `Su solicitud de ${s.tratamiento} fue rechazada por ${s.eps}. Razón: ${razon}. Puede enviar una carta de apelación antes del ${fecha(limite)}.`);
      await guardar(`${id} rechazada · paciente notificado para preparar la apelación`);
      render();
    });
    on('data-devolver', async (id) => {
      const s = sol(id);
      Object.assign(s, { estado: 'nueva', coordinador: null });
      hist(s, 'Devuelta a la cola');
      await guardar();
      render();
    });
    const pasarApelacion = async (id, archivo) => {
      const s = sol(id);
      let archivoId = null;
      if (archivo) archivoId = (await S.subirArchivo(s.paciente.id, archivo, { profesionalId: '-', profesional: s.paciente.nombre, seccion: 'Paciente – carta de apelación', requerimiento: null })).id;
      Object.assign(s, { estado: 'apelacion', apelacion: { fecha: new Date().toISOString(), archivoId } });
      hist(s, 'El paciente envió la carta de apelación: pasa a apelaciones (en proceso)');
      await guardar(`${id} pasó a apelaciones`);
      render();
    };
    root.querySelectorAll('[data-carta]').forEach((inp) => (inp.onchange = () => inp.files[0] && pasarApelacion(inp.dataset.carta, inp.files[0]).catch((e) => toast(e.message, 'error'))));
    on('data-carta-sin', (id) => pasarApelacion(id, null));
    on('data-descartar', async (id) => {
      const s = sol(id);
      s.estado = 'rechazada';
      s.rechazoFinal = { tipo: 'Descartada (sin apelación)', justificacion: s.rechazo.razon + ' · El paciente no presentó apelación', fecha: new Date().toISOString() };
      hist(s, 'Descartada: el paciente no apeló');
      await guardar(`${id} descartada`);
      render();
    });
    const justificacion = (id) => {
      const el = document.getElementById('just-' + id);
      const j = el.value.trim();
      if (!j) {
        toast('Escriba la justificación de la decisión', 'error');
        el.focus();
      }
      return j;
    };
    on('data-ap-ok', async (id) => {
      const j = justificacion(id);
      if (!j) return;
      const s = sol(id);
      s.apelacion.justificacion = j;
      Object.assign(s, { estado: 'aprobada', aprobada: new Date().toISOString(), aprobadaVia: 'Apelación' });
      s.apelacion.resultado = 'aprobada';
      hist(s, 'Apelación aprobada: ' + j);
      notificar(s, 'Paciente', `Su apelación fue APROBADA. El tratamiento ${s.tratamiento} quedó autorizado. Justificación: ${j}`);
      notificar(s, 'Coordinador general', `Apelación de ${s.id} (${s.paciente.nombre}) aprobada.`);
      await guardar(`${id} aprobada por apelación`);
      render();
    });
    on('data-ap-no', async (id) => {
      const j = justificacion(id);
      if (!j) return;
      const s = sol(id);
      s.estado = 'rechazada';
      s.apelacion.resultado = 'rechazada';
      s.apelacion.justificacion = j;
      s.rechazoFinal = { tipo: 'Apelación rechazada', justificacion: j, fecha: new Date().toISOString() };
      hist(s, 'Apelación rechazada: ' + j);
      notificar(s, 'Paciente', `Su apelación fue rechazada. Justificación: ${j}`);
      await guardar(`${id} pasó a rechazos`);
      render();
    });
  }

  // ================================================================== VENTANA 4: ARCHIVOS
  let carpetaAbierta = null;
  function vistaArchivos() {
    const carpetas = Object.values(S.state.carpetas).sort((a, b) => b.creada.localeCompare(a.creada));
    const c = carpetaAbierta && S.state.carpetas[carpetaAbierta];
    return `
    <div class="page-head"><div><span class="eyebrow">Ventana 4</span><h1>Archivos · historias clínicas</h1>
    <p>Una carpeta por ID de paciente${S.modo === 'drive' ? ', sincronizada con Google Drive' : ''}. Aquí llegan los archivos de la ventana de carga.</p></div>
    <input class="input" id="a-buscar" placeholder="Buscar ID o nombre…" style="max-width:280px"></div>
    <div class="grid g-side">
      <div class="card"><h3>Carpetas <small>${carpetas.length}</small></h3><div class="list" id="a-list">
        ${carpetas.map((x) => `<button class="item folder ${x.pacienteId === carpetaAbierta ? 'on' : ''}" data-carpeta="${esc(x.pacienteId)}" data-q="${esc((x.pacienteId + ' ' + x.paciente).toLowerCase())}">
          <b>📁 ${esc(x.pacienteId)}</b><span>${esc(x.paciente)} · ${x.archivos.length} archivo(s)</span></button>`).join('') || '<div class="empty">No hay carpetas. Registre un paciente.</div>'}
      </div></div>
      <div class="card">${c ? `<h3>📁 ${esc(c.pacienteId)} — ${esc(c.paciente)} <small>creada ${fecha(c.creada)}</small></h3>
        ${c.driveId ? `<a class="link" target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/${c.driveId}">Abrir en Google Drive ↗</a>` : ''}
        <h4 style="margin:14px 0 8px">Solicitudes</h4>${S.state.solicitudes.filter((s) => s.paciente.id === c.pacienteId).map((s) => `<div class="note">${s.id} · ${esc(s.tratamiento)} · ${pill(s.estado)}</div>`).join('')}
        <h4 style="margin:18px 0 8px">Documentos</h4><div class="list">${c.archivos.map(filaArchivo).join('') || '<div class="empty">Carpeta vacía.</div>'}</div>`
        : '<div class="empty">Seleccione una carpeta.</div>'}</div>
    </div>`;
  }
  function initArchivos() {
    document.querySelectorAll('[data-carpeta]').forEach((b) => (b.onclick = () => ((carpetaAbierta = b.dataset.carpeta), render())));
    $('#a-buscar').oninput = (e) => document.querySelectorAll('[data-q]').forEach((b) => (b.hidden = !b.dataset.q.includes(e.target.value.toLowerCase())));
    enlazarArchivos(document);
  }

  function filaArchivo(a) {
    return `<div class="task file"><span class="dot">${/pdf/.test(a.tipo) ? 'PDF' : /image/.test(a.tipo) ? 'IMG' : 'DOC'}</span>
      <div class="txt"><b>${esc(a.nombre)}</b><span>${esc(a.profesional)} · ${esc(a.seccion || '')} · ${fechaHora(a.fecha)} · ${kb(a.tamano)}</span>${a.requerimiento ? `<span class="req-tag">Cubre: ${esc(a.requerimiento)}</span>` : ''}</div>
      <button class="btn btn-ghost btn-sm" data-ver="${a.id}">Ver</button></div>`;
  }
  function enlazarArchivos(root) {
    root.querySelectorAll('[data-ver]').forEach((b) => (b.onclick = async () => {
      const a = Object.values(S.state.carpetas).flatMap((c) => c.archivos).find((x) => x.id === b.dataset.ver);
      try {
        window.open(await S.urlArchivo(a), '_blank', 'noopener');
      } catch (e) {
        toast(e.message, 'error');
      }
    }));
  }

  // ================================================================== CONFIGURACIÓN
  function vistaConfig() {
    const c = S.config;
    return `
    <div class="page-head"><div><span class="eyebrow">Ajustes</span><h1>Configuración</h1><p>Modo de almacenamiento e integración con la API de Google Drive.</p></div></div>
    <div class="grid g2">
      <form class="card" id="f-cfg">
        <h3>Almacenamiento</h3>
        <label class="check"><input type="radio" name="modo" value="local" ${c.modo === 'local' ? 'checked' : ''}><span><b>Local (este navegador)</b><br><small>Sin servidor ni cuentas. Ideal para la demostración en un solo equipo.</small></span></label>
        <label class="check" style="margin-top:10px"><input type="radio" name="modo" value="drive" ${c.modo === 'drive' ? 'checked' : ''}><span><b>Google Drive</b><br><small>Carpetas de historia clínica y estado compartido entre equipos y usuarios.</small></span></label>
        <div class="field" style="margin-top:16px"><label>Google OAuth Client ID</label><input class="input" name="clientId" value="${esc(c.clientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com"></div>
        <div class="grid g2" style="margin-top:12px">
          <div class="field"><label>Días para enviar la carta de apelación</label><input class="input" type="number" min="1" name="diasApelacion" value="${c.diasApelacion}"></div>
          <div class="field"><label>Correo del coordinador general</label><input class="input" type="email" name="coordinadorGeneral" value="${esc(c.coordinadorGeneral)}"></div>
        </div>
        <div class="actions" style="margin-top:16px"><button class="btn btn-blue" type="submit">Guardar</button>
          ${c.modo === 'drive' ? `<button class="btn btn-dark" type="button" id="btn-google">${S.modo === 'drive' ? 'Reconectar Google' : 'Conectar Google Drive'}</button>` : ''}</div>
      </form>
      <div class="card">
        <h3>Cómo activar Google Drive</h3>
        <ol class="steps">
          <li>En <a class="link" href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud Console</a> cree un proyecto y habilite la <b>Google Drive API</b>.</li>
          <li>En <i>Pantalla de consentimiento OAuth</i> agregue su correo como usuario de prueba.</li>
          <li>En <i>Credenciales</i> cree un <b>ID de cliente OAuth → Aplicación web</b> y en <i>Orígenes de JavaScript autorizados</i> agregue la dirección donde abre esta app (por ejemplo <code>http://localhost:8080</code>).</li>
          <li>Pegue el Client ID aquí, elija <b>Google Drive</b>, guarde y pulse <b>Conectar</b>.</li>
        </ol>
        <p class="note">Se usa el permiso <code>drive.file</code>: la app solo ve las carpetas y archivos que ella misma crea. Todo queda en la carpeta <b>“Niágara - Historias clínicas”</b> de su Drive.</p>
        <p class="note">Google no permite iniciar sesión desde un archivo abierto con doble clic (<code>file://</code>). Para Drive sirva la carpeta con <code>python3 -m http.server 8080</code>.</p>
        <hr><h3>Datos de prueba</h3>
        <p class="note">Crea 9 pacientes con su carpeta por ID, documentos PDF y solicitudes en todos los estados${S.modo === 'drive' ? ', directamente en su Google Drive' : ''}.</p>
        <div class="actions" style="margin-top:12px"><button class="btn btn-green" id="btn-demo">Crear datos de prueba</button>
        <button class="btn btn-ghost btn-sm" id="btn-reset">Borrar datos locales</button></div>
        <p class="note" id="demo-prog" style="margin-top:10px"></p>
      </div>
    </div>`;
  }
  function initConfig() {
    $('#f-cfg').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      Object.assign(S.config, { modo: d.modo, clientId: d.clientId.trim(), diasApelacion: Number(d.diasApelacion) || 10, coordinadorGeneral: d.coordinadorGeneral.trim() });
      S.saveConfig();
      toast('Configuración guardada');
      if (d.modo === 'local') await S.cargar();
      render();
    };
    const g = $('#btn-google');
    if (g) g.onclick = conectar;
    $('#btn-demo').onclick = async (e) => {
      if (S.modo === 'drive-desconectado') return toast('Primero conecte Google Drive', 'error');
      e.target.disabled = true;
      try {
        await S.cargar();
        const n = await window.crearDatosPrueba(S, TRATAMIENTOS, (t) => ($('#demo-prog').textContent = t));
        toast(`${n} pacientes de prueba creados`);
        location.hash = '#/dashboard';
      } catch (err) {
        toast(err.message, 'error');
        e.target.disabled = false;
      }
    };
    $('#btn-reset').onclick = () => {
      if (!confirm('¿Borrar todas las solicitudes y carpetas guardadas en este navegador? No se puede deshacer.')) return;
      S.reiniciar();
      toast('Datos locales borrados');
      render();
    };
  }
  async function conectar() {
    try {
      await S.conectarGoogle();
      await S.cargar();
      toast('Conectado a Google Drive');
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ================================================================== RUTEO
  const VISTAS = {
    registro: [vistaRegistro, initRegistro],
    carga: [vistaCarga, initCarga],
    dashboard: [vistaDashboard, initDashboard],
    archivos: [vistaArchivos, initArchivos],
    config: [vistaConfig, initConfig],
  };
  const ruta = () => (location.hash.slice(2) || 'registro').split('/')[0];

  function render() {
    const r = VISTAS[ruta()] ? ruta() : 'registro';
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#/' + r));
    const modo = S.modo;
    $('#modo').innerHTML = modo === 'local' ? '<span class="pill t-gray">Modo local</span>'
      : modo === 'drive' ? '<span class="pill t-green">Google Drive conectado</span>'
      : '<button class="btn btn-sm btn-blue" id="btn-con">Conectar Google Drive</button>';
    const bc = $('#btn-con');
    if (bc) bc.onclick = conectar;
    const main = $('#main');
    if (modo === 'drive-desconectado' && r !== 'config') {
      main.innerHTML = `<div class="card empty-big"><h2>Conecte Google Drive</h2><p>La app está configurada para guardar en Google Drive.</p><button class="btn btn-blue btn-lg" id="btn-con2">Conectar Google Drive</button> <a class="btn btn-ghost btn-lg" href="#/config">Configuración</a></div>`;
      $('#btn-con2').onclick = conectar;
      return;
    }
    main.innerHTML = VISTAS[r][0]();
    VISTAS[r][1]();
  }

  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });

  // refrescar al volver a la pestaña (otro usuario pudo cambiar datos en Drive / otra pestaña)
  window.addEventListener('focus', async () => {
    if ((S.modo === 'local' || S.modo === 'drive') && ['dashboard', 'archivos'].includes(ruta())) {
      const activo = document.activeElement;
      if (activo && /INPUT|TEXTAREA|SELECT/.test(activo.tagName)) return;
      await S.cargar().catch(() => {});
      if (vencerPlazos()) await S.guardar().catch(() => {});
      render();
    }
  });

  (async function iniciar() {
    if (S.modo !== 'drive-desconectado') {
      await S.cargar();
      if (vencerPlazos()) await S.guardar();
    }
    render();
  })();
})();
