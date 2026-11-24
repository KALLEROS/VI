/* =========================================================
   Mapa VI · lógica de la app
   - Carga data/locations.json y data/trucos.json
   - Dibuja el mapa (Leaflet) con las teselas de tiles/
   - Filtros, ficha, lista con buscador, trucos y vista 3D
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Categorías: orden, color e icono ---------- */
  var CATEGORIAS = [
    { id: 'strip',      color: '#ff2d95', icono: '💃' },
    { id: 'bancos',     color: '#3ddc84', icono: '🏦' },
    { id: 'cajeros',    color: '#35d0e0', icono: '🏧' },
    { id: 'tiendas',    color: '#ff8a3d', icono: '🏪' },
    { id: 'deportivos', color: '#ff4d4d', icono: '🏎️' },
    { id: 'raros',      color: '#b388ff', icono: '💎' },
    { id: 'regalo',     color: '#ffd23f', icono: '🎁' },
    { id: 'loot',       color: '#c98b5a', icono: '💰' }
  ];
  var CAT = {};
  CATEGORIAS.forEach(function (c) { CAT[c.id] = c; });

  /* ---------- Sistema de coordenadas ----------
     Los datos usan metros del juego (x = este, y = norte) como gtadb.org.
     Las teselas empiezan en la esquina noroeste (x = -10300, y = 9500)
     y a zoom 0 un píxel equivale a 64 metros. */
  var X_MIN = -10300, Y_MAX = 9500, METROS_POR_PX = 64;
  var CRS_LEONIDA = L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1 / METROS_POR_PX, -X_MIN / METROS_POR_PX, -1 / METROS_POR_PX, Y_MAX / METROS_POR_PX)
  });
  // Límites de las teselas (sur, oeste) – (norte, este)
  var LIMITES_TESELAS = L.latLngBounds([-8932, X_MIN], [Y_MAX, 4036]);
  // Zona con tierra, para "ver todo"
  var LIMITES_TIERRA = L.latLngBounds([-7200, -8200], [8600, 3100]);

  /* ---------- Estado ---------- */
  var datos = null;          // contenido de locations.json
  var marcadores = {};       // id -> marcador de Leaflet
  var activas = {};          // categoría -> visible (true/false)
  var capas = {};            // categoría -> L.layerGroup
  var resaltado = null;

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var dominio = function (url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };

  /* ---------- Mapa ---------- */
  var mapa = L.map('mapa', {
    crs: CRS_LEONIDA,
    minZoom: 0,
    maxZoom: 7,
    zoomSnap: 0.25,
    zoomControl: false,
    attributionControl: false,
    maxBounds: LIMITES_TESELAS.pad(0.1),
    maxBoundsViscosity: 0.8,
    tap: false
  });

  L.tileLayer('tiles/{z}/{x}/{y}.jpg', {
    maxNativeZoom: 5,     // teselas propias hasta zoom 5 (0.5 px por metro)
    maxZoom: 7,           // más allá, Leaflet amplía la imagen
    bounds: LIMITES_TESELAS,
    noWrap: true,
    keepBuffer: 4
  }).addTo(mapa);

  mapa.fitBounds(LIMITES_TIERRA);

  $('#btn-mas').onclick = function () { mapa.zoomIn(1); };
  $('#btn-menos').onclick = function () { mapa.zoomOut(1); };
  $('#btn-todo').onclick = function () { mapa.flyToBounds(LIMITES_TIERRA, { duration: 0.6 }); };

  /* Vista 3D inclinada (CSS) */
  $('#btn-3d').onclick = function () {
    var on = document.body.classList.toggle('vista-3d');
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    // El mapa cambia de tamaño al inclinarse: avisamos a Leaflet y mantenemos el centro
    var centro = mapa.getCenter();
    setTimeout(function () {
      mapa.invalidateSize({ pan: false });
      mapa.setView(centro, mapa.getZoom() + (on ? 0.75 : -0.75), { animate: true });
    }, 550);
  };

  /* ---------- Marcadores ---------- */
  function crearIcono(item) {
    var c = CAT[item.categoria];
    var esStrip = item.categoria === 'strip';
    var tam = esStrip ? 66 : 42;
    return L.divIcon({
      className: 'pin pin-' + item.categoria + (item.verificado === 'sí' ? '' : ' no-verif'),
      html: '<div class="pin-interior" style="--c:' + c.color + '"><span>' + c.icono + '</span></div>',
      iconSize: [tam, tam],
      iconAnchor: [tam / 2, tam / 2]
    });
  }

  function pintarMarcadores() {
    CATEGORIAS.forEach(function (c) {
      capas[c.id] = L.layerGroup().addTo(mapa);
      activas[c.id] = true;
    });
    datos.items.forEach(function (item) {
      var m = L.marker([item.y, item.x], {
        icon: crearIcono(item),
        title: item.nombre,
        // Los strip clubs siempre encima de todo
        zIndexOffset: item.categoria === 'strip' ? 1000 : 0
      });
      m.on('click', function () { abrirFicha(item); });
      m.addTo(capas[item.categoria]);
      marcadores[item.id] = m;
    });
  }

  function resaltar(id) {
    if (resaltado && marcadores[resaltado]) {
      var el = marcadores[resaltado].getElement();
      if (el) el.classList.remove('resaltado');
    }
    resaltado = id;
    if (id && marcadores[id]) {
      var el2 = marcadores[id].getElement();
      if (el2) el2.classList.add('resaltado');
    }
  }

  /* ---------- Filtros ---------- */
  function pintarFiltros() {
    var nav = $('#filtros');
    nav.innerHTML = '';
    CATEGORIAS.forEach(function (c) {
      var n = datos.items.filter(function (i) { return i.categoria === c.id; }).length;
      var b = document.createElement('button');
      b.className = 'chip' + (c.id === 'strip' ? ' strip' : '');
      b.style.setProperty('--c', c.color);
      b.innerHTML = '<span>' + c.icono + '</span>' + esc(datos.categorias[c.id]) + ' <span class="num">' + n + '</span>';
      b.onclick = function () {
        activas[c.id] = !activas[c.id];
        b.classList.toggle('apagado', !activas[c.id]);
        if (activas[c.id]) capas[c.id].addTo(mapa); else mapa.removeLayer(capas[c.id]);
      };
      nav.appendChild(b);
    });
  }

  /* ---------- Ficha ---------- */
  function htmlFuentes(item) {
    var lista = [item.fuente].concat(item.fuentes_extra || []);
    return '<div class="fuentes"><b>Fuente' + (lista.length > 1 ? 's' : '') + ':</b>' +
      lista.map(function (u) {
        var etiqueta = dominio(u) === 'api.gtadb.org' ? 'gtadb.org (coordenadas)' : dominio(u);
        return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(etiqueta) + '</a>';
      }).join('') + '</div>';
  }

  function abrirFicha(item) {
    var c = CAT[item.categoria];
    var verif = item.verificado === 'sí'
      ? '<span class="estado si">✔ Verificado (2+ fuentes)</span>'
      : '<span class="estado no">[PENDIENTE DE VERIFICAR] una sola fuente o datos que no coinciden</span>';
    $('#ficha-contenido').innerHTML =
      '<div class="ficha">' +
        '<span class="ficha-cat" style="--c:' + c.color + '">' + c.icono + ' ' + esc(datos.categorias[item.categoria]) + '</span>' +
        '<h3>' + esc(item.nombre) + '</h3>' +
        '<p class="zona">📍 ' + esc(item.zona || '') + '</p>' +
        verif +
        '<p><b>Qué hacer ahí:</b> ' + esc(item.descripcion) + '</p>' +
        htmlFuentes(item) +
      '</div>';
    abrir('ficha');
    resaltar(item.id);
  }

  /* ---------- Abrir y cerrar hojas/paneles ---------- */
  function abrir(id) {
    var el = document.getElementById(id);
    el.classList.add(el.classList.contains('hoja') ? 'abierta' : 'abierto');
    el.setAttribute('aria-hidden', 'false');
  }
  function cerrar(id) {
    var el = document.getElementById(id);
    el.classList.remove('abierta', 'abierto');
    el.setAttribute('aria-hidden', 'true');
    if (id === 'ficha') resaltar(null);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cerrar]');
    if (b) cerrar(b.getAttribute('data-cerrar'));
  });
  mapa.on('click', function () { cerrar('ficha'); });

  /* ---------- Ir a un lugar desde la lista ---------- */
  function irA(id) {
    var item = datos.items.find(function (i) { return i.id === id; });
    if (!item) return;
    // Si su categoría está apagada, la encendemos
    if (!activas[item.categoria]) {
      var idx = CATEGORIAS.findIndex(function (c) { return c.id === item.categoria; });
      $('#filtros').children[idx].click();
    }
    cerrar('panel-lista');
    // Centramos un poco más abajo del punto para que la ficha no lo tape
    var z = 4.5;
    var p = mapa.project([item.y, item.x], z).add([0, mapa.getSize().y * 0.22]);
    mapa.flyTo(mapa.unproject(p, z), z, { duration: 0.8 });
    mapa.once('moveend', function () { abrirFicha(item); });
  }

  /* ---------- Lista y buscador ---------- */
  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function pintarLista(filtro) {
    var q = normalizar(filtro);
    var coincide = function (i) {
      return !q || normalizar(i.nombre + ' ' + (i.zona || '') + ' ' + i.descripcion).indexOf(q) !== -1;
    };
    var html = '<p class="aviso">' + esc(datos.meta.aviso_fuentes) + '<br><br>Los marcados [PENDIENTE] no tienen ubicación exacta confirmada y no aparecen en el mapa.</p>';
    var total = 0;
    CATEGORIAS.forEach(function (c) {
      var con = datos.items.filter(function (i) { return i.categoria === c.id && coincide(i); });
      var sin = datos.pendientes.filter(function (i) { return i.categoria === c.id && coincide(i); });
      if (!con.length && !sin.length) return;
      total += con.length + sin.length;
      html += '<div class="grupo"><h4><span class="bola" style="--c:' + c.color + '"></span>' + c.icono + ' ' + esc(datos.categorias[c.id]) + '</h4>';
      con.forEach(function (i) {
        html += '<button class="fila" data-ir="' + esc(i.id) + '"><span class="ico">' + c.icono + '</span>' +
          '<span class="txt"><b>' + esc(i.nombre) + '</b><small>' + esc(i.zona || '') +
          (i.verificado === 'sí' ? ' · ✔ verificado' : ' · sin verificar') + '</small></span><span class="flecha">›</span></button>';
      });
      sin.forEach(function (i) {
        html += '<div class="fila sin-punto"><span class="ico">❔</span><span class="txt">' +
          '<b><span class="pendiente-tag">PENDIENTE</span>' + esc(i.nombre) + '</b>' +
          '<small>' + esc(i.descripcion) + '<br><i>Motivo: ' + esc(i.motivo) + '</i> · ' +
          '<a href="' + esc(i.fuente) + '" target="_blank" rel="noopener">' + esc(dominio(i.fuente)) + '</a></small></span></div>';
      });
      html += '</div>';
    });
    if (!total) html += '<p class="aviso">Nada coincide con «' + esc(filtro) + '».</p>';
    $('#lista').innerHTML = html;
  }

  $('#lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (b) irA(b.getAttribute('data-ir'));
  });
  $('#buscador').addEventListener('input', function () { pintarLista(this.value); });
  $('#btn-lista').onclick = function () { cerrar('ficha'); abrir('panel-lista'); };

  /* ---------- Trucos e información ---------- */
  function linksFuentes(lista) {
    if (!lista || !lista.length) return '<span class="mini-fuentes">Sin fuente confirmada</span>';
    return '<span class="mini-fuentes">Fuente: ' + lista.map(function (u) {
      return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(dominio(u)) + '</a>';
    }).join('') + '</span>';
  }

  function pintarTrucos(t) {
    var pend = '<span class="pendiente-tag">PENDIENTE DE VERIFICAR</span>';
    var html = '<p class="aviso">' + esc(t.aviso) + '</p>';

    // Secciones de información
    t.secciones.forEach(function (s, n) {
      html += '<details class="seccion"' + (n === 0 ? ' open' : '') + '><summary>' + esc(s.titulo) + '</summary><div class="seccion-cuerpo">';
      s.datos.forEach(function (d) {
        html += '<div class="dato"><b>' + (d.pendiente ? pend : '') + esc(d.titulo) + '</b><p>' + esc(d.texto) + '</p>' + linksFuentes(d.fuentes) + '</div>';
      });
      html += '</div></details>';

      // Justo después de "Cómo activar", la lista de códigos
      if (s.id === 'como-trucos') {
        html += '<details class="seccion" open><summary>Lista de trucos</summary><div class="seccion-cuerpo">';
        t.trucos.forEach(function (tr) {
          html += '<div class="dato"><b>' + (tr.pendiente ? pend : '') + esc(tr.nombre) + '</b>' +
            (tr.codigo ? '<p class="codigo">' + esc(tr.codigo) + '</p>' : '') +
            '<p>' + (tr.codigo ? 'Requisito: ' : '') + esc(tr.desbloqueo) + (tr.nota ? ' <i>(' + esc(tr.nota) + ')</i>' : '') + '</p>' +
            linksFuentes(tr.fuentes) + '</div>';
        });
        html += '<div class="dato"><b>' + pend + 'Trucos sin código publicado todavía</b><p>' + t.sin_codigo.map(esc).join(' · ') + '</p></div>';
        html += '</div></details>';
      }
    });
    $('#trucos').innerHTML = html;
  }
  $('#btn-trucos').onclick = function () { cerrar('ficha'); abrir('panel-trucos'); };

  /* ---------- Carga de datos ---------- */
  Promise.all([
    fetch('data/locations.json').then(function (r) { return r.json(); }),
    fetch('data/trucos.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    datos = res[0];
    pintarMarcadores();
    pintarFiltros();
    pintarLista('');
    pintarTrucos(res[1]);
  }).catch(function (err) {
    console.error(err);
    alert('No se pudieron cargar los datos. Abre la app desde internet (GitHub Pages) al menos una vez.');
  });

  /* ---------- Modo sin conexión (service worker) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
