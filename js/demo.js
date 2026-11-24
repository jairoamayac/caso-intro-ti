/* Datos de prueba: crea pacientes, carpetas (con documentos PDF) y solicitudes en todos los estados.
 * Funciona igual en modo local y en Google Drive (en Drive crea las carpetas y sube los PDF de verdad). */
(function () {
  const DIA = 86400000;
  const iso = (dias) => new Date(Date.now() + dias * DIA).toISOString();
  const soloFecha = (dias) => iso(dias).slice(0, 10);

  /** PDF mínimo válido de una página con texto (sin tildes para no depender de fuentes). */
  function pdf(titulo, lineas) {
    const limpio = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '');
    const texto = [titulo, '', ...lineas].map(limpio);
    const stream = 'BT /F1 12 Tf 60 760 Td 16 TL ' + texto.map((t, i) => (i === 0 ? `/F1 16 Tf (${t}) Tj T* /F1 11 Tf` : `(${t}) Tj T*`)).join(' ') + ' ET';
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let out = '%PDF-1.4\n';
    const offs = [];
    objs.forEach((o, i) => {
      offs.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  }

  const MED = [
    { id: 'MED-1021', nombre: 'Dra. Laura Méndez' },
    { id: 'MED-1034', nombre: 'Dr. Andrés Rivas' },
    { id: 'MED-1047', nombre: 'Dra. Camila Ortiz' },
  ];
  const PROF = {
    'Imágenes diagnósticas': { id: 'PRO-201', nombre: 'Carlos Ruiz' },
    'Laboratorio clínico': { id: 'PRO-305', nombre: 'Diana Torres' },
    'Medicina general': { id: 'PRO-118', nombre: 'Julián Castro' },
    'Historia clínica / Archivo': { id: 'PRO-402', nombre: 'Sandra Pineda' },
    Ortopedia: { id: 'PRO-220', nombre: 'Felipe Guzmán' },
    Cardiología: { id: 'PRO-231', nombre: 'Natalia Rojas' },
  };
  // en qué sección se genera cada requerimiento
  const SECCION_DE = {
    'Orden médica firmada': 'Medicina general',
    'Historia clínica': 'Historia clínica / Archivo',
    'Radiografía previa': 'Imágenes diagnósticas',
    'Soporte de tratamiento previo (6 semanas)': 'Ortopedia',
    'Valoración prequirúrgica': 'Ortopedia',
    'Exámenes de laboratorio': 'Laboratorio clínico',
    'Consentimiento informado': 'Medicina general',
    Electrocardiograma: 'Cardiología',
    'Remisión del médico general': 'Medicina general',
    'Fórmula médica': 'Medicina general',
    'Justificación médica': 'Medicina general',
  };

  // estado: nueva | en_proceso | aprobada | revision_rechazo | apelacion | rechazada_desc | rechazada_apel
  const CASOS = [
    { nombre: 'María Fernanda López', id: '52431877', eps: 'Sanitas', trat: 'Resonancia magnética', med: 0, prio: true, estado: 'nueva', docs: 2, dias: -1 },
    { nombre: 'Jorge Enrique Salas', id: '79120554', eps: 'Nueva EPS', trat: 'Cirugía programada', med: 0, prio: false, estado: 'nueva', docs: 1, dias: -2 },
    { nombre: 'Luz Marina Cárdenas', id: '41775902', eps: 'Sisbén / Subsidiado', trat: 'Ecocardiograma', med: 2, prio: true, estado: 'en_proceso', docs: 2, dias: -3, msg: true },
    { nombre: 'Santiago Herrera', id: '1020774310', eps: 'Colsanitas (Prepagada)', trat: 'Colonoscopia', med: 1, prio: false, estado: 'en_proceso', docs: 3, dias: -2 },
    { nombre: 'Ana Sofía Beltrán', id: '1032455981', eps: 'EPS Sura', trat: 'Consulta con especialista', med: 2, prio: false, estado: 'aprobada', docs: 2, dias: -8 },
    { nombre: 'Carlos Arturo Peña', id: '19442180', eps: 'Compensar', trat: 'Medicamento de alto costo', med: 1, prio: true, estado: 'revision_rechazo', docs: 4, dias: -9,
      razon: 'El medicamento no está incluido en el plan de beneficios del afiliado.' },
    { nombre: 'Diana Patricia Mora', id: '39661027', eps: 'Famisanar', trat: 'Resonancia magnética', med: 0, prio: false, estado: 'apelacion', docs: 4, dias: -15,
      razon: 'No se evidencia tratamiento conservador previo suficiente.' },
    { nombre: 'Ricardo Vélez', id: '80244913', eps: 'Salud Total', trat: 'Terapia física (10 sesiones)', med: 0, prio: false, estado: 'rechazada_desc', docs: 3, dias: -30,
      razon: 'Falta valoración de fisiatría vigente.' },
    { nombre: 'Valentina Ríos', id: '1015338472', eps: 'Coomeva Prepagada', trat: 'Cirugía programada', med: 1, prio: false, estado: 'rechazada_apel', docs: 5, dias: -40,
      razon: 'Procedimiento considerado estético por la aseguradora.', justAp: 'La aseguradora ratificó que el procedimiento no tiene fin terapéutico.' },
  ];

  async function crearDatosPrueba(S, TRATAMIENTOS, progreso = () => {}) {
    const st = S.state;
    let n = 0;
    for (const c of CASOS) {
      n++;
      progreso(`Creando ${n}/${CASOS.length}: carpeta ${c.id} – ${c.nombre}`);
      if (st.solicitudes.some((s) => s.paciente.id === c.id && s.demo)) continue; // ya existe
      await S.crearCarpeta(c.id, c.nombre);
      const reqs = TRATAMIENTOS[c.trat];
      const requisitos = reqs.map((t) => ({ texto: t, cumplido: false, archivoId: null }));
      // documentos cargados por las secciones
      for (const r of requisitos.slice(0, c.docs)) {
        const sec = SECCION_DE[r.texto] || 'Medicina general';
        const prof = PROF[sec];
        const nombreArchivo = r.texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/-+$/, '').toLowerCase() + `_${c.id}.pdf`;
        const contenido = pdf(r.texto, [
          `Paciente: ${c.nombre}  -  ID ${c.id}`,
          `Aseguradora: ${c.eps}`,
          `Tratamiento solicitado: ${c.trat}`,
          `Seccion: ${sec}`,
          `Profesional: ${prof.nombre} (${prof.id})`,
          `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
          '',
          'DOCUMENTO DE PRUEBA - datos ficticios para el proyecto Niagara.',
        ]);
        const file = new File([contenido], nombreArchivo, { type: 'application/pdf' });
        const rec = await S.subirArchivo(c.id, file, { profesionalId: prof.id, profesional: prof.nombre, seccion: sec, requerimiento: r.texto });
        r.cumplido = true;
        r.archivoId = rec.id;
      }
      const m = MED[c.med];
      const s = {
        id: `SOL-${String(st.solicitudes.length + 1).padStart(4, '0')}-P${n}`,
        demo: true,
        paciente: { nombre: c.nombre, id: c.id, correo: '' },
        eps: c.eps,
        tratamiento: c.trat,
        requisitos,
        medico: { ...m },
        fechaCita: soloFecha(c.dias + 20),
        prioritario: c.prio,
        estado: 'nueva',
        creada: iso(c.dias),
        historial: [{ fecha: iso(c.dias), texto: 'Solicitud registrada' + (c.prio ? ' como PRIORITARIA' : ''), por: 'Registro' }],
      };
      const h = (d, texto, por = 'Paula Gómez') => s.historial.push({ fecha: iso(d), texto, por });
      h(c.dias + 0.1, `${c.docs} archivo(s) cargado(s) por las secciones`, 'Carga de archivos');
      const coord = 'Paula Gómez';
      if (c.estado !== 'nueva') {
        Object.assign(s, { estado: 'en_proceso', coordinador: coord, tomada: iso(c.dias + 0.5) });
        h(c.dias + 0.5, 'Seleccionada para procesar');
      }
      if (c.msg) {
        const falta = requisitos.find((r) => !r.cumplido);
        st.mensajes.unshift({ id: 'm' + n, fecha: iso(c.dias + 0.6), solicitudId: s.id, pacienteId: c.id, asunto: `Información paciente – ID ${c.id}`,
          destinatario: SECCION_DE[falta.texto] || 'Medicina general', archivo: falta.texto, mensaje: 'Por favor cargarlo hoy, la paciente es prioritaria.', de: coord, estado: 'pendiente' });
        h(c.dias + 0.6, `Mensaje a ${SECCION_DE[falta.texto]}: solicita "${falta.texto}"`);
      }
      const notif = (para, texto, d) => st.notificaciones.unshift({ id: 'n' + n + para.length, fecha: iso(d), para, solicitudId: s.id, pacienteId: c.id, texto, correo: '' });
      if (c.estado === 'aprobada') {
        Object.assign(s, { estado: 'aprobada', aprobada: iso(c.dias + 2), aprobadaVia: 'Aseguradora' });
        h(c.dias + 2, 'Aprobada por la aseguradora');
        notif('Paciente', `Su solicitud de ${c.trat} fue APROBADA por ${c.eps}.`, c.dias + 2);
        notif('Coordinador general', `Solicitud ${s.id} (${c.nombre}) aprobada por ${c.eps}.`, c.dias + 2);
      }
      if (c.razon) {
        const fr = c.dias + 2;
        s.estado = 'revision_rechazo';
        s.rechazo = { fecha: iso(fr), razon: c.razon, limite: iso(fr + S.config.diasApelacion) };
        h(fr, 'Rechazada por la aseguradora: ' + c.razon);
        notif('Paciente', `Su solicitud fue rechazada por ${c.eps}. Razón: ${c.razon}. Puede apelar antes del ${new Date(s.rechazo.limite).toLocaleDateString('es-CO')}.`, fr);
        if (c.estado === 'apelacion' || c.estado === 'rechazada_apel') {
          s.estado = 'apelacion';
          s.apelacion = { fecha: iso(fr + 3), archivoId: null };
          h(fr + 3, 'El paciente envió la carta de apelación: pasa a apelaciones (en proceso)');
        }
        if (c.estado === 'rechazada_apel') {
          s.estado = 'rechazada';
          s.apelacion.resultado = 'rechazada';
          s.rechazoFinal = { tipo: 'Apelación rechazada', justificacion: c.justAp, fecha: iso(fr + 8) };
          h(fr + 8, 'Apelación rechazada: ' + c.justAp);
        }
        if (c.estado === 'rechazada_desc') {
          s.estado = 'rechazada';
          s.rechazoFinal = { tipo: 'Descartada (sin apelación)', justificacion: c.razon + ' · El paciente no envió carta de apelación a tiempo', fecha: iso(fr + S.config.diasApelacion) };
          h(fr + S.config.diasApelacion, 'Plazo de apelación vencido: solicitud descartada', 'Sistema');
        }
      }
      st.solicitudes.push(s);
      await S.guardar(); // se guarda paciente por paciente para no perder avance
    }
    progreso('');
    return CASOS.length;
  }

  window.crearDatosPrueba = crearDatosPrueba;
})();
