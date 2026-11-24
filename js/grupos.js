/* =========================================================
   Mapa VI · agrupar iconos
   De lejos, los iconos de una misma categoría que quedan muy juntos
   se dibujan como uno solo con el número de lugares. Al acercarse se separan.
   ========================================================= */
(function () {
  'use strict';

  var ZOOM_SIN_GRUPOS = 3.5;   // desde este zoom ya no se agrupa
  var RADIO_PX = 40;           // distancia en pantalla para juntar dos iconos

  /* items: lista de { item } de UNA categoría.
     Devuelve grupos: [{ items: [...], lat, lng }]. Un grupo de 1 = icono normal. */
  function agrupar(mapa, items) {
    var z = mapa.getZoom();
    if (z >= ZOOM_SIN_GRUPOS) return items.map(function (i) { return { items: [i], lat: i.y, lng: i.x }; });

    var grupos = [];
    items.forEach(function (i) {
      var p = mapa.project([i.y, i.x], z);
      var g = null;
      for (var k = 0; k < grupos.length; k++) {
        if (grupos[k].p.distanceTo(p) < RADIO_PX) { g = grupos[k]; break; }
      }
      if (!g) { g = { items: [], p: p, sx: 0, sy: 0 }; grupos.push(g); }
      g.items.push(i);
      g.sx += i.x; g.sy += i.y;
      // el centro del grupo se mueve al promedio de sus lugares
      g.p = mapa.project([g.sy / g.items.length, g.sx / g.items.length], z);
    });
    return grupos.map(function (g) {
      return { items: g.items, lat: g.sy / g.items.length, lng: g.sx / g.items.length };
    });
  }

  window.MapaVI = window.MapaVI || {};
  window.MapaVI.grupos = { agrupar: agrupar, ZOOM_SIN_GRUPOS: ZOOM_SIN_GRUPOS };
})();
