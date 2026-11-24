/* =========================================================
   Mapa VI · lógica de la app
   - Carga data/locations.json y data/trucos.json
   - Dibuja el mapa (Leaflet) con las teselas de tiles/
   - Filtros, ficha, lista con buscador, trucos y vista 3D
   - Progreso, favoritos, marcas propias, compartir y ruta de golpes
   Usa js/guardado.js, js/grupos.js y js/ruta.js (se cargan antes).
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
    { id: 'loot',       color: '#c98b5a', icono: '💰' },
    { id: 'peristas',   color: '#9ad14b', icono: '🤝' },
    { id: 'cajas',      color: '#e0b23a', icono: '🔐' },
    { id: 'remolcables',color: '#4fb0ff', icono: '🪝' },
    { id: 'marcas',     color: '#ffffff', icono: '📌' }   // marcas propias del usuario
  ];
  var CAT = {};
  // Icono redondo tipo "blip" del juego (para filtros, lista y ficha)
  var blip = function (c) { return '<span class="blip" style="--c:' + c.color + '">' + c.icono + '</span>'; };
  CATEGORIAS.forEach(function (c) { CAT[c.id] = c; });

  /* ---------- Sistema de coordenadas ----------
     Los datos usan metros del juego (x = este, y = norte) como gtadb.org.
     Las teselas siguen la cuadrícula de gtadb: el punto (0, 0) del juego está en el centro
     de un cuadro de 32768 m; a zoom 0 un píxel son 32 m y a zoom 6, medio metro. */
  var METROS_POR_PX = 32, MITAD = 16384;
  var CRS_LEONIDA = L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1 / METROS_POR_PX, MITAD / METROS_POR_PX, -1 / METROS_POR_PX, MITAD / METROS_POR_PX)
  });
  // Zona con tierra, para "ver todo"
  var LIMITES_TIERRA = L.latLngBounds([-7200, -8200], [8600, 3100]);
  // Zoom máximo: el último nivel con teselas propias (2 píxeles por metro).
  // Más allá la imagen solo se estira y se pixela, así que no se deja pasar de aquí.
  var ZOOM_MAX = 6;

  /* ---------- Estado ---------- */
  var datos = null;          // contenido de locations.json
  var marcadores = {};       // id -> marcador de Leaflet
  var activas = {};          // categoría -> visible (true/false)
  var capas = {};            // categoría -> L.layerGroup
  var resaltado = null;
  var porId = {};            // id -> lugar (incluye marcas propias)
  var ordenCat = {};         // categoría -> lugares en orden para ‹ ›
  var fichaActual = null;    // lugar abierto en la ficha
  var capaVisible = null;    // iconos que se ven ahora
  var capaTemporal = null;   // marca compartida que todavía no se guarda

  var G = window.MapaVI.guardado, GRUPOS = window.MapaVI.grupos, RUTA = window.MapaVI.ruta;

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
    minZoom: -1,          // se recalcula con ajustarZoom()
    maxZoom: ZOOM_MAX,
    zoomSnap: 0.25,
    zoomControl: false,
    attributionControl: false,
    maxBounds: LIMITES_TIERRA,
    maxBoundsViscosity: 1,  // no se puede arrastrar fuera del mapa
    tap: false
  });

  /* Capa de teselas: solo pide las que existen (tiles/indice.json).
     Donde no hay tesela es mar abierto y se ve el color de fondo. */
  var CapaLeonida = L.TileLayer.extend({
    createTile: function (coords, listo) {
      var lista = this.options.indice[coords.z];
      if (lista && lista[coords.y + ',' + coords.x]) return L.TileLayer.prototype.createTile.call(this, coords, listo);
      var vacia = document.createElement('div');
      setTimeout(function () { listo(null, vacia); }, 0);
      return vacia;
    }
  });

  fetch('tiles/indice.json').then(function (r) { return r.json(); }).then(function (indice) {
    // indice: { "z": ["y,x", ...] } -> lo pasamos a objetos para buscar rápido
    var rapido = {};
    Object.keys(indice).forEach(function (z) {
      rapido[z] = {};
      indice[z].forEach(function (k) { rapido[z][k] = true; });
    });
    new CapaLeonida('tiles/{z}/{z},{y},{x}.jpg', {
      indice: rapido,
      minNativeZoom: 0,
      maxNativeZoom: ZOOM_MAX,
      maxZoom: ZOOM_MAX,
      noWrap: true,
      keepBuffer: 4
    }).addTo(mapa);
  });

  /* Zoom mínimo: el mapa ocupa todo el alto del teléfono y no se puede achicar más,
     así nunca quedan bordes vacíos alrededor. Se recalcula al girar el teléfono. */
  function zoomMinimo() {
    var t = mapa.getSize();
    var alto = LIMITES_TIERRA.getNorth() - LIMITES_TIERRA.getSouth();
    var ancho = LIMITES_TIERRA.getEast() - LIMITES_TIERRA.getWest();
    // metros por píxel que llenan la pantalla a lo alto y a lo ancho; se usa el que no deja huecos
    var mpp = Math.min(alto / t.y, ancho / t.x);
    // redondeado hacia arriba a 1/4 (el paso del zoom) para no quedar nunca por debajo
    return Math.ceil(Math.log2(METROS_POR_PX / mpp) * 4) / 4;
  }
  function ajustarZoom() {
    var zMin = zoomMinimo();
    mapa.setMinZoom(zMin);
    if (mapa.getZoom() < zMin) mapa.setZoom(zMin, { animate: false });
  }
  mapa.setView(LIMITES_TIERRA.getCenter(), zoomMinimo(), { animate: false });
  ajustarZoom();
  mapa.on('resize', ajustarZoom);

  $('#btn-mas').onclick = function () { mapa.zoomIn(1); };
  $('#btn-menos').onclick = function () { mapa.zoomOut(1); };
  $('#btn-todo').onclick = function () { mapa.flyTo(LIMITES_TIERRA.getCenter(), mapa.getMinZoom(), { duration: 0.6 }); };

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
    // Tamaño parecido a los iconos del mapa del juego; los strip clubs un poco más grandes
    var tam = esStrip ? 34 : 24;
    var clases = 'pin pin-' + item.categoria;
    if (item.categoria !== 'marcas' && item.verificado !== 'sí') clases += ' no-verif';
    if (G.esEncontrado(item.id)) clases += ' encontrado';
    return L.divIcon({
      className: clases,
      html: '<div class="pin-interior" style="--c:' + c.color + '"><span>' + c.icono + '</span></div>',
      iconSize: [tam, tam],
      iconAnchor: [tam / 2, tam / 2]
    });
  }

  // Un marcador por lugar; se crea una vez y se reutiliza
  function marcadorDe(item) {
    var m = marcadores[item.id];
    if (!m) {
      m = L.marker([item.y, item.x], {
        icon: crearIcono(item),
        title: item.nombre,
        // Los strip clubs siempre encima de todo
        zIndexOffset: item.categoria === 'strip' ? 1000 : 0
      });
      m.on('click', function () {
        if (RUTA.activa) RUTA.alternar(porId[item.id] || item);
        else abrirFicha(porId[item.id] || item);
      });
      marcadores[item.id] = m;
    }
    return m;
  }

  // Icono de grupo: blip de la categoría con el número de lugares
  function iconoGrupo(c, n) {
    return L.divIcon({
      className: 'pin pin-grupo',
      html: '<div class="pin-interior" style="--c:' + c.color + '"><span>' + n + '</span></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  // Lugares de una categoría (las marcas propias salen de lo guardado)
  function itemsDe(cat) {
    if (cat === 'marcas') return marcasComoItems();
    return datos.items.filter(function (i) { return i.categoria === cat; });
  }
  function marcasComoItems() {
    return G.marcas().map(function (m) {
      return { id: m.id, nombre: m.nombre, categoria: 'marcas', x: m.x, y: m.y, zona: 'Marca propia (solo en este teléfono)' };
    });
  }

  /* Vuelve a dibujar los iconos visibles: categorías encendidas, sin los encontrados
     si así se pidió, y agrupados cuando el mapa está lejos. */
  function redibujar() {
    if (!datos) return;
    capaVisible.clearLayers();
    CATEGORIAS.forEach(function (c) {
      if (!activas[c.id]) return;
      var lista = itemsDe(c.id).filter(function (i) {
        return !(G.ocultarEncontrados() && G.esEncontrado(i.id)) || RUTA.tiene(porId[i.id]);
      });
      var grupos = (c.id === 'strip' || c.id === 'marcas')
        ? lista.map(function (i) { return { items: [i] }; })
        : GRUPOS.agrupar(mapa, lista);
      grupos.forEach(function (g) {
        if (g.items.length === 1) { marcadorDe(g.items[0]).addTo(capaVisible); return; }
        L.marker([g.lat, g.lng], { icon: iconoGrupo(c, g.items.length), title: g.items.length + ' lugares' })
          .on('click', function () {
            mapa.flyTo([g.lat, g.lng], Math.max(mapa.getZoom() + 1.5, GRUPOS.ZOOM_SIN_GRUPOS), { duration: 0.5 });
          })
          .addTo(capaVisible);
      });
    });
    resaltar(resaltado);
  }

  // Cuando cambia el progreso de un lugar se actualiza su icono, los contadores y la lista
  function refrescarLugar(item) {
    if (marcadores[item.id]) marcadores[item.id].setIcon(crearIcono(item));
    actualizarConteos();
    pintarLista($('#buscador').value);
    redibujar();
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

  /* Orden fijo para pasar de un lugar al siguiente con ‹ ›:
     empieza en el primero y siempre salta al más cercano que falte. */
  function cadena(lista) {
    if (lista.length < 3) return lista.slice();
    var resto = lista.slice(1), out = [lista[0]];
    while (resto.length) {
      var u = out[out.length - 1], k = 0;
      for (var i = 1; i < resto.length; i++) {
        if (Math.hypot(resto[i].x - u.x, resto[i].y - u.y) < Math.hypot(resto[k].x - u.x, resto[k].y - u.y)) k = i;
      }
      out.push(resto.splice(k, 1)[0]);
    }
    return out;
  }
  function hermanosDe(item) {
    return item.categoria === 'marcas' ? marcasComoItems() : ordenCat[item.categoria];
  }

  /* ---------- Nombres de zonas (Leonida, condados, ciudades, barrios) ----------
     Cada tipo se ve solo en ciertos niveles de zoom, como en el mapa del juego:
     de lejos el estado y los condados; al acercarse, ciudades, áreas y barrios. */
  var ZOOM_ETIQUETAS = {
    estado:  [-9, 1.5],
    condado: [0, 2.5],
    ciudad:  [1.5, 4.25],
    area:    [2.25, 5],
    barrio:  [3, 99]
  };
  var etiquetas = [];

  function pintarZonas(z) {
    mapa.createPane('etiquetas');
    mapa.getPane('etiquetas').style.zIndex = 450;          // encima de las teselas, debajo de los iconos
    mapa.getPane('etiquetas').style.pointerEvents = 'none';
    var lista = [{ nombre: z.estado.nombre, tipo: 'estado', x: z.estado.x, y: z.estado.y }].concat(z.zonas);
    lista.forEach(function (zona) {
      var m = L.marker([zona.y, zona.x], {
        pane: 'etiquetas',
        interactive: false,
        keyboard: false,
        // Los condados van en dos líneas ("CONDADO DE" / "KELLY") para que quepan en el teléfono
        icon: L.divIcon({ className: 'etiqueta etiqueta-' + zona.tipo, iconSize: null,
          html: '<span>' + esc(zona.nombre).replace(/^(Condado de) /, '<small>$1</small><br>') + '</span>' })
      }).addTo(mapa);
      etiquetas.push({ m: m, tipo: zona.tipo });
    });
    mostrarZonas();
    mapa.on('zoomend', mostrarZonas);
  }

  function mostrarZonas() {
    var z = mapa.getZoom();
    etiquetas.forEach(function (e) {
      var r = ZOOM_ETIQUETAS[e.tipo];
      var el = e.m.getElement();
      if (el) el.style.display = (z >= r[0] && z < r[1]) ? '' : 'none';
    });
  }

  /* ---------- Filtros ---------- */
  function activar(cat, on) {
    activas[cat] = on;
    var b = $('#filtros [data-cat="' + cat + '"]');
    if (b) b.classList.toggle('apagado', !on);
    redibujar();
  }

  function pintarFiltros() {
    var nav = $('#filtros');
    nav.innerHTML = '';
    CATEGORIAS.forEach(function (c) {
      var n = itemsDe(c.id).length;
      // Sin lugares en el mapa no tiene caso el botón (sus pendientes siguen en la lista)
      if (!n) return;
      var b = document.createElement('button');
      b.className = 'chip' + (activas[c.id] ? '' : ' apagado') + (c.id === 'strip' ? ' strip' : '');
      b.setAttribute('data-cat', c.id);
      b.style.setProperty('--c', c.color);
      b.innerHTML = blip(c) + esc(datos.categorias[c.id]) + ' <span class="num"></span>';
      b.onclick = function () { activar(c.id, !activas[c.id]); };
      nav.appendChild(b);
    });
    actualizarConteos();
  }

  // Contador de cada filtro: encontrados / total (las marcas propias solo cuentan)
  function actualizarConteos() {
    CATEGORIAS.forEach(function (c) {
      var num = $('#filtros [data-cat="' + c.id + '"] .num');
      if (!num) return;
      var ids = itemsDe(c.id).map(function (i) { return i.id; });
      num.textContent = c.id === 'marcas' ? ids.length : G.cuantosEncontrados(ids) + '/' + ids.length;
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
    fichaActual = item;
    var c = CAT[item.categoria];
    var esMarca = item.categoria === 'marcas';
    var html = '<div class="ficha">' +
      '<span class="ficha-cat">' + blip(c) + esc(datos.categorias[item.categoria]) + '</span>' +
      '<h3>' + esc(item.nombre) + '</h3>' +
      '<p class="zona">📍 ' + esc(item.zona || '') + '</p>';

    // Botones de acción, con el estilo de las filas del menú del juego
    var fav = G.esFavorito(item.id);
    html += '<div class="acciones">';
    if (item.temporal) {
      html += '<button class="accion ancha" data-accion="guardar-compartida">📌 Guardar en mis marcas</button>';
    } else if (esMarca) {
      html += '<button class="accion" data-accion="renombrar">✏️ Renombrar</button>' +
              '<button class="accion" data-accion="borrar">🗑 Borrar</button>';
    } else {
      var hecho = G.esEncontrado(item.id);
      html += '<button class="accion ancha' + (hecho ? ' on' : '') + '" data-accion="encontrado">' +
              '<span class="casilla">' + (hecho ? '✔' : '') + '</span>Encontrado</button>';
    }
    if (!item.temporal) {
      html += '<button class="accion icono' + (fav ? ' on' : '') + '" data-accion="favorito" aria-label="Favorito">' + (fav ? '★' : '☆') + '</button>';
    }
    html += '<button class="accion icono" data-accion="compartir" aria-label="Compartir">🔗</button></div>';

    if (!esMarca) {
      html += (item.verificado === 'sí'
        ? '<span class="estado si">✔ Verificado (2+ fuentes)</span>'
        : '<span class="estado no">[PENDIENTE DE VERIFICAR] una sola fuente o datos que no coinciden</span>') +
        '<p><b>Qué hacer ahí:</b> ' + esc(item.descripcion) + '</p>' + htmlFuentes(item);
    } else if (!item.temporal) {
      html += '<p class="aviso">Marca propia: solo se guarda en este teléfono. Para crear otra, deja presionado el mapa.</p>';
    }

    // ‹ 3 / 8 › para recorrer los lugares de la misma categoría
    var hermanos = item.temporal ? [] : hermanosDe(item);
    var pos = hermanos.findIndex(function (h) { return h.id === item.id; });
    if (hermanos.length > 1 && pos !== -1) {
      html += '<div class="pasar">' +
        '<button data-accion="anterior" aria-label="Anterior">‹</button>' +
        '<span>' + (pos + 1) + ' / ' + hermanos.length + '</span>' +
        '<button data-accion="siguiente" aria-label="Siguiente">›</button></div>';
    }
    html += '</div>';
    $('#ficha-contenido').innerHTML = html;
    abrir('ficha');
    resaltar(item.id);
  }

  // Botones dentro de la ficha
  $('#ficha-contenido').addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b || !fichaActual) return;
    var item = fichaActual, a = b.getAttribute('data-accion');
    if (a === 'encontrado') { G.alternarEncontrado(item.id); refrescarLugar(item); abrirFicha(item); }
    else if (a === 'favorito') { G.alternarFavorito(item.id); pintarLista($('#buscador').value); abrirFicha(item); }
    else if (a === 'compartir') compartir(item);
    else if (a === 'anterior' || a === 'siguiente') {
      var hs = hermanosDe(item);
      var p = hs.findIndex(function (h) { return h.id === item.id; });
      var otro = hs[(p + (a === 'siguiente' ? 1 : -1) + hs.length) % hs.length];
      irA(otro.id);
    }
    else if (a === 'renombrar') {
      var nuevo = prompt('Nuevo nombre de la marca:', item.nombre);
      if (nuevo && nuevo.trim()) { G.renombrarMarca(item.id, nuevo.trim()); recargarMarcas(); abrirFicha(porId[item.id]); }
    }
    else if (a === 'borrar') {
      if (confirm('¿Borrar la marca «' + item.nombre + '»?')) { G.borrarMarca(item.id); cerrar('ficha'); recargarMarcas(); }
    }
    else if (a === 'guardar-compartida') {
      var m = G.agregarMarca(item.nombre, item.x, item.y);
      if (marcadores[item.id]) { capaTemporal.clearLayers(); delete marcadores[item.id]; }
      recargarMarcas();
      activar('marcas', true);
      abrirFicha(porId[m.id]);
    }
  });

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
    if (id === 'ficha') { resaltar(null); fichaActual = null; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cerrar]');
    if (b) cerrar(b.getAttribute('data-cerrar'));
  });
  mapa.on('click', function () { cerrar('ficha'); });

  // Aviso corto abajo de la pantalla ("Enlace copiado", etc.)
  var temporizadorAviso = null;
  function aviso(texto) {
    var el = $('#aviso');
    el.textContent = texto;
    el.classList.add('visible');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { el.classList.remove('visible'); }, 2200);
  }

  /* ---------- Ir a un lugar (lista, ‹ ›, enlaces) ---------- */
  function irA(id) {
    var item = porId[id];
    if (!item) return;
    if (!activas[item.categoria]) activar(item.categoria, true);
    cerrar('panel-lista');
    // Centramos un poco más abajo del punto para que la ficha no lo tape
    var z = Math.max(mapa.getZoom(), 4);
    var p = mapa.project([item.y, item.x], z).add([0, mapa.getSize().y * 0.22]);
    mapa.flyTo(mapa.unproject(p, z), z, { duration: 0.8 });
    mapa.once('moveend', function () { abrirFicha(item); });
  }

  /* ---------- Compartir ---------- */
  function baseUrl() { return location.origin + location.pathname; }
  function compartir(item) {
    var url = baseUrl() + (item.categoria === 'marcas'
      ? '#p=' + item.x + ',' + item.y + ',' + encodeURIComponent(item.nombre)
      : '#l=' + encodeURIComponent(item.id));
    enviarEnlace(item.nombre + ' · Mapa VI', url);
  }
  function enviarEnlace(titulo, url) {
    if (navigator.share) {
      navigator.share({ title: titulo, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { aviso('Enlace copiado'); },
        function () { prompt('Copia el enlace:', url); });
    } else {
      prompt('Copia el enlace:', url);
    }
  }

  // Al abrir la app con un enlace compartido: #l=lugar, #p=x,y,nombre o #r=lugar1,lugar2…
  function leerEnlace() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    history.replaceState(null, '', baseUrl());
    if (h.indexOf('l=') === 0) { irA(h.slice(2)); return; }
    if (h.indexOf('p=') === 0) {
      var partes = h.slice(2).split(',');
      var x = parseFloat(partes[0]), y = parseFloat(partes[1]);
      if (isNaN(x) || isNaN(y)) return;
      var item = { id: 'compartida', categoria: 'marcas', temporal: true, x: x, y: y,
        nombre: partes.slice(2).join(',') || 'Marca compartida', zona: 'Marca que te compartieron' };
      porId[item.id] = item;
      marcadorDe(item).addTo(capaTemporal);
      irA(item.id);
      return;
    }
    if (h.indexOf('r=') === 0) {
      var items = h.slice(2).split(',').map(function (id) { return porId[id]; }).filter(Boolean);
      if (!items.length) return;
      items.forEach(function (i) { if (!activas[i.categoria]) activar(i.categoria, true); });
      modoRuta(true);
      RUTA.poner(items);
      mapa.fitBounds(L.latLngBounds(items.map(function (i) { return [i.y, i.x]; })).pad(0.3));
    }
  }

  /* ---------- Marcas propias ----------
     Se crean dejando presionado el mapa (o clic derecho en computadora). */
  function recargarMarcas() {
    Object.keys(porId).forEach(function (id) { if (id.indexOf('marca-') === 0) delete porId[id]; });
    Object.keys(marcadores).forEach(function (id) {
      if (id.indexOf('marca-') === 0) { capaVisible.removeLayer(marcadores[id]); delete marcadores[id]; }
    });
    marcasComoItems().forEach(function (m) { porId[m.id] = m; });
    pintarFiltros();
    pintarLista($('#buscador').value);
    redibujar();
  }

  function nuevaMarca(latlng) {
    if (RUTA.activa) return;
    var nombre = prompt('Nombre de tu marca (por ejemplo «Mi casa» o «Aquí hay botín»):', 'Mi marca');
    if (nombre === null) return;
    var m = G.agregarMarca(nombre.trim() || 'Mi marca', latlng.lng, latlng.lat);
    recargarMarcas();
    activar('marcas', true);
    abrirFicha(porId[m.id]);
  }
  mapa.on('contextmenu', function (e) { nuevaMarca(e.latlng); });

  // Pulsación larga en el teléfono (iPhone no manda "contextmenu" por sí solo)
  (function () {
    var t = null, inicio = null;
    var cont = mapa.getContainer();
    cont.addEventListener('touchstart', function (e) {
      clearTimeout(t);
      if (e.touches.length !== 1 || e.target.closest('.leaflet-marker-icon')) return;
      var toque = e.touches[0];
      inicio = { x: toque.clientX, y: toque.clientY };
      t = setTimeout(function () {
        var r = cont.getBoundingClientRect();
        if (document.body.classList.contains('vista-3d')) return;   // en 3D la posición no sería exacta
        nuevaMarca(mapa.containerPointToLatLng([inicio.x - r.left, inicio.y - r.top]));
      }, 650);
    }, { passive: true });
    cont.addEventListener('touchmove', function (e) {
      if (!inicio) return;
      var toque = e.touches[0];
      if (e.touches.length > 1 || Math.hypot(toque.clientX - inicio.x, toque.clientY - inicio.y) > 10) clearTimeout(t);
    }, { passive: true });
    cont.addEventListener('touchend', function () { clearTimeout(t); }, { passive: true });
  })();

  /* ---------- Ruta de golpes ---------- */
  function modoRuta(on) {
    RUTA.activa = on;
    document.body.classList.toggle('modo-ruta', on);
    $('#btn-ruta').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { cerrar('ficha'); if (!RUTA.paradas().length) aviso('Toca los lugares que quieres robar'); }
    pintarBarraRuta();
  }
  function pintarBarraRuta() {
    var ps = RUTA.paradas(), m = RUTA.metros();
    var km = (m / 1000).toFixed(1), mi = (m / 1609.34).toFixed(1);
    $('#ruta-texto').innerHTML = ps.length
      ? '<b>' + ps.length + ' parada' + (ps.length > 1 ? 's' : '') + '</b> · ' + km + ' km (' + mi + ' mi) en línea recta'
      : 'Toca los iconos para armar la ruta. El orden se calcula solo.';
    $('#ruta-lista').innerHTML = ps.map(function (p, n) {
      return '<span>' + (n + 1) + '. ' + esc(p.nombre) + '</span>';
    }).join('');
  }
  $('#btn-ruta').onclick = function () { modoRuta(!RUTA.activa); };
  $('#ruta-salir').onclick = function () { modoRuta(false); };
  $('#ruta-limpiar').onclick = function () { RUTA.limpiar(); };
  $('#ruta-compartir').onclick = function () {
    var ps = RUTA.paradas();
    if (!ps.length) { aviso('La ruta está vacía'); return; }
    enviarEnlace('Ruta de golpes · Mapa VI', baseUrl() + '#r=' + ps.map(function (p) { return encodeURIComponent(p.id); }).join(','));
  };

  /* ---------- Lista y buscador ---------- */
  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filaLugar(i) {
    var c = CAT[i.categoria];
    var hecho = G.esEncontrado(i.id);
    var detalle = i.categoria === 'marcas' ? 'Marca propia'
      : esc(i.zona || '') + (i.verificado === 'sí' ? ' · ✔ verificado' : ' · sin verificar');
    return '<button class="fila' + (hecho ? ' hecha' : '') + '" data-ir="' + esc(i.id) + '">' + blip(c) +
      '<span class="txt"><b>' + (G.esFavorito(i.id) ? '★ ' : '') + esc(i.nombre) + '</b><small>' + detalle +
      '</small></span><span class="flecha">' + (hecho ? '✔' : '›') + '</span></button>';
  }

  function pintarLista(filtro) {
    var q = normalizar(filtro);
    var coincide = function (i) {
      return !q || normalizar(i.nombre + ' ' + (i.zona || '') + ' ' + (i.descripcion || '')).indexOf(q) !== -1;
    };
    var html = '<div class="herramientas">' +
      '<button class="fila-op' + (G.ocultarEncontrados() ? ' on' : '') + '" data-op="ocultar"><span class="casilla">' +
      (G.ocultarEncontrados() ? '✔' : '') + '</span>Ocultar encontrados en el mapa</button></div>';
    var total = 0;

    // Favoritos primero
    var favs = G.favoritos().map(function (id) { return porId[id]; }).filter(function (i) { return i && coincide(i); });
    if (favs.length) {
      total += favs.length;
      html += '<div class="grupo"><h4>★ Favoritos <span class="num">' + favs.length + '</span></h4>' + favs.map(filaLugar).join('') + '</div>';
    }

    CATEGORIAS.forEach(function (c) {
      var con = itemsDe(c.id).filter(coincide);
      var sin = (c.id === 'marcas' ? [] : datos.pendientes).filter(function (i) { return i.categoria === c.id && coincide(i); });
      if (c.id === 'marcas' && !con.length) {
        if (!q) html += '<div class="grupo"><h4>' + esc(datos.categorias.marcas) + '</h4>' +
          '<p class="aviso">Deja presionado el mapa para poner tu propia marca (se guarda solo en este teléfono).</p></div>';
        return;
      }
      if (!con.length && !sin.length) return;
      total += con.length + sin.length;
      var cuenta = c.id === 'marcas' ? con.length
        : G.cuantosEncontrados(con.map(function (i) { return i.id; })) + '/' + con.length + (sin.length ? ' + ' + sin.length + ' pend.' : '');
      html += '<div class="grupo"><h4>' + esc(datos.categorias[c.id]) + ' <span class="num">' + cuenta + '</span></h4>';
      html += con.map(filaLugar).join('');
      sin.forEach(function (i) {
        html += '<div class="fila sin-punto"><span class="blip" style="--c:#8a87c4">❔</span><span class="txt">' +
          '<b><span class="pendiente-tag">PENDIENTE</span>' + esc(i.nombre) + '</b>' +
          '<small>' + esc(i.descripcion) + '<br><i>Motivo: ' + esc(i.motivo) + '</i> · ' +
          '<a href="' + esc(i.fuente) + '" target="_blank" rel="noopener">' + esc(dominio(i.fuente)) + '</a></small></span></div>';
      });
      html += '</div>';
    });
    if (!total) html += '<p class="aviso">Nada coincide con «' + esc(filtro) + '».</p>';
    html += '<p class="aviso">' + esc(datos.meta.aviso_fuentes) + '<br><br>Los marcados [PENDIENTE] no tienen ubicación exacta confirmada y no aparecen en el mapa.</p>' +
      '<button class="fila-op peligro" data-op="reiniciar">Reiniciar progreso (encontrados)</button>';
    $('#lista').innerHTML = html;
  }

  $('#lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (b) { irA(b.getAttribute('data-ir')); return; }
    var op = e.target.closest('[data-op]');
    if (!op) return;
    if (op.getAttribute('data-op') === 'ocultar') {
      G.alternarOcultar();
      pintarLista($('#buscador').value);
      redibujar();
    } else if (op.getAttribute('data-op') === 'reiniciar') {
      if (confirm('¿Borrar todo lo marcado como encontrado? Tus favoritos y marcas se quedan.')) {
        G.reiniciarProgreso();
        Object.keys(marcadores).forEach(function (id) { if (porId[id]) marcadores[id].setIcon(crearIcono(porId[id])); });
        actualizarConteos();
        pintarLista($('#buscador').value);
        redibujar();
      }
    }
  });
  $('#buscador').addEventListener('input', function () { pintarLista(this.value); });
  $('#btn-lista').onclick = function () { cerrar('ficha'); modoRuta(false); abrir('panel-lista'); };

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
    fetch('data/trucos.json').then(function (r) { return r.json(); }),
    fetch('data/zonas.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    datos = res[0];
    datos.categorias.marcas = 'Mis marcas';
    // Todas las categorías empiezan apagadas: el mapa arranca limpio y se encienden con los filtros
    CATEGORIAS.forEach(function (c) { activas[c.id] = false; });
    datos.items.forEach(function (i) { porId[i.id] = i; });
    marcasComoItems().forEach(function (m) { porId[m.id] = m; });
    CATEGORIAS.forEach(function (c) { if (c.id !== 'marcas') ordenCat[c.id] = cadena(itemsDe(c.id)); });
    capaVisible = L.layerGroup().addTo(mapa);
    capaTemporal = L.layerGroup().addTo(mapa);
    RUTA.iniciar(mapa, pintarBarraRuta);
    mapa.on('zoomend', redibujar);
    pintarZonas(res[2]);
    pintarFiltros();
    pintarLista('');
    pintarTrucos(res[1]);
    leerEnlace();
  }).catch(function (err) {
    console.error(err);
    alert('No se pudieron cargar los datos. Abre la app desde internet (GitHub Pages) al menos una vez.');
  });

  /* ---------- Modo sin conexión (service worker) ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
