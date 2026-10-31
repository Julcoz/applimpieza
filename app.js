// ---------- Datos (se guardan en el propio celular) ----------
const KEY = 'limpieza-v1';
let db = JSON.parse(localStorage.getItem(KEY) || 'null') || { areas: [], personas: [], items: [], hechos: {} };
let tab = 'hoy';

const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nom = (list, ids) => (ids || []).map(id => (list.find(x => x.id === id) || {}).nombre).filter(Boolean).map(esc).join(', ');
const checks = (f, name) => [...f.querySelectorAll(`[name=${name}]:checked`)].map(c => c.value);
const vacio = t => `<p class="vacio">${t}</p>`;
const cajas = (list, name, aviso) => list.length
  ? `<div class="chips">${list.map(x => `<label><input type="checkbox" name="${name}" value="${x.id}"> ${esc(x.nombre)}</label>`).join('')}</div>`
  : `<small>${aviso}</small>`;
const sumar = (f, d) => { const x = new Date(f + 'T12:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

// Duración promedio (días) entre reposiciones de un artículo
function dura(i) {
  const r = i.repos || [];
  if (r.length < 2) return null;
  let s = 0;
  for (let k = 1; k < r.length; k++) s += (new Date(r[k]) - new Date(r[k - 1])) / 864e5;
  return Math.max(1, Math.round(s / (r.length - 1)));
}

// ---------- Pantallas ----------
const V = {
  hoy() {
    if (!db.areas.length) return vacio('Aún no hay áreas. Agrégalas en la pestaña Áreas.');
    const listas = db.areas.filter(a => db.hechos[a.id] === hoy()).length;
    return `<p class="prog">${listas} de ${db.areas.length} áreas limpias hoy</p>` + db.areas.map(a => {
      const ok = db.hechos[a.id] === hoy();
      return `<label class="fila ${ok ? 'ok' : ''}"><input type="checkbox" ${ok ? 'checked' : ''} onchange="marcar('${a.id}',this.checked)">
        <span><b>${esc(a.nombre)}</b><small>${nom(db.personas, a.personas) || 'Sin asignar'}</small></span></label>`;
    }).join('');
  },

  areas() {
    return `<form onsubmit="addArea(event)">
      <input name="nombre" placeholder="Nombre del área (ej. Baños piso 1)" required>
      <p class="lbl">Personas asignadas</p>${cajas(db.personas, 'p', 'Agrega personas para poder asignarlas.')}
      <button>Guardar área</button></form>` +
      (db.areas.length ? db.areas.map(a => `<div class="fila"><span><b>${esc(a.nombre)}</b>
        <small>${nom(db.personas, a.personas) || 'Sin asignar'}</small></span>
        <button class="x" onclick="del('areas','${a.id}')">Borrar</button></div>`).join('') : vacio('Todavía no registraste áreas.'));
  },

  personas() {
    return `<form onsubmit="addPersona(event)">
      <input name="nombre" placeholder="Nombre de la persona" required><button>Guardar persona</button></form>` +
      (db.personas.length ? db.personas.map(p => {
        const as = db.areas.filter(a => a.personas.includes(p.id)).map(a => esc(a.nombre)).join(', ');
        return `<div class="fila"><span><b>${esc(p.nombre)}</b><small>${as || 'Sin áreas asignadas'}</small></span>
          <button class="x" onclick="del('personas','${p.id}')">Borrar</button></div>`;
      }).join('') : vacio('Todavía no registraste personas.'));
  },

  inventario() {
    return `<form onsubmit="addItem(event)">
      <input name="nombre" placeholder="Artículo (ej. Cloro, escoba)" required>
      <select name="tipo"><option value="consumible">Consumible</option><option value="util">Útil (escoba, balde...)</option></select>
      <div class="par"><input name="cant" type="number" min="0" step="any" placeholder="Cantidad" required>
      <input name="unidad" placeholder="Unidad (litros, und)"></div>
      <input name="min" type="number" min="0" step="any" placeholder="Avisar cuando quede (mínimo)">
      <p class="lbl">¿Dónde se usa?</p>${cajas(db.areas, 'a', 'Agrega áreas para indicar dónde se usa.')}
      <button>Guardar artículo</button></form>` +
      (db.items.length ? db.items.map(i => {
        const d = dura(i), bajo = i.min > 0 && i.cant <= i.min, donde = nom(db.areas, i.areas);
        return `<div class="item ${bajo ? 'bajo' : ''}"><div>
          <b>${esc(i.nombre)}</b> <small>${i.tipo === 'util' ? 'Útil' : 'Consumible'}</small>
          <div class="cant">${i.cant} ${esc(i.unidad)}${bajo ? ' (queda poco)' : ''}</div>
          <small>${donde ? 'Se usa en: ' + donde : 'Sin área indicada'}</small>
          <small>${d ? `Se repone cada ~${d} días. Próxima compra hacia el ${sumar(i.repos[i.repos.length - 1], d)}` : 'Sin datos de duración: registra una reposición'}</small></div>
          <div class="acc"><button onclick="mover('${i.id}',-1)">-1</button><button onclick="mover('${i.id}',1)">+1</button>
          <button onclick="repuse('${i.id}')">Repuse</button><button class="x" onclick="del('items','${i.id}')">Borrar</button></div></div>`;
      }).join('') : vacio('Todavía no registraste artículos.'));
  },

  copia() {
    return `<p>Tus datos solo están en este celular. Guarda una copia de vez en cuando.</p>
      <div class="acc"><button onclick="exportar()">Exportar copia</button></div><p class="lbl">Importar copia</p>
      <input type="file" accept="application/json" onchange="importar(event)">`;
  }
};

// ---------- Acciones ----------
function marcar(id, v) { if (v) db.hechos[id] = hoy(); else delete db.hechos[id]; save(); render(); }
function addArea(e) { e.preventDefault(); const f = e.target; db.areas.push({ id: uid(), nombre: f.nombre.value.trim(), personas: checks(f, 'p') }); save(); render(); }
function addPersona(e) { e.preventDefault(); db.personas.push({ id: uid(), nombre: e.target.nombre.value.trim() }); save(); render(); }
function addItem(e) {
  e.preventDefault(); const f = e.target;
  db.items.push({ id: uid(), nombre: f.nombre.value.trim(), tipo: f.tipo.value, cant: +f.cant.value || 0,
    unidad: f.unidad.value.trim(), min: +f.min.value || 0, areas: checks(f, 'a'), repos: [hoy()] });
  save(); render();
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
  save(); render();
}
function exportar() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' }));
  a.download = 'limpieza-' + hoy() + '.json'; a.click();
}
function importar(e) {
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!d.areas || !d.items) throw 0; db = d; save(); render(); } catch { alert('El archivo no es una copia válida.'); } };
  r.readAsText(e.target.files[0]);
}

// ---------- Arranque ----------
const TABS = { hoy: 'Hoy', areas: 'Áreas', personas: 'Personas', inventario: 'Inventario', copia: 'Copia' };
function render() {
  document.getElementById('tabs').innerHTML = Object.entries(TABS).map(([k, v]) => `<button class="${k === tab ? 'on' : ''}" onclick="go('${k}')">${v}</button>`).join('');
  document.getElementById('vista').innerHTML = V[tab]();
}
function go(t) { tab = t; render(); scrollTo(0, 0); }
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
