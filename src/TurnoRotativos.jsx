import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './TurnoRotativos.css';

const TurnoRotativos = () => {
  const [datosTurnos, setDatosTurnos] = useState([]);
  const [horasEfectivasPorTurno] = useState(8);
  const [trabajadores, setTrabajadores] = useState([]);
  const [nuevoTrabajador, setNuevoTrabajador] = useState('');
  const [tipoContrato, setTipoContrato] = useState('Completo');
  const [horasContrato, setHorasContrato] = useState(45); // valor por defecto
  const [t, setT] = useState(0.5);
  const [semanas] = useState(4);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // Lunes anterior
    return hoy;
  });

  // nuevas variables
  const [horarioAbierto, setHorarioAbierto] = useState(0);  // por ejemplo 7 (07:00)
  const [horarioCierre, setHorarioCierre] = useState(24);   // por ejemplo 23 (23:00) o 31 si es 24/7
  const [horarioAbiertoInput, setHorarioAbiertoInput] = useState(horarioAbierto);
  const [horarioCierreInput, setHorarioCierreInput] = useState(horarioCierre);


  const [horasColacion, setHorasColacion] = useState(1);

  // variables para inicio de semana dinamico
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const [inicioSemana, setInicioSemana] = useState('Lunes'); // Puedes conectar esto a un <select>
  const [diasFuncionamiento, setDiasFuncionamiento] = useState(7); // Por defecto 7 (toda la semana)

  const dias = useMemo(() => {
    const index = diasSemana.findIndex(d => d.toLowerCase() === inicioSemana.toLowerCase());
    if (index === -1) {
      console.warn("Inicio de semana inválido:", inicioSemana);
      return diasSemana.slice(0, diasFuncionamiento); // fallback
    }
    const diasRotados = [...diasSemana.slice(index), ...diasSemana.slice(0, index)];
    return diasRotados.slice(0, diasFuncionamiento);
  }, [inicioSemana, diasFuncionamiento]);


  function formatearHora(decimal) {
    const horas = Math.floor(decimal % 24); // 💡 resetea cada 24 horas
    const minutos = Math.round((decimal % 1) * 60);

    const hh = horas.toString().padStart(2, '0');
    const mm = minutos.toString().padStart(2, '0');

    return `${hh}:${mm}`;
  }


  function generarTurnosDinamicos(inicio, fin, duracionTurno, solape = 0, es247 = false) {
    const turnos = [];
    let actual = inicio;
    let index = 1;

    const limite = fin;

    while (true) {
      const inicioTurno = actual;
      const finTurno = actual + duracionTurno;

      // Validación de fin normal
      if (!es247 && inicioTurno >= limite) break;

      // Turno ajustado si sobrepasa el rango
      if (!es247 && finTurno > limite) {
        const nuevoInicio = limite - duracionTurno;
        if (nuevoInicio >= inicio) {
          turnos.push({
            nombre: `Turno ${index}`,
            inicio: nuevoInicio,
            fin: limite,
            inicioVisual: formatearHora(nuevoInicio),
            finVisual: formatearHora(limite),
            cruzaDia: limite >= 24
          });
        }
        break;
      }

      // Crear turno normal
      turnos.push({
        nombre: `Turno ${index}`,
        inicio: inicioTurno,
        fin: finTurno,
        inicioVisual: formatearHora(inicioTurno),
        finVisual: formatearHora(finTurno),
        cruzaDia: finTurno >= 24
      });

      // 🔁 Avanzar correctamente al siguiente inicio
      actual = finTurno - solape;
      index++;

      // Condición para 24/7
      if (es247 && actual >= inicio + 24) break;
    }
    console.log(turnos.map(t => `${t.nombre}: ${t.inicioVisual} – ${t.finVisual}`));

    return turnos;
  }



  function calcularDistribucionTurnos(H, D, t, horarioAbierto) {
    if (D > 6) D = 6;

    const p = H / D;
    const m = Math.round(p / t) * t;

    if (m % t !== 0) {
      throw new Error("❌ m no es múltiplo exacto de t");
    }

    const Dch = Math.abs(H - (m * D)) / t;

    if (!Number.isInteger(Dch)) {
      throw new Error("❌ Días chicos no puede ser fraccionario");
    }

    const Dl = D - Dch;
    const TL = m * Dl;
    const Tch = (H - TL) / Dch;

    const totalCalculado = Dl * m + Dch * Tch;
    if (Math.abs(H - totalCalculado) > 0.01) {
      throw new Error(`❌ H ≠ Dl×m + Dch×Tch (${H} vs ${totalCalculado.toFixed(2)})`);
    }

    // Generar listas
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
  const turnos = useMemo(() => {
    if (trabajadores.length === 0) return [];

    const es247 = ((horarioCierre - horarioAbierto + 24) % 24) === 0;
    const finReal = es247
      ? horarioAbierto + 24
      : (horarioCierre > horarioAbierto ? horarioCierre : horarioCierre + 24);

    const rangoDisponible = finReal - horarioAbierto;

    const duracionTurno = horasEfectivasPorTurno + horasColacion;

    const nTurnos = Math.ceil(rangoDisponible / duracionTurno);
    const duracionReal = rangoDisponible / nTurnos;

    const turnosGenerados = [];
    let actual = horarioAbierto;

    for (let i = 0; i < nTurnos; i++) {
      const inicio = actual;
      const fin = Math.min(actual + duracionReal, finReal);
      turnosGenerados.push({
        nombre: `Turno ${i + 1}`,
        inicio,
        fin,
        inicioVisual: formatearHora(inicio),
        finVisual: formatearHora(fin),
      });
      actual = fin;
    }

    return turnosGenerados;
  }, [trabajadores, horarioAbierto, horarioCierre, horasEfectivasPorTurno, horasColacion]);






  const agregarTrabajador = () => {
    if (nuevoTrabajador.trim() !== '' && horasContrato > 0) {
      setTrabajadores([...trabajadores, {
        nombre: nuevoTrabajador.trim(),
        tipoContrato,
        horasDisponibles: horasContrato
      }]);
      setNuevoTrabajador('');
      setHorasContrato(45); // resetea al valor por defecto
    }
  };



  const eliminarTrabajador = (index) => {
    const nuevosTrabajadores = [...trabajadores];
    nuevosTrabajadores.splice(index, 1);
    setTrabajadores(nuevosTrabajadores);
  };

// Reemplaza la función generarTurnos con esta versión mejorada
const generarTurnos = () => {
  const resultado = [];
  const domingosContador = {};
  const horasTrabajadasPorTrabajador = {};
  const horasAsignadas = {};

  // Inicializar contadores
  trabajadores.forEach((t) => {
    horasTrabajadasPorTrabajador[t.nombre] = 0;
    horasAsignadas[t.nombre] = 0;
    domingosContador[t.nombre] = 0;
  });

  // Calcular distribuciones
  const distribuciones = {};
  trabajadores.forEach((trabajador) => {
    try {
      distribuciones[trabajador.nombre] = calcularDistribucionTurnos(
        trabajador.horasDisponibles,
        diasFuncionamiento,
        t,
        horarioAbierto
      );
    } catch (e) {
      console.warn(`Distribución inválida para ${trabajador.nombre}:`, e.message);
    }
  });

  // Ordenar trabajadores alfabéticamente
  const trabajadoresOrdenados = [...trabajadores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  // Función de rotación circular (safe)
  const circularSlice = (lista, inicio, cantidad) => {
    if (!lista || !lista.length) return [];
    return Array.from({ length: Math.min(cantidad, lista.length) }, (_, i) => 
      lista[(inicio + i) % lista.length]
    );
  };

  // Procesar cada semana
  for (let semana = 0; semana < semanas; semana++) {
    const semanaData = { semana: semana + 1, dias: [] };
    const horasSemanaTrabajador = {};
    const diasTrabajadosPorTrabajador = {};
    
    trabajadores.forEach(t => {
      horasSemanaTrabajador[t.nombre] = 0;
      diasTrabajadosPorTrabajador[t.nombre] = new Set();
    });

    // Procesar cada día de la semana
    for (let diaIndex = 0; diaIndex < dias.length; diaIndex++) {
      const fechaActual = new Date(fechaInicio);
      fechaActual.setDate(fechaInicio.getDate() + semana * dias.length + diaIndex);
      const fechaISO = fechaActual.toISOString().split('T')[0];
      const diaNombre = dias[diaIndex];
      const diaData = { dia: diaNombre, fecha: fechaISO, asignaciones: [] };

      // Definir los grupos base y apoyo según el patrón de semana
      let base = [];
      let apoyo = [];

      // Cantidad de trabajadores ajustada dinámicamente según los turnos disponibles
      const cantidadBase = Math.min(3, trabajadoresOrdenados.length, turnos.length);
      const cantidadApoyo = Math.min(3, trabajadoresOrdenados.length - cantidadBase);

      // Determinar patrón según la semana y el día
      if (semana < 2) {
        // Patrón para semanas 1-2
        const offset = semana;
        base = circularSlice(trabajadoresOrdenados, offset, cantidadBase);
        
        if (diaNombre === "Domingo") {
          // En domingos, solo usamos el grupo de apoyo
          apoyo = circularSlice(trabajadoresOrdenados, offset + cantidadBase, cantidadApoyo);
          base = []; // No usar base en domingos
        } else if (diaNombre !== "Lunes") {
          // De martes a sábado, usar apoyo
          apoyo = circularSlice(trabajadoresOrdenados, offset + cantidadBase, cantidadApoyo);
        }
      } else {
        // Patrón para semanas 3-4
        // Verificar si hay suficientes trabajadores para el patrón específico
        const suficientesTrabajadores = trabajadoresOrdenados.length >= 6;
        
        if (semana % 2 === 0) { // Semana 3
          if (diaNombre === "Lunes") {
            // Verificar si hay suficientes trabajadores
            if (suficientesTrabajadores) {
              base = [
                trabajadoresOrdenados[3], // d
                trabajadoresOrdenados[4], // e
                trabajadoresOrdenados[5]  // f
              ].filter(Boolean); // Filtrar undefined si no hay suficientes
            } else {
              // Caso de pocos trabajadores: usar los que estén disponibles
              base = circularSlice(trabajadoresOrdenados, 0, cantidadBase);
            }
          } else if (diaNombre === "Domingo") {
            if (suficientesTrabajadores) {
              // Patrón específico para domingo semana 3: a, b, c
              apoyo = [
                trabajadoresOrdenados[0], // a - Turno 1
                trabajadoresOrdenados[1], // b - Turno 2
                trabajadoresOrdenados[2]  // c - Turno 3
              ].filter(Boolean);
            } else {
              // Adaptación para menos de 6 trabajadores
              apoyo = circularSlice(trabajadoresOrdenados, 0, turnos.length);
            }
            base = []; // No base en domingos
          } else {
            // Martes a sábado
            if (suficientesTrabajadores) {
              base = [
                trabajadoresOrdenados[3], // d
                trabajadoresOrdenados[4], // e
                trabajadoresOrdenados[5]  // f
              ].filter(Boolean);
              apoyo = [
                trabajadoresOrdenados[0], // a
                trabajadoresOrdenados[1], // b
                trabajadoresOrdenados[2]  // c
              ].filter(Boolean);
            } else {
              // Adaptación para menos trabajadores
              const mitad = Math.ceil(trabajadoresOrdenados.length / 2);
              base = circularSlice(trabajadoresOrdenados, 0, mitad);
              apoyo = circularSlice(trabajadoresOrdenados, mitad, trabajadoresOrdenados.length - mitad);
            }
          }
        } else { // Semana 4
          if (diaNombre === "Lunes") {
            if (suficientesTrabajadores) {
              base = [
                trabajadoresOrdenados[4], // e
                trabajadoresOrdenados[5], // f
                trabajadoresOrdenados[0]  // a
              ].filter(Boolean);
            } else {
              base = circularSlice(trabajadoresOrdenados, 1, cantidadBase);
            }
          } else if (diaNombre === "Domingo") {
            if (suficientesTrabajadores) {
              apoyo = [
                trabajadoresOrdenados[1], // b - Turno 1
                trabajadoresOrdenados[2], // c - Turno 2
                trabajadoresOrdenados[3]  // d - Turno 3
              ].filter(Boolean);
            } else {
              apoyo = circularSlice(trabajadoresOrdenados, 1, turnos.length);
            }
            base = []; // No base en domingos
          } else {
            // Martes a sábado
            if (suficientesTrabajadores) {
              base = [
                trabajadoresOrdenados[4], // e
                trabajadoresOrdenados[5], // f
                trabajadoresOrdenados[0]  // a
              ].filter(Boolean);
              apoyo = [
                trabajadoresOrdenados[1], // b
                trabajadoresOrdenados[2], // c
                trabajadoresOrdenados[3]  // d
              ].filter(Boolean);
            } else {
              // Adaptación para menos trabajadores
              const mitad = Math.ceil(trabajadoresOrdenados.length / 2);
              base = circularSlice(trabajadoresOrdenados, 1, mitad);
              apoyo = circularSlice(trabajadoresOrdenados, mitad + 1, trabajadoresOrdenados.length - mitad);
            }
          }
        }
      }

      // Función para validar elegibilidad de un trabajador para un turno
      const validarElegibilidad = (trabajador, turno) => {
        // Verificaciones de seguridad
        if (!trabajador || !turno) return { elegible: false };
        
        if (diaNombre === "Domingo") {
          console.log(`🔍 Evaluando a ${trabajador.nombre} para el turno ${turno.nombre} del DOMINGO ${fechaISO}`);
        }

        const dist = distribuciones[trabajador.nombre];
        if (!dist) return { elegible: false };

        let Ji = dist.jornadas[diaIndex];

        // Si no hay jornada, y es domingo, asignar jornada estándar
        if (Ji === undefined) {
          if (diaNombre === "Domingo") {
            Ji = horasEfectivasPorTurno; // solo si no hay ninguna jornada definida
          } else {
            return { elegible: false };
          }
        }

        // Si el día es domingo y no tiene jornada asignada, usar valor efectivo
        if (diaNombre === "Domingo" && Ji === 0) {
          Ji = horasEfectivasPorTurno;
        }

        const JiUsar = Ji;

        // ⚠️ Ya asignado este día
        if (diasTrabajadosPorTrabajador[trabajador.nombre].has(fechaISO)) {
          if (diaNombre === "Domingo") {
            console.warn(`❌ ${trabajador.nombre} ya asignado este día (${fechaISO})`);
          }
          return { elegible: false };
        }

        // Determinar si este trabajador pertenece al grupo de apoyo
        const esTrabajadrDeApoyo = apoyo.some(t => t && t.nombre === trabajador.nombre);

        // ⚠️ Validar que tenga horas restantes suficientes - MODIFICADO PARA DOMINGOS
        const horasRestantesSemana = trabajador.horasDisponibles - horasSemanaTrabajador[trabajador.nombre];

        if (diaNombre === "Domingo") {
          // Para el domingo, permitir usar las horas restantes disponibles
          const horasMinimas = 4; // Mínimo de horas aceptable para un turno de domingo

          if (horasRestantesSemana <= 0) {
            console.warn(`❌ ${trabajador.nombre} no tiene horas restantes disponibles para el domingo.`);
            return { elegible: false };
          } else if (horasRestantesSemana < horasMinimas) {
            console.warn(`❌ ${trabajador.nombre} tiene muy pocas horas restantes (${horasRestantesSemana}). Necesitamos al menos ${horasMinimas}.`);
            return { elegible: false };
          } else {
            // Usar las horas disponibles que quedan (hasta el máximo del turno normal)
            const horasAUsar = Math.min(JiUsar, horasRestantesSemana);
            console.log(`✅ ${trabajador.nombre} tiene ${horasRestantesSemana} horas restantes. Usando ${horasAUsar} para el domingo.`);
            // Continúa con las demás validaciones, pero guarda la cantidad de horas a usar
            // Ji será actualizado al final
            Ji = horasAUsar;
          }
        } else if (horasRestantesSemana < JiUsar) {
          // Para días que no son domingo, mantener la validación estricta
          return { elegible: false };
        }

        // ⚠️ Máximo 6 días de trabajo por semana - MODIFICADO PARA GRUPO DE APOYO EN DOMINGO
        const diasTrabajados = diasTrabajadosPorTrabajador[trabajador.nombre].size;
        if (diasTrabajados >= 6) {
          // Si es domingo Y el trabajador es del grupo de apoyo, permitir la excepción
          if (diaNombre === "Domingo" && esTrabajadrDeApoyo) {
            // Permitir asignación para el grupo de apoyo en domingo
            console.log(`✅ ${trabajador.nombre} trabajará el domingo como séptimo día (grupo de apoyo)`);
          } else {
            if (diaNombre === "Domingo") {
              console.warn(`❌ ${trabajador.nombre} ya tiene 6 días asignados esta semana`);
            }
            return { elegible: false };
          }
        }

        // ⚠️ Ya fue asignado hoy en otro turno
        const yaAsignado = diaData.asignaciones.some(a =>
          a.trabajadores && a.trabajadores.some(t => t && t.nombre === trabajador.nombre)
        );
        if (yaAsignado) return { elegible: false };

        // ⚠️ Máximo 2 domingos
        if (diaNombre === "Domingo" && domingosContador[trabajador.nombre] >= 2) return { elegible: false };

        // ⚠️ Validar descanso mínimo de 12 horas
        const Ei = turno.inicio;
        const fechaTurno = new Date(fechaISO);
        fechaTurno.setHours(Math.floor(Ei), (Ei % 1) * 60, 0, 0);

        const turnosAnteriores = resultado
          .flatMap(s => s.dias)
          .filter(d => new Date(d.fecha) <= fechaTurno)
          .flatMap(dia =>
            dia.asignaciones
              .filter(a => a.trabajadores && a.trabajadores.some(t => t && t.nombre === trabajador.nombre))
              .map(a => {
                const turnoPrev = turnos.find(t => t.nombre === a.turno);
                if (!turnoPrev) return { horaFin: 0 };
                
                const fin = turnoPrev.fin || 0;
                const inicio = turnoPrev.inicio || 0;
                const fechaFin = new Date(dia.fecha);
                fechaFin.setHours(Math.floor(fin), (fin % 1) * 60, 0, 0);
                if (fin < inicio) {
                  fechaFin.setDate(fechaFin.getDate() + 1); // turno cruzado
                }
                return { horaFin: fechaFin };
              })
          )
          .sort((a, b) => b.horaFin - a.horaFin)
          .slice(0, 2);

        for (let asign of turnosAnteriores) {
          const horasDescanso = (fechaTurno - asign.horaFin) / (1000 * 60 * 60);
          if (horasDescanso < 12) return { elegible: false };
        }

        // 🧪 Log para rastrear por qué alguien no es elegido
        if (diaNombre === "Domingo") {
          console.log(
            `🧪 ${trabajador.nombre} - JiUsar: ${Ji}, Restante: ${horasRestantesSemana}, Días: ${diasTrabajados}, Domingos: ${domingosContador[trabajador.nombre]}`
          );
        }

        return { elegible: true, JiUsar: Ji };  // Retornar las horas ajustadas para domingos
      };

      // Procesar cada turno del día
      for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
        const turno = turnos[turnoIndex];
        let posibles = [];

        // Manejo específico de domingos para semanas 3-4
        if (diaNombre === "Domingo" && semana >= 2) {
          // Patrón específico para domingos en semanas 3-4
          // Asignar el trabajador específico para este turno si está disponible
          if (turnoIndex < apoyo.length) {
            const trabajador = apoyo[turnoIndex];
            if (trabajador) {
              posibles = [trabajador];
            }
          }
        } 
        // Caso general para días normales
        else if (diaNombre === "Lunes") {
          // En lunes solo usamos base
          if (turnoIndex < base.length) {
            const trabajador = base[turnoIndex];
            if (trabajador) {
              posibles.push(trabajador);
            }
          }
        } else if (diaNombre === "Domingo") {
          // En domingos de semanas 1-2 usamos a todos del grupo de apoyo
          posibles = apoyo.filter(Boolean);
        } else {
          // De martes a sábado
          // Primero intentamos con trabajadores de base específicos para este turno
          if (turnoIndex < base.length) {
            const trabajador = base[turnoIndex];
            if (trabajador) {
              posibles.push(trabajador);
            }
          }
          
          // Luego con trabajadores de apoyo específicos para este turno
          if (turnoIndex < apoyo.length) {
            const trabajador = apoyo[turnoIndex];
            if (trabajador) {
              posibles.push(trabajador);
            }
          }
        }

        // Si no hay posibles candidatos, intentar con cualquiera disponible
        if (posibles.length === 0) {
          // Si es domingo, intentar con cualquier trabajador del grupo de apoyo
          if (diaNombre === "Domingo") {
            posibles = apoyo.filter(Boolean);
          } 
          // En otros días, intentar con cualquier trabajador de base o apoyo
          else {
            posibles = [...base, ...apoyo].filter(Boolean);
          }
        }

        // Asignación de trabajador
        let asignado = false;
        
        // Casos especiales para semanas 3-4 en domingos - forzar el patrón específico
        if (semana >= 2 && diaNombre === "Domingo" && turnoIndex < apoyo.length) {
          const trabajadorEspecifico = apoyo[turnoIndex];
          
          if (trabajadorEspecifico) {
            let resultadoElegibilidad;
            
            // Forzar asignación si estamos en el patrón específico
            const esSemana3 = semana % 2 === 0;
            const esTrabajadorCorrectoDomingo = (
              (esSemana3 && turnoIndex < 3 && 
                [trabajadoresOrdenados[0]?.nombre, trabajadoresOrdenados[1]?.nombre, trabajadoresOrdenados[2]?.nombre].includes(trabajadorEspecifico.nombre)) ||
              (!esSemana3 && turnoIndex < 3 && 
                [trabajadoresOrdenados[1]?.nombre, trabajadoresOrdenados[2]?.nombre, trabajadoresOrdenados[3]?.nombre].includes(trabajadorEspecifico.nombre))
            );
            
            if (esTrabajadorCorrectoDomingo) {
              // Forzar la asignación para el patrón específico
              resultadoElegibilidad = { 
                elegible: true, 
                JiUsar: Math.min(horasEfectivasPorTurno, 
                  trabajadorEspecifico.horasDisponibles - horasSemanaTrabajador[trabajadorEspecifico.nombre]) 
              };
              console.log(`🚩 Forzando asignación para el patrón específico de domingo en semana ${semana+1}`);
            } else {
              // Validación normal para otros casos
              resultadoElegibilidad = validarElegibilidad(trabajadorEspecifico, turno);
            }
            
            if (resultadoElegibilidad.elegible) {
              const dist = distribuciones[trabajadorEspecifico.nombre] || {};
              let Ji = resultadoElegibilidad.JiUsar;
              
              if (Ji === undefined || Ji === 0) {
                Ji = horasEfectivasPorTurno;
              }

              const Ei = turno.inicio;
              const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2));

              horasTrabajadasPorTrabajador[trabajadorEspecifico.nombre] += Ji;
              horasSemanaTrabajador[trabajadorEspecifico.nombre] += Ji;
              horasAsignadas[trabajadorEspecifico.nombre] += Ji;
              if (diaNombre === "Domingo") domingosContador[trabajadorEspecifico.nombre]++;

              let asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
              if (!asignacion) {
                asignacion = {
                  turno: turno.nombre,
                  horario: `${formatearHora(Ei)}–${formatearHora(Si)}`,
                  trabajadores: [],
                  tipo: dist.clasificacion && dist.clasificacion[diaIndex] ? dist.clasificacion[diaIndex] : "adicional",
                  duracion: Ji,
                  fecha: fechaISO
                };
                diaData.asignaciones.push(asignacion);
              }

              asignacion.trabajadores.push(trabajadorEspecifico);
              diasTrabajadosPorTrabajador[trabajadorEspecifico.nombre].add(fechaISO);
              asignado = true;
            }
          }
        }
        
        // Proceso general de asignación si no se hizo una asignación forzada
        if (!asignado) {
          for (let candidato of posibles) {
            // Verificación de seguridad
            if (!candidato) continue;
            
            const resultadoElegibilidad = validarElegibilidad(candidato, turno);
            if (resultadoElegibilidad.elegible) {
              const dist = distribuciones[candidato.nombre] || {};
              let Ji = resultadoElegibilidad.JiUsar;
              
              if (Ji === undefined || Ji === 0) {
                Ji = horasEfectivasPorTurno;
              }

              const Ei = turno.inicio;
              const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2));

              horasTrabajadasPorTrabajador[candidato.nombre] += Ji;
              horasSemanaTrabajador[candidato.nombre] += Ji;
              horasAsignadas[candidato.nombre] += Ji;
              if (diaNombre === "Domingo") domingosContador[candidato.nombre]++;

              let asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
              if (!asignacion) {
                asignacion = {
                  turno: turno.nombre,
                  horario: `${formatearHora(Ei)}–${formatearHora(Si)}`,
                  trabajadores: [],
                  tipo: dist.clasificacion && dist.clasificacion[diaIndex] ? dist.clasificacion[diaIndex] : "adicional",
                  duracion: Ji,
                  fecha: fechaISO
                };
                diaData.asignaciones.push(asignacion);
              }

              asignacion.trabajadores.push(candidato);
              diasTrabajadosPorTrabajador[candidato.nombre].add(fechaISO);
              asignado = true;
              break;
            }
          }
        }

        // Si no se asignó nadie, crear una asignación vacía
        let asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
        if (!asignacion) {
          asignacion = {
            turno: turno.nombre,
            horario: `${formatearHora(turno.inicio)}–${formatearHora(turno.fin)}`,
            trabajadores: [],
            tipo: "No cobertura",
            duracion: 0,
            fecha: fechaISO
          };
          diaData.asignaciones.push(asignacion);
          
          // Caso especial: forzar asignación para domingo en semanas 3-4
          if ((semana === 2 || semana === 3) && diaNombre === "Domingo") {
            // Determinar qué patrón usar
            const patronDomingo = semana === 2 
              ? [0, 1, 2] // a, b, c para semana 3
              : [1, 2, 3]; // b, c, d para semana 4
            
            // Verificar si este turno corresponde al patrón específico
            if (turnoIndex < patronDomingo.length && trabajadoresOrdenados.length > patronDomingo[turnoIndex]) {
              const idxTrabajador = patronDomingo[turnoIndex];
              const trabajadorForzado = trabajadoresOrdenados[idxTrabajador];
              
              if (trabajadorForzado) {
                console.log(`🔧 Forzando asignación de ${trabajadorForzado.nombre} para ${turno.nombre} del domingo en semana ${semana+1} (última oportunidad)`);
                
                // Calcular las horas disponibles del trabajador
                const horasDisponibles = trabajadorForzado.horasDisponibles - horasSemanaTrabajador[trabajadorForzado.nombre];
                let horasAsignar = Math.min(horasEfectivasPorTurno, Math.max(4, horasDisponibles));
                
                asignacion.trabajadores.push(trabajadorForzado);
                asignacion.duracion = horasAsignar;
                asignacion.tipo = "adicional";
                asignacion.horario = `${formatearHora(turno.inicio)}–${formatearHora(turno.inicio + horasAsignar + horasColacion)}`;
                
                // Actualizar contadores
                horasTrabajadasPorTrabajador[trabajadorForzado.nombre] += horasAsignar;
                horasSemanaTrabajador[trabajadorForzado.nombre] += horasAsignar;
                horasAsignadas[trabajadorForzado.nombre] += horasAsignar;
                domingosContador[trabajadorForzado.nombre]++;
                diasTrabajadosPorTrabajador[trabajadorForzado.nombre].add(fechaISO);
              }
            }
          }
        }
      }

      // Segunda pasada: agregar refuerzo si solo hay 1 trabajador en el turno
      let apoyoSegundaPasada = diaNombre !== "Lunes" ? apoyo.filter(Boolean) : [];
      
      for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
        const asignacion = diaData.asignaciones.find(a => a.turno === turnos[turnoIndex].nombre);
        
        // Solo hacer refuerzo si hay exactamente un trabajador asignado
        if (asignacion && asignacion.trabajadores && asignacion.trabajadores.length === 1) {
          const posibles = apoyoSegundaPasada
            .map(t => {
              if (!t) return null;
              return {
                candidato: t,
                resultado: validarElegibilidad(t, turnos[turnoIndex])
              };
            })
            .filter(obj => 
              obj && obj.resultado && obj.resultado.elegible && 
              !asignacion.trabajadores.some(tr => tr && tr.nombre === obj.candidato.nombre)
            );

          if (posibles.length > 0) {
            const { candidato, resultado } = posibles[0];
            if (candidato && resultado) {
              const dist = distribuciones[candidato.nombre] || {};
              const Ji = resultado.JiUsar;
              const Ei = turnos[turnoIndex].inicio;
              const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2));

              horasTrabajadasPorTrabajador[candidato.nombre] += Ji;
              horasSemanaTrabajador[candidato.nombre] += Ji;
              horasAsignadas[candidato.nombre] += Ji;
              if (diaNombre === "Domingo") domingosContador[candidato.nombre]++;

              asignacion.trabajadores.push(candidato);
              diasTrabajadosPorTrabajador[candidato.nombre].add(fechaISO);
            }
          }
        }
      }

      semanaData.dias.push(diaData);
    }

    resultado.push(semanaData);
  }

  return {
    resultado,
    horasTrabajadasPorTrabajador, 
    distribuciones
  };
};

  const rellenarNoCoberturaConExtras = (resultado, horasAsignadas, trabajadores, distribuciones, dias) => {
    for (let semana of resultado) {
      for (let diaIndex = 0; diaIndex < semana.dias.length; diaIndex++) {
        const dia = semana.dias[diaIndex];

        for (let asignacion of dia.asignaciones) {
          // Si ya tiene al menos 1 trabajador, puedes ajustar este número si deseas más
          if (asignacion.trabajadores.length >= 1) continue;

          const candidatos = trabajadores.filter((t) => {
            const yaAsignado = asignacion.trabajadores.some(tr => tr.nombre === t.nombre);
            if (yaAsignado) return false;

            const dist = distribuciones[t.nombre];
            if (!dist || diaIndex >= dist.jornadas.length) return false;

            const Ji = dist.jornadas[diaIndex];
            const horasRestantes = t.horasDisponibles - (horasAsignadas[t.nombre] || 0);
            return horasRestantes >= Ji;
          });

          const refuerzo = candidatos[0];
          if (refuerzo) {
            const dist = distribuciones[refuerzo.nombre];
            const Ji = dist.jornadas[diaIndex];

            // Sumar horas
            horasAsignadas[refuerzo.nombre] = (horasAsignadas[refuerzo.nombre] || 0) + Ji;

            // Agregar a la asignación
            asignacion.trabajadores.push(refuerzo);

            // Actualizar horario por si estaba incompleto
            const Ei = turnos.find(t => t.nombre === asignacion.turno)?.inicio || horarioAbierto;
            const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2));
            asignacion.horario = `${formatearHora(Ei)}–${formatearHora(Si)}`;
            asignacion.duracion = Ji;
          }
        }
      }
    }

    return { resultado, horasAsignadas };
  };


  const rawStart = horarioAbiertoInput;
  const rawEnd = horarioCierreInput;

  const horasPorDia = rawStart === rawEnd
    ? 24 // Si apertura y cierre son iguales, interpretamos jornada completa
    : ((rawEnd - rawStart + 24) % 24);

  const totalHorasSemana = horasPorDia * diasFuncionamiento;
  const totalHorasDisponibles = trabajadores.reduce(
    (total, t) => total + t.horasDisponibles, 0
  );
  //const datosTurnos = generarTurnos();//cambiar


  const [horasTrabajadasPorTrabajador, setHorasTrabajadas] = useState({});
  useEffect(() => {
    if (horasColacion < 0.5) {
      alert("❗ La colación mínima debe ser de 0.5 horas (30 minutos). Ajusta el valor.");
      setHorasColacion(0.5);
      return;
    }
    const { resultado, horasTrabajadasPorTrabajador, distribuciones } = generarTurnos();
    let distEjemplo = null;
    try {
      distEjemplo = calcularDistribucionTurnos(
        trabajadores[0]?.horasDisponibles || 45,
        diasFuncionamiento,
        t,
        horarioAbierto
      );
    } catch (e) {
      console.warn("Distribución inválida para el cálculo base:", e.message);
    }

    const mEjemplo = distEjemplo?.m || 0;

    const postProcesado = rellenarNoCoberturaConExtras(
      resultado,
      horasTrabajadasPorTrabajador,
      trabajadores,
      distribuciones,
      dias
    );

    setDatosTurnos(postProcesado.resultado);
    setHorasTrabajadas(postProcesado.horasAsignadas);

    setDescansosIncorrectos(validarDescansos(resultado));
    setDomingosTrabajados(contarDomingos(resultado));
    console.log("Días calculados (useMemo):", dias);

  }, [trabajadores, semanas, horasColacion, horarioAbierto, horarioCierre, fechaInicio, inicioSemana, diasFuncionamiento]);

  const exportarExcel = () => {
    // Cabecera dinámica con los nombres de los turnos activos
    const header = ["Semana", "Día", ...turnos.map(t => `Turno ${t.nombre}`)];
    const worksheetData = [header];

    datosTurnos.forEach((semana) => {
      semana.dias.forEach((dia) => {
        const fila = [
          `Semana ${semana.semana}`,
          dia.dia,
          ...dia.asignaciones.map(a => a.trabajador.nombre || '—')
        ];

        worksheetData.push(fila);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Turnos");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'Turnos_Dinamico.xlsx');
  };


  const contarDomingos = (datosTurnos) => {
    const contador = {};
    trabajadores.forEach((trabajador) => {
      contador[trabajador.nombre] = 0;
    });

    datosTurnos.forEach((semana) => {
      const diaDomingo = semana.dias.find(d => d.dia === "Domingo");
      if (!diaDomingo) return; // Si no hay domingo en esa semana, omitir

      diaDomingo.asignaciones.forEach((asignacion) => {
        asignacion.trabajadores.forEach(t => {
          if (contador[t.nombre] !== undefined) {
            contador[t.nombre]++;
          }
        });
      });
    });

    return contador;
  };

  const validarDescansos = (datosTurnos) => {
    const descansosIncorrectos = [];

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
      for (let s = 0; s < datosTurnos.length; s++) {
        const semana = datosTurnos[s];

        for (let d = 0; d < semana.dias.length; d++) {
          const diaHoy = semana.dias[d];
          const fechaHoy = new Date(diaHoy.fecha);

          // ⚠️ Filtrar asignaciones válidas
          const asignacionesHoy = diaHoy.asignaciones.filter(
            (a) =>
              a.trabajadores.some(t => t.nombre === trabajador.nombre) &&
              a.turno &&
              !a.turno.toLowerCase().includes("no cobertura")
          );

          // 1️⃣ Validar descansos entre turnos del MISMO día
          for (let i = 0; i < asignacionesHoy.length; i++) {
            const turnoA = turnos.find(t => t.nombre === asignacionesHoy[i].turno);
            if (!turnoA) continue;
            const finA = turnoA.fin >= turnoA.inicio ? turnoA.fin : turnoA.fin + 24;

            for (let j = i + 1; j < asignacionesHoy.length; j++) {
              const turnoB = turnos.find(t => t.nombre === asignacionesHoy[j].turno);
              if (!turnoB) continue;
              const inicioB = turnoB.inicio >= turnoB.inicio ? turnoB.inicio : turnoB.inicio + 24;

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

          // 2️⃣ Validar descansos entre días consecutivos
          if (d + 1 < semana.dias.length) {
            const diaManiana = semana.dias[d + 1];
            const fechaManiana = new Date(diaManiana.fecha);

            const asignacionesManiana = diaManiana.asignaciones.filter(
              (a) =>
                a.trabajadores.some(t => t.nombre === trabajador.nombre) &&
                a.turno &&
                !a.turno.toLowerCase().includes("no cobertura")
            );
            for (const asignacionHoy of asignacionesHoy) {
              const turnoHoy = turnos.find((t) => t.nombre === asignacionHoy.turno);
              if (!turnoHoy) continue;
              const finHoyHora = turnoHoy.fin >= turnoHoy.inicio ? turnoHoy.fin : turnoHoy.fin + 24;

              const fechaFinHoy = new Date(fechaHoy);
              fechaFinHoy.setHours(0, 0, 0, 0);
              fechaFinHoy.setHours(Math.floor(finHoyHora), (finHoyHora % 1) * 60);

              for (const asignacionManiana of asignacionesManiana) {
                const turnoManiana = turnos.find((t) => t.nombre === asignacionManiana.turno);
                if (!turnoManiana) continue;
                const inicioManianaHora = turnoManiana.inicio >= turnoManiana.inicio
                  ? turnoManiana.inicio
                  : turnoManiana.inicio + 24;

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
  };





  const validarDiasSeguidos = (datosTurnos) => {
    const violaciones = [];

    trabajadores.forEach((trabajador) => {
      const diasTrabajados = [];

      datosTurnos.forEach((semana) => {
        semana.dias.forEach((dia) => {
          const asignado = dia.asignaciones.some(
            (a) => a.trabajadores.some(t => t.nombre === trabajador.nombre)
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
  };
  const [violacionesDiasSeguidos, setViolacionesDiasSeguidos] = useState([]);


  const [descansosIncorrectos, setDescansosIncorrectos] = useState([]);

  const [domingosTrabajados, setDomingosTrabajados] = useState({});

  const [trabajadoresMinimos, setTrabajadoresMinimos] = useState(0);

  const [cumpleHoras, setCumpleHoras] = useState(true);
  ;
  const [cumpleCantidadTrabajadores, setCumpleCantidadTrabajadores] = useState(true);

  const [cumpleDomingosLibres, setCumpleDomingosLibres] = useState(true);


  //funcion cambio de posicion de trabajador en malla
  const handleCambioTrabajador = (nuevoNombre, semanaNum, fecha, turnoNombre, indexTrabajador) => {
    const nuevaData = datosTurnos.map((semana) => {
      if (semana.semana !== semanaNum) return semana;

      return {
        ...semana,
        dias: semana.dias.map((dia) => {
          if (dia.fecha !== fecha) return dia;

          return {
            ...dia,
            asignaciones: dia.asignaciones.map((asig) => {
              if (asig.turno !== turnoNombre) return asig;

              const trabajadoresActuales = [...asig.trabajadores];

              // Evitar duplicados
              if (trabajadoresActuales.some(t => t.nombre === nuevoNombre)) {
                return asig; // No cambiar si ya está ese trabajador
              }

              // Actualizar el trabajador en la posición deseada
              trabajadoresActuales[indexTrabajador] = { nombre: nuevoNombre };

              return {
                ...asig,
                trabajadores: trabajadoresActuales
              };
            })
          };
        })
      };
    });




    setDatosTurnos(nuevaData);

    //  Forzar actualización de validaciones
    setDescansosIncorrectos(validarDescansos(nuevaData));
    setDomingosTrabajados(contarDomingos(nuevaData));




  };

  const [minPorHoras, setMinPorHoras] = useState(0);
  const [minPorDias, setMinPorDias] = useState(0);
  const [minPorDomingos, setMinPorDomingos] = useState(0);
  const [razonMinTrabajadores, setRazonMinTrabajadores] = useState("");


  useEffect(() => {
    if (turnos.length === 0 || trabajadores.length === 0) return;

    const horasDisponibles = trabajadores.reduce(
      (acc, t) => acc + (t.horasDisponibles * semanas), 0
    );

    // Promedio de horas semanales por trabajador
    const promedioHoras = trabajadores.length > 0
      ? horasDisponibles / trabajadores.length
      : 45; // Fallback

    // Mínimo por horas
    const minPorHoras = Math.ceil(totalHorasSemana / promedioHoras);

    // Mínimo por días (6 días por semana máx)
    const bloquesACubrir = turnos.length * diasFuncionamiento * semanas;
    const maxBloquesPorTrabajador = 6 * semanas;
    const minPorDias = Math.ceil(bloquesACubrir / maxBloquesPorTrabajador);

    // Mínimo por domingos (cada trabajador solo puede cubrir hasta 2 domingos)
    // Considera los turnos activos y multiplícalos por la cantidad de domingos reales
    const turnosPorDomingo = turnos.length;               // ej: 3
    const totalTurnosDomingo = turnosPorDomingo * semanas; // ej: 3 * 4 = 12 turnos en total
    const maxTurnosPorTrabajador = 2;                      // porque solo puede trabajar 2 domingos (1 turno por cada uno)
    const minPorDomingos = Math.ceil(totalTurnosDomingo / maxTurnosPorTrabajador); // 12 / 2 = 6

    // Elegimos el mayor como mínimo requerido
    const minTrabajadores = Math.max(minPorHoras, minPorDias, minPorDomingos);

    const cumpleH = horasDisponibles >= totalHorasSemana;
    const cumpleCantidad = trabajadores.length >= minTrabajadores;

    // Cálculo de domingos trabajados
    const domingosContados = contarDomingos(datosTurnos);
    const cumpleDomingos = Object.values(domingosContados).every(
      (dom) => (semanas - dom) >= 2
    );

    // Asignar estados
    setCumpleHoras(cumpleH);
    setCumpleCantidadTrabajadores(cumpleCantidad);
    setCumpleDomingosLibres(cumpleDomingos);
    setTrabajadoresMinimos(minTrabajadores);
    setMinPorHoras(minPorHoras);
    setMinPorDias(minPorDias);
    setMinPorDomingos(minPorDomingos);

    if (minTrabajadores === minPorHoras) {
      setRazonMinTrabajadores("📊 Basado en horas semanales necesarias.");
    } else if (minTrabajadores === minPorDias) {
      setRazonMinTrabajadores("📅 Basado en máximo 6 días trabajables.");
    } else {
      setRazonMinTrabajadores("🕐 Basado en restricción de 2 domingos como máximo.");
    }

    const violaciones = validarDiasSeguidos(datosTurnos);
    setViolacionesDiasSeguidos(violaciones);
  }, [datosTurnos, trabajadores, turnos, dias.length, horasColacion, semanas]);






  return (
    <div className="container">
      <div className="left-panel">
        <h1 className="title">Parámetros Generales</h1>

        <div className="input-group">
          <input
            type="text"
            placeholder="Nombre del trabajador"
            value={nuevoTrabajador}
            onChange={(e) => setNuevoTrabajador(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarTrabajador()}
          />
          <select value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value)}>
            <option value="Completo">Completo (45h)</option>
            <option value="Parcial">Parcial (30h)</option>
            <option value="Flexible">Flexible (20h)</option>
          </select>
          <button className="primary-button" onClick={agregarTrabajador}>Agregar</button>
          <input
            type="number"
            min="1"
            placeholder="Horas semanales"
            value={horasContrato}
            onChange={(e) => setHorasContrato(Number(e.target.value))}
          />
        </div>

        {trabajadores.length > 0 && (
          <div className="worker-list">
            <ul>
              {trabajadores.map((trabajador, index) => (
                <li key={index}>
                  {trabajador.nombre} - {trabajador.tipoContrato} ({trabajador.horasDisponibles}h)
                  <button className="delete-button" onClick={() => eliminarTrabajador(index)}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="input-group">
          <label>Horas de colación:</label>
          <input
            type="number"
            //min="0.5"
            step="0.1"
            value={horasColacion}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 0.5) {
                setHorasColacion(value);
              } else {
                alert("La colación debe ser de al menos 0.5 horas.");
                setHorasColacion(0.5);
              }
            }}
          />
        </div>

        <div className="input-group">
          <label>Fecha de inicio:</label>
          <input
            type="date"
            value={fechaInicio.toISOString().split('T')[0]}
            onChange={(e) => setFechaInicio(new Date(e.target.value))}
          />
        </div>

        <div className="input-group">
          <label style={{ fontWeight: 'bold' }}>Horario de Atención:</label>

          {/* Desde */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', marginRight: '10px' }}>
              <div>Horas</div>
              <input
                type="number"
                min="0"
                max="23"
                value={Math.floor(horarioAbiertoInput)}
                onChange={(e) => {
                  const horas = Number(e.target.value);
                  setHorarioAbiertoInput((prev) => horas + (prev % 1));
                }}
                style={{ width: '60px', textAlign: 'center', padding: '6px' }}
              />
            </div>

            <div style={{ fontSize: '24px', margin: '0 5px' }}>:</div>

            <div style={{ textAlign: 'center' }}>
              <div>Minutos</div>
              <input
                type="number"
                min="0"
                max="59"
                value={Math.round((horarioAbiertoInput % 1) * 60)}
                onChange={(e) => {
                  const minutos = Number(e.target.value);
                  setHorarioAbiertoInput((prev) => Math.floor(prev) + minutos / 60);
                }}
                style={{ width: '60px', textAlign: 'center', padding: '6px' }}
              />
            </div>
          </div>

          {/* Hasta */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', marginRight: '10px' }}>
              <div>Horas</div>
              <input
                type="number"
                min="0"
                max="31"
                value={Math.floor(horarioCierreInput)}
                onChange={(e) => {
                  const horas = Number(e.target.value);
                  setHorarioCierreInput((prev) => horas + (prev % 1));
                }}
                style={{ width: '60px', textAlign: 'center', padding: '6px' }}
              />
            </div>

            <div style={{ fontSize: '24px', margin: '0 5px' }}>:</div>

            <div style={{ textAlign: 'center' }}>
              <div>Minutos</div>
              <input
                type="number"
                min="0"
                max="59"
                value={Math.round((horarioCierreInput % 1) * 60)}
                onChange={(e) => {
                  const minutos = Number(e.target.value);
                  setHorarioCierreInput((prev) => Math.floor(prev) + minutos / 60);
                }}
                style={{ width: '60px', textAlign: 'center', padding: '6px' }}
              />
            </div>
          </div>

          <button
            className="primary-button"
            style={{ marginTop: '12px' }}
            onClick={() => {
              setHorarioAbierto(horarioAbiertoInput);
              setHorarioCierre(horarioCierreInput);
            }}
          >
            Aplicar horario
          </button>
        </div>



        {turnos.length === 0 && (
          <p className="alert">⚠️ El rango de horario no permite generar al menos un turno completo.</p>
        )}

        <button onClick={exportarExcel} className="export-button">📥 Exportar Excel</button>

        <div className="card">
          <h2>Variables Matemáticas</h2>
          <ul>
            <li>Trabajadores activos: {trabajadores.length}</li>
            <li>Horas disponibles totales: {totalHorasDisponibles} horas</li>
            <li>Horas necesarias semana: {totalHorasSemana} horas</li>
            <li>Duración turno largo (incluye colación): {trabajadores[0] && calcularDistribucionTurnos(trabajadores[0].horasDisponibles, diasFuncionamiento, t, horarioAbierto).J_l} h</li>
            <li>Duración turno chico (incluye colación): {trabajadores[0] && calcularDistribucionTurnos(trabajadores[0].horasDisponibles, diasFuncionamiento, t, horarioAbierto).J_ch} h</li>

          </ul>
        </div>


        <div className="card">
          <h2>Validaciones Legales</h2>

          {!cumpleHoras && (
            <p className="alert">
              ⚠️ No se cumplen las horas mínimas requeridas ({totalHorasDisponibles} de {totalHorasSemana} horas).
            </p>
          )}



          {!cumpleCantidadTrabajadores && (
            <p className="alert">
              ⚠️ Se recomienda mínimo {trabajadoresMinimos} trabajadores para cubrir la jornada. Actualmente tienes {trabajadores.length}.
            </p>
          )}

          <p className="info">
            Mínimo por horas: {minPorHoras} trabajadores. <br />
            Mínimo por días: {minPorDias} trabajadores. <br />
            Mínimo por domingos: {minPorDomingos} trabajadores. <br />
            <strong>Motivo del mínimo final:</strong> {razonMinTrabajadores}
          </p>


          {!cumpleDomingosLibres && (
            <p className="alert">⚠️ No todos los trabajadores tienen 2 domingos libres.</p>
          )}

          {cumpleHoras && cumpleDomingosLibres && cumpleCantidadTrabajadores && trabajadores.length > 1 && (
            <p className="success">✅ Todos los requisitos legales están cumplidos.</p>
          )}

          {violacionesDiasSeguidos.length > 0 && (
            <div className="alert">
              <h3>Días seguidos sin descanso:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Días seguidos</th>
                  </tr>
                </thead>
                <tbody>
                  {violacionesDiasSeguidos.map((v, index) => (
                    <tr key={index}>
                      <td>{v.trabajador}</td>
                      <td>{v.desde}</td>
                      <td>{v.hasta}</td>
                      <td>{v.diasSeguidos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>



        {descansosIncorrectos.length > 0 && (
          <div className="card">
            <h3>Violaciones de descanso entre turnos:</h3>
            <ul>
              {descansosIncorrectos.map((descanso, idx) => (
                <li key={idx} className="alert">
                  ⚠️ {descanso.trabajador} trabajó el {descanso.diaActual} {descanso.fechaActual}
                  ({descanso.turnoActual} {descanso.horarioActual}) y luego el {descanso.diaSiguiente} {descanso.fechaSiguiente}
                  ({descanso.turnoSiguiente} {descanso.horarioSiguiente}), con solo <strong>
                    {Math.max(0, descanso.descanso.toFixed(1))}</strong> horas de descanso.
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card">
          <h2>Domingos Libres</h2>
          <ul>
            {Object.entries(domingosTrabajados).map(([nombre, domingos]) => {
              const libres = semanas - domingos;
              return (
                <li key={nombre}>
                  {nombre}: {libres} domingos libres {libres >= 2 ? "✅" : "⚠️"}
                </li>
              );
            })}
          </ul>
          <h3>Horas trabajadas</h3>
          <ul>
            {Object.entries(horasTrabajadasPorTrabajador).map(([nombre, horas]) => (
              <li key={nombre}>{nombre}: {horas} horas</li>
            ))}
          </ul>
        </div>

        <div className="input-group">
          <label>Día de inicio de semana:</label>
          <select value={inicioSemana} onChange={(e) => setInicioSemana(e.target.value)}>
            {diasSemana.map((dia) => (
              <option key={dia} value={dia}>{dia}</option>
            ))}
          </select>
          <label>Días de funcionamiento:</label>
          <input
            type="number"
            min="1"
            max="7"
            value={diasFuncionamiento}
            onChange={(e) => setDiasFuncionamiento(Number(e.target.value))}
          />
        </div>
        <div className="input-group">
          <label>Bloque mínimo (t):</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
          />
        </div>

      </div>



      {/* Panel Derecho */}
      <div className="right-panel">
        <h1 className="title">Malla de Turnos</h1>
        {datosTurnos.map((semana) => (
          <div key={semana.semana} className="card">
            <h2>Semana {semana.semana}</h2>
            <div className="table-container">
              <table className="turno-table">
                <thead>
                  <tr>
                    <th>Día</th>
                    {turnos.map(turno => (
                      <th key={turno.nombre}>{turno.nombre}<br /><small>{turno.inicioVisual}–{turno.finVisual}</small></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semana.dias.map((diaData, idx) => (
                    <tr key={idx}>
                      <td>
                        {diaData.dia}<br /><small>{diaData.fecha}</small>
                      </td>
                      {turnos.map((turno, index) => {
                        const asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
                        const nombres = asignacion?.trabajadores.map(t => t.nombre).join(", ") || "❌ No cobertura";

                        return (
                          <td key={index}>
                            {nombres}<br />
                            <small>{asignacion?.horario || `${turno.inicioVisual}–${turno.finVisual}`}</small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>




    </div>
  );
};


export default TurnoRotativos;


// funciones viejas
// FUNCIONALIDAD: Determinar qué turnos aplicar según rango de horario definido
/* const turnosPermitidos = useMemo(() => {
   return turnos.filter(t => {
     // Caso especial: si estamos en 24/7 o el horarioCierre es 31 (07:00 del día siguiente)
     if (horarioAbierto === 0 && horarioCierre === 31) return true;
 
     // Validación si el turno está completamente dentro del rango
     const inicioReal = t.inicio >= 24 ? t.inicio - 24 : t.inicio;
     const finReal = t.fin >= 24 ? t.fin - 24 : t.fin;
 
     const rangoInicio = horarioAbierto;
     const rangoFin = horarioCierre > horarioAbierto ? horarioCierre : horarioCierre + 24;
 
     const turnoInicio = t.inicio;
     const turnoFin = t.fin;
 
     // Aceptar solo turnos que comienzan y terminan dentro del horario definido
     return (turnoInicio >= rangoInicio && turnoFin <= rangoFin);
   });
 }, [horarioAbierto, horarioCierre]);
 
   const formato24 = (horaDecimal) => {
    const horas = Math.floor(horaDecimal).toString().padStart(2, '0');
    const minutos = Math.round((horaDecimal % 1) * 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:00`;
  };

  
  const tieneInfraccion = (nombreTrabajador, diaActual, turnoActual) => {
    return descansosIncorrectos.some(
      (d) =>
        d.trabajador === nombreTrabajador &&
        d.diaActual === diaActual &&
        d.turnoActual === turnoActual
    );
  };


    //funcion para rotar turnos

  function rotarTrabajadores(trabajadores, semana, baseCount = 4) {
    const base = trabajadores.slice(0, baseCount);
    const extras = trabajadores.slice(baseCount);
    const rotacionCircular = base.map((_, i) => base[(i + semana) % base.length]);
    return [...rotacionCircular, ...extras];
  }






  // hanlde trabjador : 
  


 
 */