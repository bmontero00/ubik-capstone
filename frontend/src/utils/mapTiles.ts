// Mapa base de OpenStreetMap con un filtro CSS que lo oscurece (clase "ubik-dark-tiles" en
// globals.css), acorde al diseño de UBIK y sin claves de API. Nota: los mapas públicos de OSM
// no admiten uso intensivo en producción; para lanzar se debe usar un proveedor con cuota.
export const DARK_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  className: 'ubik-dark-tiles',
  maxZoom: 19,
};

// Color de cada categoría en el mapa (las que no estén usan el color por defecto)
const CATEGORY_COLORS: Record<string, string> = {
  cultural: '#60a5fa',
  deporte: '#34d399',
  diversión: '#f472b6',
  gastronomía: '#fb923c',
  música: '#a78bfa',
  talleres: '#facc15',
  vehículos: '#f59e0b',
  videojuegos: '#c084fc',
};

export const categoryColor = (name?: string) => CATEGORY_COLORS[name?.toLowerCase() ?? ''] ?? '#818cf8';
