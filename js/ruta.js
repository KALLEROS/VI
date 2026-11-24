/* =========================================================
   Mapa VI · ruta de golpes
   Eliges varios lugares y se calcula el orden más corto para pasar por todos
   (empezando por el primero que tocaste). La distancia es en línea recta:
   no hay datos de calles para calcularla por carretera.
   ========================================================= */
(function () {
  'use strict';

  var mapa = null;
  var paradas = [];      // lugares elegidos, en el orden en que se tocaron
  var orden = [];        // los mismos lugares en el orden de la ruta
  var capa = null;       // línea y números
  var alCambiar = function () {};

  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };

  /* Orden: vecino más cercano desde el primero y luego mejora 2-opt
     (voltea tramos mientras la ruta se acorte). Con pocas paradas es instantáneo. */
  function ordenar(lista) {
    if (lista.length < 3) return lista.slice();
    var resto = lista.slice(1), ruta = [lista[0]];
    while (resto.length) {
      var ult = ruta[ruta.length - 1], mejor = 0;
      for (var i = 1; i < resto.length; i++) if (dist(ult, resto[i]) < dist(ult, resto[mejor])) mejor = i;
      ruta.push(resto.splice(mejor, 1)[0]);
    }
    var mejoro = true;
    while (mejoro) {
      mejoro = false;
      for (var a = 1; a < ruta.length - 1; a++) {
        for (var b = a + 1; b < ruta.length; b++) {
          var antes = dist(ruta[a - 1], ruta[a]) + (b + 1 < ruta.length ? dist(ruta[b], ruta[b + 1]) : 0);
          var despues = dist(ruta[a - 1], ruta[b]) + (b + 1 < ruta.length ? dist(ruta[a], ruta[b + 1]) : 0);
          if (despues + 0.01 < antes) {
            ruta = ruta.slice(0, a).concat(ruta.slice(a, b + 1).reverse(), ruta.slice(b + 1));
            mejoro = true;
          }
        }
      }
    }
    return ruta;
  }

  function total() {
    var t = 0;
    for (var i = 1; i < orden.length; i++) t += dist(orden[i - 1], orden[i]);
    return t;
  }

  function dibujar() {
    capa.clearLayers();
    orden = ordenar(paradas);
    if (orden.length > 1) {
      L.polyline(orden.map(function (p) { return [p.y, p.x]; }), {
        color: '#ff2d95', weight: 4, opacity: .9, dashArray: '8 8', interactive: false
      }).addTo(capa);
    }
    orden.forEach(function (p, n) {
      L.marker([p.y, p.x], {
        pane: 'ruta', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'num-ruta', html: '<span>' + (n + 1) + '</span>', iconSize: [20, 20], iconAnchor: [-4, 22] })
      }).addTo(capa);
    });
    alCambiar();
  }

  window.MapaVI = window.MapaVI || {};
  window.MapaVI.ruta = {
    activa: false,
    iniciar: function (m, cambio) {
      mapa = m;
      alCambiar = cambio || alCambiar;
      mapa.createPane('ruta');
      mapa.getPane('ruta').style.zIndex = 650;
      mapa.getPane('ruta').style.pointerEvents = 'none';
      capa = L.layerGroup().addTo(mapa);
    },
    // Agrega o quita un lugar de la ruta
    alternar: function (item) {
      var i = paradas.indexOf(item);
      if (i === -1) paradas.push(item); else paradas.splice(i, 1);
      dibujar();
    },
    tiene: function (item) { return paradas.indexOf(item) !== -1; },
    poner: function (items) { paradas = items.slice(); dibujar(); },
    limpiar: function () { paradas = []; dibujar(); },
    paradas: function () { return orden.slice(); },
    metros: total
  };
})();
