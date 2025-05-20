import { formatearHora } from '../utils/tiempo';

/**
 * Cuenta los domingos trabajados por cada trabajador
 * 
 * @param {Array} datosTurnos - Datos de turnos generados
 * @param {Array} trabajadores - Lista de trabajadores
 * @returns {Object} Contador de domingos trabajados por trabajador
 */
export function contarDomingos(datosTurnos, trabajadores) {
  const contador = {};
  if (!trabajadores || !Array.isArray(trabajadores)) {
    return contador;
  }
  
  trabajadores.forEach((trabajador) => {
    if (trabajador && trabajador.nombre) {
      contador[trabajador.nombre] = 0;
    }
  });

  if (!datosTurnos || !Array.isArray(datosTurnos)) {
    return contador;
  }

  datosTurnos.forEach((semana) => {
    if (!semana || !semana.dias) return;
    
    const diaDomingo = semana.dias.find(d => d && d.dia === "Domingo");
    if (!diaDomingo) return;

    diaDomingo.asignaciones.forEach((asignacion) => {
      if (!asignacion || !asignacion.trabajadores) return;
      
      asignacion.trabajadores.forEach(t => {
        if (t && t.nombre && contador[t.nombre] !== undefined) {
          contador[t.nombre]++;
        }
      });
    });
  });

  return contador;
}

/**
 * Valida que se cumplan los descansos mínimos entre turnos (12 horas)
 * 
 * @param {Array} datosTurnos - Datos de turnos generados
 * @param {Array} turnos - Definición de los turnos disponibles
 * @param {Array} trabajadores - Lista de trabajadores
 * @returns {Array} Lista de violaciones de descanso
 */
export function validarDescansos(datosTurnos, turnos, trabajadores) {
  const descansosIncorrectos = [];
  
  // Validaciones de seguridad
  if (!datosTurnos || !Array.isArray(datosTurnos) || 
      !turnos || !Array.isArray(turnos) ||
      !trabajadores || !Array.isArray(trabajadores)) {
    return descansosIncorrectos;
  }

  // Función para evitar duplicados en registros
  const yaRegistrado = (registro) => {
    return descansosIncorrectos.some((d) =>
      d.trabajador === registro.trabajador &&
      d.fechaActual === registro.fechaActual &&
      d.turnoActual === registro.turnoActual &&
      d.fechaSiguiente === registro.fechaSiguiente &&
      d.turnoSiguiente === registro.turnoSiguiente
    );
  };

  trabajadores.forEach((trabajador) => {
    if (!trabajador || !trabajador.nombre) return;
    
    for (let s = 0; s < datosTurnos.length; s++) {
      const semana = datosTurnos[s];
      if (!semana || !semana.dias) continue;

      for (let d = 0; d < semana.dias.length; d++) {
        const diaHoy = semana.dias[d];
        if (!diaHoy || !diaHoy.fecha || !diaHoy.asignaciones) continue;
        
        const fechaHoy = new Date(diaHoy.fecha);

        // Filtrar asignaciones válidas
        const asignacionesHoy = diaHoy.asignaciones.filter(
          (a) => a && a.trabajadores && 
          a.trabajadores.some(t => t && t.nombre === trabajador.nombre) &&
          a.turno &&
          !a.turno.toLowerCase().includes("no cobertura")
        );

        // 1. Validar descansos entre turnos del MISMO día
        for (let i = 0; i < asignacionesHoy.length; i++) {
          const turnoA = turnos.find(t => t && t.nombre === asignacionesHoy[i].turno);
          if (!turnoA) continue;
          
          const finA = turnoA.fin >= turnoA.inicio ? turnoA.fin : turnoA.fin + 24;

          for (let j = i + 1; j < asignacionesHoy.length; j++) {
            const turnoB = turnos.find(t => t && t.nombre === asignacionesHoy[j].turno);
            if (!turnoB) continue;
            
            const inicioB = turnoB.inicio;
            const descanso = Math.abs(inicioB - finA);

            const registro = {
              trabajador: trabajador.nombre,
              diaActual: diaHoy.dia,
              fechaActual: diaHoy.fecha,
              turnoActual: asignacionesHoy[i].turno,
              horarioActual: `${formatearHora(turnoA.inicio)}–${formatearHora(turnoA.fin)}`,
              diaSiguiente: diaHoy.dia,
              fechaSiguiente: diaHoy.fecha,
              turnoSiguiente: asignacionesHoy[j].turno,
              horarioSiguiente: `${formatearHora(turnoB.inicio)}–${formatearHora(turnoB.fin)}`,
              descanso
            };

            if (descanso < 12 && !yaRegistrado(registro)) {
              descansosIncorrectos.push(registro);
            }
          }
        }

        // 2. Validar descansos entre días consecutivos
        if (d + 1 < semana.dias.length) {
          const diaManiana = semana.dias[d + 1];
          if (!diaManiana || !diaManiana.fecha || !diaManiana.asignaciones) continue;
          
          const fechaManiana = new Date(diaManiana.fecha);

          const asignacionesManiana = diaManiana.asignaciones.filter(
            (a) => a && a.trabajadores &&
            a.trabajadores.some(t => t && t.nombre === trabajador.nombre) &&
            a.turno &&
            !a.turno.toLowerCase().includes("no cobertura")
          );

          for (const asignacionHoy of asignacionesHoy) {
            const turnoHoy = turnos.find((t) => t && t.nombre === asignacionHoy.turno);
            if (!turnoHoy) continue;
            
            const finHoyHora = turnoHoy.fin >= turnoHoy.inicio ? turnoHoy.fin : turnoHoy.fin + 24;

            const fechaFinHoy = new Date(fechaHoy);
            fechaFinHoy.setHours(0, 0, 0, 0);
            fechaFinHoy.setHours(Math.floor(finHoyHora), (finHoyHora % 1) * 60);

            for (const asignacionManiana of asignacionesManiana) {
              const turnoManiana = turnos.find((t) => t && t.nombre === asignacionManiana.turno);
              if (!turnoManiana) continue;
              
              const inicioManianaHora = turnoManiana.inicio;

              const fechaInicioManiana = new Date(fechaManiana);
              fechaInicioManiana.setHours(0, 0, 0, 0);
              fechaInicioManiana.setHours(Math.floor(inicioManianaHora), (inicioManianaHora % 1) * 60);

              const descanso = (fechaInicioManiana - fechaFinHoy) / (1000 * 60 * 60);

              const registro = {
                trabajador: trabajador.nombre,
                diaActual: diaHoy.dia,
                fechaActual: diaHoy.fecha,
                turnoActual: asignacionHoy.turno,
                horarioActual: `${formatearHora(turnoHoy.inicio)}–${formatearHora(turnoHoy.fin)}`,
                diaSiguiente: diaManiana.dia,
                fechaSiguiente: diaManiana.fecha,
                turnoSiguiente: asignacionManiana.turno,
                horarioSiguiente: `${formatearHora(turnoManiana.inicio)}–${formatearHora(turnoManiana.fin)}`,
                descanso
              };

              if (descanso < 12 && !yaRegistrado(registro)) {
                descansosIncorrectos.push(registro);
              }
            }
          }
        }
      }
    }
  });

  return descansosIncorrectos;
}

/**
 * Valida que no se trabajen más de 6 días seguidos
 * 
 * @param {Array} datosTurnos - Datos de turnos generados
 * @param {Array} trabajadores - Lista de trabajadores
 * @returns {Array} Lista de violaciones de días seguidos trabajados
 */
export function validarDiasSeguidos(datosTurnos, trabajadores) {
  const violaciones = [];
  
  // Validaciones de seguridad
  if (!datosTurnos || !Array.isArray(datosTurnos) || 
      !trabajadores || !Array.isArray(trabajadores)) {
    return violaciones;
  }

  trabajadores.forEach((trabajador) => {
    if (!trabajador || !trabajador.nombre) return;
    
    const diasTrabajados = [];

    datosTurnos.forEach((semana) => {
      if (!semana || !semana.dias) return;
      
      semana.dias.forEach((dia) => {
        if (!dia || !dia.fecha || !dia.asignaciones) return;
        
        const asignado = dia.asignaciones.some(
          (a) => a && a.trabajadores && 
          a.trabajadores.some(t => t && t.nombre === trabajador.nombre)
        );
        
        if (asignado) {
          diasTrabajados.push(dia.fecha);
        }
      });
    });

    const fechasOrdenadas = diasTrabajados.map(f => new Date(f)).sort((a, b) => a - b);

    let contador = 1;
    for (let i = 1; i < fechasOrdenadas.length; i++) {
      const diff = (fechasOrdenadas[i] - fechasOrdenadas[i - 1]) / (1000 * 60 * 60 * 24);
      
      if (diff === 1) {
        contador++;
        if (contador >= 7) {
          violaciones.push({
            trabajador: trabajador.nombre,
            desde: fechasOrdenadas[i - 6].toISOString().split('T')[0],
            hasta: fechasOrdenadas[i].toISOString().split('T')[0],
            diasSeguidos: contador
          });
          break;
        }
      } else {
        contador = 1;
      }
    }
  });

  return violaciones;
}