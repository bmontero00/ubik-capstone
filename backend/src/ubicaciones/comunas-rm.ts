// Las 52 comunas de la Región Metropolitana con un punto de referencia (centro aproximado).
// Dan sugerencias instantáneas y gratuitas en el buscador "¿Dónde?" del mapa, sin depender de un servicio externo.
export const COMUNAS_RM: { nombre: string; provincia: string; lat: number; lng: number }[] = [
  // Provincia de Santiago
  { nombre: 'Santiago', provincia: 'Santiago', lat: -33.4489, lng: -70.6693 },
  { nombre: 'Cerrillos', provincia: 'Santiago', lat: -33.495, lng: -70.716 },
  { nombre: 'Cerro Navia', provincia: 'Santiago', lat: -33.426, lng: -70.735 },
  { nombre: 'Conchalí', provincia: 'Santiago', lat: -33.383, lng: -70.675 },
  { nombre: 'El Bosque', provincia: 'Santiago', lat: -33.562, lng: -70.676 },
  { nombre: 'Estación Central', provincia: 'Santiago', lat: -33.46, lng: -70.7 },
  { nombre: 'Huechuraba', provincia: 'Santiago', lat: -33.367, lng: -70.633 },
  { nombre: 'Independencia', provincia: 'Santiago', lat: -33.417, lng: -70.665 },
  { nombre: 'La Cisterna', provincia: 'Santiago', lat: -33.53, lng: -70.664 },
  { nombre: 'La Florida', provincia: 'Santiago', lat: -33.522, lng: -70.598 },
  { nombre: 'La Granja', provincia: 'Santiago', lat: -33.54, lng: -70.625 },
  { nombre: 'La Pintana', provincia: 'Santiago', lat: -33.583, lng: -70.633 },
  { nombre: 'La Reina', provincia: 'Santiago', lat: -33.445, lng: -70.535 },
  { nombre: 'Las Condes', provincia: 'Santiago', lat: -33.415, lng: -70.583 },
  { nombre: 'Lo Barnechea', provincia: 'Santiago', lat: -33.35, lng: -70.517 },
  { nombre: 'Lo Espejo', provincia: 'Santiago', lat: -33.525, lng: -70.692 },
  { nombre: 'Lo Prado', provincia: 'Santiago', lat: -33.444, lng: -70.725 },
  { nombre: 'Macul', provincia: 'Santiago', lat: -33.492, lng: -70.599 },
  { nombre: 'Maipú', provincia: 'Santiago', lat: -33.51, lng: -70.757 },
  { nombre: 'Ñuñoa', provincia: 'Santiago', lat: -33.457, lng: -70.597 },
  { nombre: 'Pedro Aguirre Cerda', provincia: 'Santiago', lat: -33.492, lng: -70.678 },
  { nombre: 'Peñalolén', provincia: 'Santiago', lat: -33.485, lng: -70.542 },
  { nombre: 'Providencia', provincia: 'Santiago', lat: -33.432, lng: -70.609 },
  { nombre: 'Pudahuel', provincia: 'Santiago', lat: -33.44, lng: -70.76 },
  { nombre: 'Quilicura', provincia: 'Santiago', lat: -33.36, lng: -70.73 },
  { nombre: 'Quinta Normal', provincia: 'Santiago', lat: -33.44, lng: -70.697 },
  { nombre: 'Recoleta', provincia: 'Santiago', lat: -33.406, lng: -70.64 },
  { nombre: 'Renca', provincia: 'Santiago', lat: -33.404, lng: -70.727 },
  { nombre: 'San Joaquín', provincia: 'Santiago', lat: -33.496, lng: -70.628 },
  { nombre: 'San Miguel', provincia: 'Santiago', lat: -33.497, lng: -70.651 },
  { nombre: 'San Ramón', provincia: 'Santiago', lat: -33.536, lng: -70.643 },
  { nombre: 'Vitacura', provincia: 'Santiago', lat: -33.39, lng: -70.57 },
  // Provincia de Cordillera
  { nombre: 'Puente Alto', provincia: 'Cordillera', lat: -33.611, lng: -70.576 },
  { nombre: 'Pirque', provincia: 'Cordillera', lat: -33.673, lng: -70.588 },
  { nombre: 'San José de Maipo', provincia: 'Cordillera', lat: -33.641, lng: -70.353 },
  // Provincia de Chacabuco
  { nombre: 'Colina', provincia: 'Chacabuco', lat: -33.201, lng: -70.67 },
  { nombre: 'Lampa', provincia: 'Chacabuco', lat: -33.286, lng: -70.878 },
  { nombre: 'Tiltil', provincia: 'Chacabuco', lat: -33.083, lng: -70.928 },
  // Provincia de Maipo
  { nombre: 'San Bernardo', provincia: 'Maipo', lat: -33.592, lng: -70.699 },
  { nombre: 'Buin', provincia: 'Maipo', lat: -33.732, lng: -70.742 },
  { nombre: 'Calera de Tango', provincia: 'Maipo', lat: -33.63, lng: -70.77 },
  { nombre: 'Paine', provincia: 'Maipo', lat: -33.807, lng: -70.74 },
  // Provincia de Melipilla
  { nombre: 'Melipilla', provincia: 'Melipilla', lat: -33.689, lng: -71.214 },
  { nombre: 'Alhué', provincia: 'Melipilla', lat: -34.033, lng: -71.096 },
  { nombre: 'Curacaví', provincia: 'Melipilla', lat: -33.406, lng: -71.133 },
  { nombre: 'María Pinto', provincia: 'Melipilla', lat: -33.515, lng: -71.118 },
  { nombre: 'San Pedro', provincia: 'Melipilla', lat: -33.895, lng: -71.46 },
  // Provincia de Talagante
  { nombre: 'Talagante', provincia: 'Talagante', lat: -33.665, lng: -70.928 },
  { nombre: 'El Monte', provincia: 'Talagante', lat: -33.679, lng: -71.017 },
  { nombre: 'Isla de Maipo', provincia: 'Talagante', lat: -33.75, lng: -70.899 },
  { nombre: 'Padre Hurtado', provincia: 'Talagante', lat: -33.576, lng: -70.8 },
  { nombre: 'Peñaflor', provincia: 'Talagante', lat: -33.606, lng: -70.876 },
];

// Sin tildes ni mayúsculas, para comparar ("nunoa" encuentra "Ñuñoa")
export const normalizarTexto = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
