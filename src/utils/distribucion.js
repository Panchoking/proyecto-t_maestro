/**
 * Calcula la distribución óptima de turnos basado en las horas disponibles y días de funcionamiento
 * 
 * @param {number} H - Horas disponibles del trabajador por semana
 * @param {number} D - Días de funcionamiento por semana (máx 7)
 * @param {number} t - Bloque mínimo de tiempo (en horas)
 * @param {number} horarioAbierto - Hora de apertura en formato decimal (ej: 7 para 07:00)
 * @param {number} horasColacion - Horas de colación por turno (ej: 1 para una hora)
 * @returns {Object} Distribución calculada con jornadas, entradas, salidas, etc.
 */
export function calcularDistribucionTurnos(H, D, t, horarioAbierto, horasColacion = 1) {
  // Limitar días a 6 como máximo para cumplir con normativa laboral
  if (D > 6) D = 6;

  // Cálculo del promedio de horas por día
  const p = H / D;
  
  // Redondear al múltiplo más cercano de t
  const m = Math.round(p / t) * t;

  // Validar que m sea múltiplo exacto de t
  if (m % t !== 0) {
    throw new Error("❌ m no es múltiplo exacto de t");
  }

  // Calcular días "chicos" (con jornada menor a m)
  const Dch = Math.abs(H - (m * D)) / t;

  // Validar que días chicos no sea fraccionario
  if (!Number.isInteger(Dch)) {
    throw new Error("❌ Días chicos no puede ser fraccionario");
  }

  // Días "largos" (con jornada igual a m)
  const Dl = D - Dch;
  
  // Total horas en días largos
  const TL = m * Dl;
  
  // Horas por día en días chicos
  const Tch = Dch > 0 ? (H - TL) / Dch : 0;

  // Validar que el total calculado coincida con H
  const totalCalculado = Dl * m + Dch * Tch;
  if (Math.abs(H - totalCalculado) > 0.01) {
    throw new Error(`❌ H ≠ Dl×m + Dch×Tch (${H} vs ${totalCalculado.toFixed(2)})`);
  }

  // Generar listas de jornadas, entradas, salidas y clasificaciones
  const jornadas = [];
  const entradas = [];
  const salidas = [];
  const clasificacion = [];

  for (let i = 0; i < D; i++) {
    let tipo = "libre";
    let Ji = 0;

    if (i < Dl) {
      tipo = "largo";
      Ji = m;
    } else if (i < Dl + Dch) {
      tipo = "chico";
      Ji = Tch;
    }

    const entrada = horarioAbierto;
    const salida = parseFloat((entrada + Ji + horasColacion).toFixed(2));

    jornadas.push(Ji);
    entradas.push(entrada);
    salidas.push(salida);
    clasificacion.push(tipo);
  }

  return {
    H,
    D,
    t,
    p: parseFloat(p.toFixed(2)),
    m: parseFloat(m.toFixed(2)),
    Dch,
    Dl,
    Tch: parseFloat(Tch.toFixed(2)),
    J_l: parseFloat(m.toFixed(2)),
    J_ch: parseFloat(Tch.toFixed(2)),
    jornadas,
    entradas,
    salidas,
    clasificacion
  };
}