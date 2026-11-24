# Mapa VI · Leonida

Mapa interactivo de Leonida (GTA VI) para el celular: dónde robar, qué saquear, qué autos raros o de regalo hay y dónde están los strip clubs. Cada punto trae su fuente. Lo que no tiene fuente o ubicación exacta queda marcado **[PENDIENTE]** y no se dibuja en el mapa.

No es una tienda ni un catálogo: no incluye ropa ni cosas que solo se compran.

## Cómo se usa

- **Mapa:** pellizca o usa **+ / −** para el zoom, arrastra para moverte. **⤢** vuelve a la vista completa. Lo más lejos que se puede alejar es con el mapa a lo alto de la pantalla; lo más cerca, el último nivel que todavía se ve nítido.
- **Nombres:** de lejos se ven Leonida y los condados; al acercarte, ciudades, zonas y barrios.
- **3D:** inclina el mapa como en el juego.
- **Filtros:** el mapa arranca limpio. Toca una categoría arriba para encenderla y otra vez para apagarla.
- **Cajeros:** en el juego se usan con la app BuckMe del teléfono (ATM Finder marca el más cercano). En el mapa solo están los que las guías ubican con nombre; el resto queda en la lista como [PENDIENTE].
- **Lista:** todos los lugares por categoría, con buscador. Toca uno y el mapa te lleva ahí.
- **Trucos:** códigos, controles y consejos, cada uno con su fuente.

## Instalar en el iPhone

1. Abre la página en **Safari**.
2. Toca **Compartir** → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono: se ve a pantalla completa, sin la barra del navegador.
4. Ábrela una vez con internet. Después funciona sin conexión (el mapa de lejos se guarda completo; los acercamientos se guardan a medida que los ves).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `css/estilos.css` | Diseño |
| `js/app.js` | Mapa, filtros, ficha, lista, trucos y vista 3D |
| `data/locations.json` | Ubicaciones y pendientes (con fuente y verificado sí/no) |
| `data/trucos.json` | Trucos e información técnica |
| `data/zonas.json` | Nombres de condados, ciudades, zonas y barrios con su posición |
| `tiles/` | Mapa base en teselas (zoom 0 a 6) y `indice.json` con las que existen (las de puro mar no se guardan) |
| `sw.js` | Modo sin conexión |
| `manifest.webmanifest`, `icons/` | Para instalarla como app |
| `vendor/leaflet/` | Librería de mapas Leaflet 1.9.4 (licencia BSD-2) |

## Datos

- Coordenadas `x` / `y` en metros del juego, con el mismo sistema que [gtadb.org](https://gtadb.org) (x crece al este, y al norte).
- **verificado = sí**: al menos dos guías independientes coinciden y gtadb.org tiene el lugar con nombre.
- **verificado = no**: una sola fuente, fuentes que no coinciden, o una sucursal de una marca que las guías dan como robable sin nombrar esa sucursal.
- No se encontraron hilos de Reddit ni publicaciones oficiales de Rockstar con estas ubicaciones; las fuentes son guías publicadas entre el 18 y el 23 de noviembre de 2026.

## Créditos

- **Mapa base:** capa «day» de [gtadb.org](https://gtadb.org) ([repositorio](https://github.com/rolux/gtadb.org)), recoloreada con la paleta del mapa del juego. Dominio público según su [FAQ](https://faq.gtadb.org). No es un archivo de Rockstar.
- **Nombres de zonas:** geocodificación inversa de [api.gtadb.org](https://api.gtadb.org) sobre una cuadrícula de 400 m.
- **Librería:** [Leaflet](https://leafletjs.com).
- GTA VI, Leonida y los nombres del juego son de Rockstar Games. Este proyecto no está afiliado a Rockstar.
