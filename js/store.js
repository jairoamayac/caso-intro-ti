/* Almacenamiento de la aplicación.
 * Dos modos:
 *  - "local": todo queda en este navegador (localStorage + IndexedDB para archivos).
 *  - "drive": carpetas y archivos en Google Drive (API de Google Drive v3) y el estado
 *    compartido en un archivo solicitudes.json dentro de la carpeta raíz.
 */
(function () {
  const STATE_KEY = 'niagara-pa:estado';
  const CFG_KEY = 'niagara-pa:config';
  const ROOT_NAME = 'Niágara - Historias clínicas';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';

  const emptyState = () => ({ solicitudes: [], carpetas: {}, mensajes: [], notificaciones: [] });

  const config = Object.assign(
    { modo: (window.APP_CONFIG && window.APP_CONFIG.modo) || 'local', clientId: (window.APP_CONFIG && window.APP_CONFIG.googleClientId) || '', diasApelacion: 10, coordinadorGeneral: '' },
    JSON.parse(localStorage.getItem(CFG_KEY) || '{}'),
  );
  if (!config.clientId && window.APP_CONFIG) config.clientId = window.APP_CONFIG.googleClientId || '';
  const saveConfig = () => localStorage.setItem(CFG_KEY, JSON.stringify(config));

  // ------------------------------------------------------------------ IndexedDB (modo local)
  let dbPromise;
  function idb() {
    dbPromise ||= new Promise((res, rej) => {
      const r = indexedDB.open('niagara-pa-archivos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archivos', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbPromise;
  }
  async function idbPut(rec) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('archivos', 'readwrite');
      tx.objectStore('archivos').put(rec);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(id) {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction('archivos').objectStore('archivos').get(id);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  }

  // ------------------------------------------------------------------ Google Drive
  const google = { token: null, expira: 0, rootId: null, stateFileId: null, tokenClient: null };

  function driveReady() {
    return config.modo === 'drive' && google.token && Date.now() < google.expira;
  }

  function conectarGoogle() {
    return new Promise((resolve, reject) => {
      if (!config.clientId) return reject(new Error('Falta el Client ID de Google (ver Configuración).'));
      if (!window.google || !window.google.accounts) return reject(new Error('No cargó la librería de Google. Revise la conexión a internet.'));
      google.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: config.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          google.token = resp.access_token;
          google.expira = Date.now() + (resp.expires_in - 60) * 1000;
          try {
            google.rootId = await buscarOCrearCarpeta(ROOT_NAME, 'root');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      });
      google.tokenClient.requestAccessToken({ prompt: google.token ? '' : 'consent' });
    });
  }

  async function gapi(url, opts = {}) {
    if (!driveReady()) throw new Error('La sesión de Google expiró. Vuelva a conectar.');
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + google.token, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error('Google Drive respondió ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }
  const qs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function buscar(nombre, padre, carpeta) {
    const q = `name='${qs(nombre)}' and '${padre}' in parents and trashed=false` + (carpeta ? ` and mimeType='${FOLDER_MIME}'` : '');
    const r = await gapi('https://www.googleapis.com/drive/v3/files?fields=files(id,name)&q=' + encodeURIComponent(q));
    return (await r.json()).files[0];
  }

  async function buscarOCrearCarpeta(nombre, padre) {
    const f = await buscar(nombre, padre, true);
    if (f) return f.id;
    const r = await gapi('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: FOLDER_MIME, parents: [padre] }),
    });
    return (await r.json()).id;
  }

  async function subirMultipart(metadata, blob, fileId) {
    const boundary = 'niagara' + Math.random().toString(36).slice(2);
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ]);
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime';
    const r = await gapi(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
    return r.json();
  }

  async function leerEstadoDrive() {
    const f = await buscar('solicitudes.json', google.rootId, false);
    if (!f) return emptyState();
    google.stateFileId = f.id;
    const r = await gapi(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`);
    return Object.assign(emptyState(), await r.json());
  }

  async function guardarEstadoDrive(state) {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    if (google.stateFileId) {
      await subirMultipart({}, blob, google.stateFileId);
    } else {
      const f = await subirMultipart({ name: 'solicitudes.json', parents: [google.rootId] }, blob);
      google.stateFileId = f.id;
    }
  }

  // ------------------------------------------------------------------ API pública
  let state = emptyState();

  const Store = {
    config,
    get state() {
      return state;
    },
    get modo() {
      return config.modo === 'drive' ? (driveReady() ? 'drive' : 'drive-desconectado') : 'local';
    },
    saveConfig,
    conectarGoogle,

    async cargar() {
      state = this.modo === 'drive' ? await leerEstadoDrive() : Object.assign(emptyState(), JSON.parse(localStorage.getItem(STATE_KEY) || '{}'));
      return state;
    },

    async guardar() {
      if (this.modo === 'drive') await guardarEstadoDrive(state);
      else if (this.modo === 'local') localStorage.setItem(STATE_KEY, JSON.stringify(state));
      else throw new Error('Conecte Google Drive para guardar.');
    },

    existeCarpeta(pid) {
      return Boolean(state.carpetas[pid]);
    },

    /** Crea la carpeta de historia clínica del paciente (si no existe). */
    async crearCarpeta(pid, nombre) {
      if (state.carpetas[pid]) return state.carpetas[pid];
      const carpeta = { pacienteId: pid, paciente: nombre, creada: new Date().toISOString(), archivos: [] };
      if (this.modo === 'drive') carpeta.driveId = await buscarOCrearCarpeta(`${pid} - ${nombre}`, google.rootId);
      state.carpetas[pid] = carpeta;
      return carpeta;
    },

    /** Guarda un archivo en la carpeta del paciente. meta: {profesionalId, profesional, seccion, requerimiento} */
    async subirArchivo(pid, file, meta) {
      const carpeta = state.carpetas[pid];
      if (!carpeta) throw new Error('No existe carpeta para el ID ' + pid);
      const rec = {
        id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nombre: file.name,
        tipo: file.type,
        tamano: file.size,
        fecha: new Date().toISOString(),
        ...meta,
      };
      if (this.modo === 'drive') {
        const f = await subirMultipart(
          { name: file.name, parents: [carpeta.driveId], description: `Cargado por ${meta.profesional} (${meta.profesionalId}) - ${meta.seccion || ''}` },
          file,
        );
        rec.driveId = f.id;
        rec.link = f.webViewLink;
      } else {
        await idbPut({ id: rec.id, blob: file });
      }
      carpeta.archivos.push(rec);
      return rec;
    },

    /** Devuelve una URL para abrir el archivo. */
    async urlArchivo(rec) {
      if (rec.link) return rec.link;
      const r = await idbGet(rec.id);
      if (!r) throw new Error('El archivo no está en este navegador (fue cargado en otro equipo en modo local).');
      return URL.createObjectURL(r.blob);
    },

    reiniciar() {
      state = emptyState();
      localStorage.removeItem(STATE_KEY);
    },
  };

  window.Store = Store;
})();
