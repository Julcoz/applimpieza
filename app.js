// ---------- Datos (se guardan en el propio celular) ----------
const KEY = 'limpieza-v1';
let db = { areas: [], personas: [], items: [], hechos: {}, hist: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') };
let tab = 'hoy', ed = null, todas = false, filtro = '', ip = null;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let tt;
function aviso() {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = 'Guardado'; t.className = 'on'; clearTimeout(tt); tt = setTimeout(() => t.className = '', 1500);
}
const save = () => { localStorage.setItem(KEY, JSON.stringify(db)); aviso(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomL = (list, ids) => (ids || []).map(id => (list.find(x => x.id === id) || {}).nombre).filter(Boolean);
const nom = (l, i) => nomL(l, i).map(esc).join(', ');
const checks = (f, name) => [...f.querySelectorAll(`[name=${name}]:checked`)].map(c => c.value);
const vacio = t => `<p class="vacio">${t}</p>`;
const cajas = (list, name, aviso, sel = []) => list.length
  ? `<div class="chips">${list.map(x => `<label><input type="checkbox" name="${name}" value="${x.id}" ${sel.includes(x.id) ? 'checked' : ''}> ${esc(x.nombre)}</label>`).join('')}</div>`
  : `<small>${aviso}</small>`;
const sumar = (f, d) => { const x = new Date(f + 'T12:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const fmt = f => new Date(f + 'T12:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
const toca = a => !(a.dias || []).length || a.dias.includes(new Date().getDay());
const cur = k => (ed && ed.k === k) ? db[k].find(x => x.id === ed.id) : null;

// Duración promedio (días) entre reposiciones
function dura(i) {
  const r = i.repos || [];
  if (r.length < 2) return null;
  let s = 0;
  for (let k = 1; k < r.length; k++) s += (new Date(r[k]) - new Date(r[k - 1])) / 864e5;
  return Math.max(1, Math.round(s / (r.length - 1)));
}
const proxima = i => { const d = dura(i); return d ? sumar(i.repos[i.repos.length - 1], d) : null; };
const pocos = i => i.min > 0 && i.cant <= i.min;
const urge = i => pocos(i) || (proxima(i) && proxima(i) <= sumar(hoy(), 3));

const botones = (k, id) => `<div class="acc fijo"><button class="sec" onclick="editar('${k}','${id}')">Editar</button><button class="x" onclick="del('${k}','${id}')">Borrar</button></div>`;
const formBtns = e => `<button>${e ? 'Guardar cambios' : 'Guardar'}</button>${e ? '<button type="button" class="sec" onclick="cancelar()">Cancelar</button>' : ''}`;

// ---------- Pantallas ----------
const V = {
  hoy() {
    const comprar = db.items.filter(urge);
    let h = comprar.length ? `<div class="aviso">Por comprar pronto: ${comprar.map(i => esc(i.nombre)).join(', ')}</div>` : '';
    if (!db.areas.length) return h + vacio('Aún no hay áreas. Agrégalas en la pestaña Áreas.');
    const lista = db.areas.filter(a => (todas || toca(a)) && (!filtro || a.personas.includes(filtro)));
    const listas = lista.filter(a => db.hechos[a.id] === hoy()).length;
    h += `<p class="fecha">${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</p><div class="par"><select onchange="filtro=this.value;render()"><option value="">Todas las personas</option>${db.personas.map(p => `<option value="${p.id}" ${filtro === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
      <button class="sec" onclick="todas=!todas;render()">${todas ? 'Solo las de hoy' : 'Ver todas'}</button></div>
      <p class="prog">${listas} de ${lista.length} áreas limpias</p>`;
    return h + (lista.length ? lista.map(a => {
      const ok = db.hechos[a.id] === hoy();
      return `<label class="fila ${ok ? 'ok' : ''}"><input type="checkbox" ${ok ? 'checked' : ''} onchange="marcar('${a.id}',this.checked)">
        <span><b>${esc(a.nombre)}</b><small>${nom(db.personas, a.personas) || 'Sin asignar'}</small><small>${(a.dias || []).length ? a.dias.map(n => DIAS[n]).join(', ') : 'Todos los días'}</small></span></label>`;
    }).join('') : vacio('No hay áreas para hoy con este filtro.'));
  },

  areas() {
    const e = cur('areas');
    return `<form onsubmit="saveArea(event)">
      <input name="nombre" placeholder="Nombre del área (ej. Baños piso 1)" value="${esc(e?.nombre)}" required>
      <p class="lbl">Personas asignadas</p>${cajas(db.personas, 'p', 'Agrega personas para poder asignarlas.', e?.personas)}
      <p class="lbl">Días que toca limpiar (sin marcar = todos los días)</p>
      <div class="chips">${DIAS.map((d, n) => `<label><input type="checkbox" name="d" value="${n}" ${e?.dias?.includes(n) ? 'checked' : ''}> ${d}</label>`).join('')}</div>
      ${formBtns(e)}</form>` +
      (db.areas.length ? db.areas.map(a => `<div class="fila"><span><b>${esc(a.nombre)}</b>
        <small>${nom(db.personas, a.personas) || 'Sin asignar'}</small>
        <small>${(a.dias || []).length ? (a.dias.map(n => DIAS[n]).join(', ')) : 'Todos los días'}</small></span>${botones('areas', a.id)}</div>`).join('') : vacio('Todavía no registraste áreas.'));
  },

  personas() {
    const e = cur('personas');
    return `<form onsubmit="savePersona(event)">
      <input name="nombre" placeholder="Nombre de la persona" value="${esc(e?.nombre)}" required>
      <input name="tel" type="tel" placeholder="Teléfono (opcional)" value="${esc(e?.tel)}">${formBtns(e)}</form>` +
      (db.personas.length ? db.personas.map(p => {
        const as = db.areas.filter(a => a.personas.includes(p.id)).map(a => esc(a.nombre)).join(', ');
        return `<div class="fila"><span><b>${esc(p.nombre)}</b>${p.tel ? `<small><a href="tel:${esc(p.tel)}">${esc(p.tel)}</a></small>` : ''}
          <small>${as || 'Sin áreas asignadas'}</small></span>${botones('personas', p.id)}</div>`;
      }).join('') : vacio('Todavía no registraste personas.'));
  },

  inventario() {
    const e = cur('items'), comprar = db.items.filter(urge);
    return (comprar.length ? `<div class="aviso">Por comprar: ${comprar.map(i => esc(i.nombre)).join(', ')}<button class="sec" onclick="compartir()">Compartir lista</button></div>` : '') +
      `<form onsubmit="saveItem(event)">
      <input name="nombre" placeholder="Artículo (ej. Cloro, escoba)" value="${esc(e?.nombre)}" required>
      <select name="tipo"><option value="consumible" ${e?.tipo === 'consumible' ? 'selected' : ''}>Consumible</option><option value="util" ${e?.tipo === 'util' ? 'selected' : ''}>Útil (escoba, balde...)</option></select>
      <div class="par"><input name="cant" type="number" min="0" step="any" placeholder="Cantidad" value="${e ? e.cant : ''}" required>
      <input name="unidad" placeholder="Unidad (litros, und)" value="${esc(e?.unidad)}"></div>
      <input name="min" type="number" min="0" step="any" placeholder="Avisar cuando quede (mínimo)" value="${e?.min || ''}">
      <p class="lbl">¿Dónde se usa?</p>${cajas(db.areas, 'a', 'Agrega áreas para indicar dónde se usa.', e?.areas)}
      ${formBtns(e)}</form>` +
      (db.items.length ? db.items.map(i => {
        const d = dura(i), donde = nom(db.areas, i.areas);
        return `<div class="item ${urge(i) ? 'bajo' : ''}"><div>
          <b>${esc(i.nombre)}</b> <small>${i.tipo === 'util' ? 'Útil' : 'Consumible'}</small>
          <div class="cant">${i.cant} ${esc(i.unidad)}${pocos(i) ? ' (queda poco)' : ''}</div>
          <small>${donde ? 'Se usa en: ' + donde : 'Sin área indicada'}</small>
          <small>${d ? `Se repone cada ~${d} días. Próxima compra hacia el ${fmt(proxima(i))}` : 'Sin datos de duración: registra una reposición'}</small></div>
          <div class="acc"><button onclick="mover('${i.id}',-1)">-1</button><button onclick="mover('${i.id}',1)">+1</button>
          <button onclick="repuse('${i.id}')">Repuse</button><button class="sec" onclick="editar('items','${i.id}')">Editar</button><button class="x" onclick="del('items','${i.id}')">Borrar</button></div></div>`;
      }).join('') : vacio('Todavía no registraste artículos.'));
  },

  historial() {
    const sem = db.hist.filter(r => r.f >= sumar(hoy(), -6)).length;
    if (!db.hist.length) return vacio('Aquí verás qué áreas se limpiaron y quién las tenía asignadas.');
    let f = '', o = `<p class="prog">Últimos 7 días: ${sem} limpiezas registradas</p>`;
    for (const r of [...db.hist].reverse().slice(0, 150)) {
      if (r.f !== f) { f = r.f; o += `<p class="lbl">${fmt(r.f)}</p>`; }
      o += `<div class="fila"><span><b>${esc(r.an)}</b><small>${esc(r.p) || 'Sin asignar'}</small></span></div>`;
    }
    return o;
  },

  copia() {
    return `${ip ? '<button onclick="instalar()">Instalar app en este celular</button>' : ''}
      <p>Tus datos solo están en este celular. Guarda una copia de vez en cuando, sobre todo antes de limpiar el navegador.</p>
      <div class="acc"><button onclick="exportar()">Exportar copia</button></div><p class="lbl">Importar copia</p>
      <input type="file" accept="application/json" onchange="importar(event)">`;
  }
};

// ---------- Acciones ----------
function guardar(k, obj, extra = {}) {
  if (ed && ed.k === k) Object.assign(db[k].find(x => x.id === ed.id), obj);
  else db[k].push({ id: uid(), ...obj, ...extra });
  ed = null; save(); render(); scrollTo(0, 0);
}
function saveArea(e) { e.preventDefault(); const f = e.target; guardar('areas', { nombre: f.nombre.value.trim(), personas: checks(f, 'p'), dias: checks(f, 'd').map(Number) }); }
function savePersona(e) { e.preventDefault(); const f = e.target; guardar('personas', { nombre: f.nombre.value.trim(), tel: f.tel.value.trim() }); }
function saveItem(e) {
  e.preventDefault(); const f = e.target;
  guardar('items', { nombre: f.nombre.value.trim(), tipo: f.tipo.value, cant: +f.cant.value || 0, unidad: f.unidad.value.trim(), min: +f.min.value || 0, areas: checks(f, 'a') }, { repos: [hoy()] });
}
function editar(k, id) { ed = { k, id }; render(); scrollTo(0, 0); }
function cancelar() { ed = null; render(); }
function marcar(id, v) {
  const a = db.areas.find(x => x.id === id);
  db.hist = db.hist.filter(r => !(r.a === id && r.f === hoy()));
  if (v) { db.hechos[id] = hoy(); db.hist.push({ f: hoy(), a: id, an: a.nombre, p: nomL(db.personas, a.personas).join(', ') }); }
  else delete db.hechos[id];
  db.hist = db.hist.slice(-1000); save(); render();
}
function mover(id, d) { const i = db.items.find(x => x.id === id); i.cant = Math.max(0, i.cant + d); save(); render(); }
function repuse(id) {
  const i = db.items.find(x => x.id === id);
  const n = parseFloat(prompt('¿Cuántas unidades repusiste?', '1'));
  if (!(n > 0)) return;
  i.cant += n; i.repos.push(hoy()); save(); render();
}
function del(k, id) {
  if (!confirm('¿Borrar este registro?')) return;
  db[k] = db[k].filter(x => x.id !== id);
  if (k === 'personas') db.areas.forEach(a => a.personas = a.personas.filter(p => p !== id));
  if (k === 'areas') db.items.forEach(i => i.areas = (i.areas || []).filter(a => a !== id));
  ed = null; save(); render();
}
function compartir() {
  const t = 'Lista de compras de limpieza:\n' + db.items.filter(urge).map(i => `- ${i.nombre} (quedan ${i.cant} ${i.unidad})`).join('\n');
  if (navigator.share) navigator.share({ text: t }).catch(() => {});
  else location.href = 'https://wa.me/?text=' + encodeURIComponent(t);
}
function exportar() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' }));
  a.download = 'limpieza-' + hoy() + '.json'; a.click();
}
function importar(e) {
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!d.areas || !d.items) throw 0; db = { hist: [], hechos: {}, personas: [], ...d }; save(); render(); } catch { alert('El archivo no es una copia válida.'); } };
  r.readAsText(e.target.files[0]);
}
function instalar() { ip.prompt(); ip = null; render(); }

// ---------- Arranque ----------
const TABS = { hoy: 'Hoy', areas: 'Áreas', personas: 'Personas', inventario: 'Inventario', historial: 'Historial', copia: 'Más' };
function render() {
  document.getElementById('tabs').innerHTML = Object.entries(TABS).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" onclick="go('${k}')">${v}</button>`).join('');
  document.getElementById('vista').innerHTML = V[tab]();
}
function go(t) { tab = t; ed = null; render(); scrollTo(0, 0); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; if (tab === 'copia') render(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
