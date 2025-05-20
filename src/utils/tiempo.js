/**
 * Formatea un valor decimal de hora a formato HH:MM (24 horas)
 * @param {number} decimal - Hora en formato decimal (ej: 7.5 para 7:30)
 * @returns {string} Hora formateada (ej: "07:30")
 */
export function formatearHora(decimal) {
  const horas = Math.floor(decimal % 24); // Resetea cada 24 horas
  const minutos = Math.round((decimal % 1) * 60);

  const hh = horas.toString().padStart(2, '0');
  const mm = minutos.toString().padStart(2, '0');

  return `${hh}:${mm}`;
}

/**
 * Formatea un valor decimal de hora a formato de 12 horas (AM/PM)
 * @param {number} decimal - Hora en formato decimal (ej: 15.5 para 3:30 PM)
 * @returns {string} Hora formateada (ej: "03:30 PM")
 */
export function formatearHora12h(decimal) {
  const horas24 = Math.floor(decimal % 24);
  const minutos = Math.round((decimal % 1) * 60);
  
  const periodo = horas24 >= 12 ? 'PM' : 'AM';
  const horas12 = horas24 % 12 || 12; // Convierte 0 a 12 para medianoche
  
  const hh = horas12.toString().padStart(2, '0');
  const mm = minutos.toString().padStart(2, '0');
  
  return `${hh}:${mm} ${periodo}`;
}

/**
 * Formatea un rango de horas (inicio-fin) en formato de 24 horas
 * @param {number} inicio - Hora de inicio en formato decimal
 * @param {number} fin - Hora de fin en formato decimal
 * @returns {string} Rango formateado (ej: "07:30-16:00")
 */
export function formatearRangoHoras(inicio, fin) {
  return `${formatearHora(inicio)}–${formatearHora(fin)}`;
}

/**
 * Convierte una hora en formato HH:MM a valor decimal
 * @param {string} horaStr - Hora en formato "HH:MM"
 * @returns {number} Valor decimal de la hora (ej: "07:30" -> 7.5)
 */
export function horaADecimal(horaStr) {
  if (!horaStr || typeof horaStr !== 'string') return 0;
  
  const [horasStr, minutosStr] = horaStr.split(':');
  const horas = parseInt(horasStr, 10) || 0;
  const minutos = parseInt(minutosStr, 10) || 0;
  
  return horas + (minutos / 60);
}

/**
 * Calcula la diferencia en horas entre dos horas
 * @param {number} inicio - Hora de inicio en formato decimal
 * @param {number} fin - Hora de fin en formato decimal 
 * @param {boolean} cruzaDia - Indica si el rango cruza a otro día
 * @returns {number} Diferencia en horas
 */
export function calcularDuracion(inicio, fin, cruzaDia = false) {
  if (cruzaDia || fin < inicio) {
    return (24 - inicio) + fin;
  }
  return fin - inicio;
}