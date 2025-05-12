import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './TurnoRotativos.css';

const TurnoRotativos = () => {
  const [trabajadores, setTrabajadores] = useState([]);
  const [nuevoTrabajador, setNuevoTrabajador] = useState('');
  const [tipoContrato, setTipoContrato] = useState('Completo');
  const [horasContrato, setHorasContrato] = useState(45); // valor por defecto
  const [t, setT] = useState(0.5);
  const [semanas, setSemanas] = useState(4);
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



  const [horasEfectivasPorTurno, setHorasEfectivasPorTurno] = useState(8);
  const [horasColacion, setHorasColacion] = useState(1);

  // variables para inicio de semana dinamico
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const [inicioSemana, setInicioSemana] = useState('Lunes'); // Puedes conectar esto a un <select>
  const [diasFuncionamiento, setDiasFuncionamiento] = useState(7); // Por defecto 7 (toda la semana)

  const dias = useMemo(() => {
    const inicioIndex = diasSemana.indexOf(inicioSemana);
    const diasRotados = [...diasSemana.slice(inicioIndex), ...diasSemana.slice(0, inicioIndex)];
    return diasRotados.slice(0, diasFuncionamiento);
  }, [inicioSemana, diasFuncionamiento]);


  const formato24 = (horaDecimal) => {
    const horas = Math.floor(horaDecimal).toString().padStart(2, '0');
    const minutos = Math.round((horaDecimal % 1) * 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:00`;
  };

  function formatearHora(decimal) {
    const totalMinutos = Math.round(decimal * 60); // redondea correctamente
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;

    const hh = horas.toString().padStart(2, '0');
    const mm = minutos.toString().padStart(2, '0');

    return `${hh}:${mm}`;
  }


  const generarTurnosDinamicos = (inicio, fin, duracionTurno, solape = 0, es247 = false) => {
    const turnos = [];
    let actual = inicio;
    let index = 1;

    const limite = fin;

    while (true) {
      let inicioTurno = actual;
      let finTurno = actual + duracionTurno;

      // ⚠️ Detener si el turno comienza después del cierre
      if (!es247 && inicioTurno >= limite) break;

      // ✅ Si el turno completo se pasa del cierre en modo NO 24/7...
      if (!es247 && finTurno > limite) {
        const nuevoInicio = limite - duracionTurno;

        // Verificar si el nuevo inicio sigue dentro del rango de apertura
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
        break; // No seguir generando más turnos
      }

      // ✅ Agregar turno normalmente
      turnos.push({
        nombre: `Turno ${index}`,
        inicio: inicioTurno,
        fin: finTurno,
        inicioVisual: formatearHora(inicioTurno),
        finVisual: formatearHora(finTurno),
        cruzaDia: finTurno >= 24
      });

      actual += duracionTurno - solape;
      index++;

      // ⏹️ En modo 24/7, detener al completar 24 horas
      if (es247 && actual >= inicio + 24) break;
    }

    return turnos;
  };





  const turnos = useMemo(() => {
    // ⏱️ Cálculo total del turno (efectivo + colación)
    const duracionTurnoTotal = horasEfectivasPorTurno + horasColacion;

    // 🔍 Detectar si es 24/7 (ej: mismo valor apertura y cierre)
    const es247 = ((horarioCierre - horarioAbierto + 24) % 24) === 0;

    // 🔁 Rango total disponible
    const finReal = es247
      ? horarioAbierto + 24
      : (horarioCierre > horarioAbierto
        ? horarioCierre
        : horarioCierre + 24);

    const rangoDisponible = finReal - horarioAbierto;

    // ⚠️ Si el rango no alcanza ni para un turno, abortar
    if (rangoDisponible < duracionTurnoTotal) {
      alert("❗ El rango horario definido no permite ni un turno completo. Amplía el rango o reduce la duración.");
      return [];
    }

    // 🧮 Calcular cuántos turnos caben en el rango
    const maxTurnos = Math.floor(rangoDisponible / duracionTurnoTotal);

    // ✅ Si solo cabe uno, no hay solape
    if (maxTurnos <= 1 || es247) {
      return generarTurnosDinamicos(horarioAbierto, finReal, duracionTurnoTotal, 0, es247);
    }

    // 🔧 Ajustar solape para encajar la mayor cantidad posible sin pasarse
    const solapeCalculado = ((maxTurnos * duracionTurnoTotal) - rangoDisponible) / (maxTurnos - 1);

    return generarTurnosDinamicos(horarioAbierto, finReal, duracionTurnoTotal, solapeCalculado, es247);

  }, [horarioAbierto, horarioCierre, horasEfectivasPorTurno, horasColacion]);






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


  // nueva formula para distribucion de turnos

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
      const salida = parseFloat((entrada + Ji).toFixed(2));

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




  const generarTurnos = () => {
    const resultado = [];
    const domingosContador = {};

    const horasTrabajadasPorTrabajador = {};
    const horasAsignadas = {};
    const horarioCierre = parseFloat(horarioCierreInput);
    trabajadores.forEach((t) => {
      horasTrabajadasPorTrabajador[t.nombre] = 0;
      horasAsignadas[t.nombre] = 0;
      domingosContador[t.nombre] = 0;
    });
    // disgtribucion

    const distribuciones = {};
    trabajadores.forEach((trabajador) => {
      try {
        const dist = calcularDistribucionTurnos(
          trabajador.horasDisponibles,
          diasFuncionamiento,
          t,
          horarioAbierto
        );

        // Crear listas por día
        const clasificacion = [];
        const jornadas = [];
        const entradas = [];
        const salidas = [];

        for (let i = 0; i < dias.length; i++) {
          let tipo = "libre";
          let Ji = 0;

          if (i < dist.Dl) {
            tipo = "largo";
            Ji = dist.m;
          } else if (i < dist.Dl + dist.Dch) {
            tipo = "chico";
            Ji = dist.Tch;
          }
          //ditribucion para que me de la hora necesaria
          clasificacion.push(tipo);
          jornadas.push(Ji);
          entradas.push(horarioAbierto);
          salidas.push(horarioAbierto + Ji + horasColacion);
        }

        distribuciones[trabajador.nombre] = {
          ...dist,
          clasificacion,
          jornadas,
          entradas,
          salidas
        };

      } catch (e) {
        console.warn(`Distribución inválida para ${trabajador.nombre}:`, e.message);
      }
    });

    let indiceRotacionGlobal = 0;

    for (let semana = 0; semana < semanas; semana++) {
      
      const horasTrabajadasPorTrabajador = {};
      const horasAsignadas = {};
      const semanaData = { semana: semana + 1, dias: [] };
      const horasSemanaTrabajador = {};
      trabajadores.forEach(t => {
        horasSemanaTrabajador[t.nombre] = 0;
      });

      for (let diaIndex = 0; diaIndex < dias.length; diaIndex++) {
        const fechaActual = new Date(fechaInicio);
        fechaActual.setDate(fechaInicio.getDate() + semana * 7 + diaIndex);
        const fechaISO = fechaActual.toISOString().split('T')[0];
        const diaNombre = dias[diaIndex];
        const diaData = { dia: diaNombre, fecha: fechaISO, asignaciones: [] };

        const base = trabajadores.slice(0, 4);
        const trabajadoresExtra = trabajadores.slice(4);

        const tipoDia = trabajadores[0]
          ? distribuciones[trabajadores[0].nombre]?.clasificacion[diaIndex]
          : "libre";

        const turnoLargoPrimero = ((semana * dias.length + diaIndex) % 2 === 0);
        const turnosDelDia = turnoLargoPrimero
          ? ["largo", "chico"]
          : ["chico", "largo"];




        for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
          const turnoSeleccionado = turnos[turnoIndex];
          const rotacion = [...base];



          const validarElegibilidad = (trabajador) => {
            const dist = distribuciones[trabajador.nombre];
            if (!dist) return false;

            const Ji = dist.jornadas[diaIndex];
            if (Ji === 0) return false;

            const yaAsignadoHoy = diaData.asignaciones.some(
              a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
            );
            if (yaAsignadoHoy) return false;
            if (diaNombre === "Domingo" && domingosContador[trabajador.nombre] >= 2) return false;

            const horasRestantesTotales = trabajador.horasDisponibles - horasAsignadas[trabajador.nombre];
            if (horasRestantesTotales < Ji) return false;

            // Validar descanso con días anteriores
            const fechaAnterior = new Date(fechaActual);
            fechaAnterior.setDate(fechaAnterior.getDate() - 1);
            const fechaActualObj = new Date(fechaISO);

            const turnosAnteriores = resultado
              .flatMap(s => s.dias)
              .filter(d => new Date(d.fecha) <= fechaActualObj)
              .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
              .slice(-2)
              .flatMap(dia => dia.asignaciones.filter(
                a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
              ));

            for (let asign of turnosAnteriores) {
              const turnoAnterior = turnos.find(t => t.nombre === asign.turno);
              const fechaFinAnterior = new Date(asign.fecha);
              fechaFinAnterior.setHours(turnoAnterior?.fin || 0, 0, 0, 0);

              const Ei = dist.entradas[diaIndex];
              const fechaInicioActual = new Date(fechaISO);
              fechaInicioActual.setHours(Math.floor(Ei), (Ei % 1) * 60);

              if (fechaInicioActual <= fechaFinAnterior) {
                fechaInicioActual.setDate(fechaInicioActual.getDate() + 1);
              }

              const horasDescanso = (fechaInicioActual - fechaFinAnterior) / (1000 * 60 * 60);
              if (horasDescanso < 12) return false;
            }

            return true;
          };

          const elegibleBase = rotacion.find(validarElegibilidad);
          const elegibleExtra = trabajadoresExtra.find(validarElegibilidad);

          const asignarTurno = (trabajadorElegido, turnoIndex) => {
            const dist = distribuciones[trabajadorElegido.nombre];
            if (!dist) return;

            const indexTrabajador = trabajadores.findIndex(t => t.nombre === trabajadorElegido.nombre);
            const invertir = indexTrabajador % 2 === 1; // 1, 3, 5... invertidos

            const indexReal = diaIndex;

            const tipoTurno = dist.clasificacion[indexReal];
            const Ji = dist.jornadas[indexReal];

            let Ei = horarioAbierto;
            if (invertir) {
              Ei = Math.max(horarioAbierto, horarioCierre - Ji - horasColacion);  // Inversión calculada
            }

            const Si = Ei + Ji + horasColacion;

            horasTrabajadasPorTrabajador[trabajadorElegido.nombre] += Ji;
            horasSemanaTrabajador[trabajadorElegido.nombre] += Ji;
            horasAsignadas[trabajadorElegido.nombre] += Ji;
            if (diaNombre === "Domingo") domingosContador[trabajadorElegido.nombre]++;

            diaData.asignaciones.push({
              turno: turnoSeleccionado.nombre,
              horario: `${formatearHora(Ei)}–${formatearHora(Si)}`,
              trabajadores: [trabajadorElegido],
              tipo: tipoTurno,
              duracion: Ji,
              fecha: fechaISO
            });

            console.log(`[${trabajadorElegido.nombre}] Día: ${diaNombre}, Turno: ${turnoSeleccionado.nombre}, Tipo: ${tipoTurno}, Horas: ${Ji}`);
          };



          if (elegibleBase) asignarTurno(elegibleBase);
          else if (elegibleExtra) asignarTurno(elegibleExtra);

          indiceRotacionGlobal++;
        }

        semanaData.dias.push(diaData);
      }

      resultado.push(semanaData);
    }

    return {
      resultado,
      horasTrabajadasPorTrabajador
    };
  };






  const rellenarNoCoberturaConExtras = (resultado, horasAsignadas, trabajadores, duracionTurnoTotal) => {
    for (let semana of resultado) {
      for (let dia of semana.dias) {
        for (let asignacion of dia.asignaciones) {
          if (asignacion.trabajadores.length === 0) {
            // Buscar trabajador con menos horas asignadas
            const elegible = trabajadores.find(t => {
              const horasRestantes = t.horasDisponibles - horasAsignadas[t.nombre];
              return horasRestantes >= duracionTurnoTotal;
            });

            if (elegible) {
              asignacion.trabajadores.push(elegible);
              horasAsignadas[elegible.nombre] += duracionTurnoTotal;
            }
          }
        }
      }
    }

    return { resultado, horasAsignadas };
  };





  const turnosPorDia = turnos.length;
  const diasPorSemana = dias.length;
  const totalHorasSemana = turnos.length * horasEfectivasPorTurno * diasPorSemana;
  const totalHorasDisponibles = trabajadores.reduce((total, trabajador) => total + trabajador.horasDisponibles, 0);
  //const datosTurnos = generarTurnos();//cambiar
  const duracionTurnoTotal = horasEfectivasPorTurno + horasColacion;
  const [datosTurnos, setDatosTurnos] = useState([]);
  const [horasTrabajadasPorTrabajador, setHorasTrabajadas] = useState({});
  useEffect(() => {
    if (horasColacion < 0.5) {
      alert("❗ La colación mínima debe ser de 0.5 horas (30 minutos). Ajusta el valor.");
      setHorasColacion(0.5);
      return;
    }
    const { resultado, horasTrabajadasPorTrabajador } = generarTurnos();
    const postProcesado = rellenarNoCoberturaConExtras(resultado, horasTrabajadasPorTrabajador, trabajadores, duracionTurnoTotal);
    setDatosTurnos(postProcesado.resultado);
    setHorasTrabajadas(postProcesado.horasAsignadas);
    //setDatosTurnos(resultado);
    //setHorasTrabajadas(horasTrabajadasPorTrabajador);
    setDescansosIncorrectos(validarDescansos(resultado));
    setDomingosTrabajados(contarDomingos(resultado));

  }, [trabajadores, semanas, horasEfectivasPorTurno, horasColacion, horarioAbierto, horarioCierre, fechaInicio, inicioSemana, diasFuncionamiento]);

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




  const tieneInfraccion = (nombreTrabajador, diaActual, turnoActual) => {
    return descansosIncorrectos.some(
      (d) =>
        d.trabajador === nombreTrabajador &&
        d.diaActual === diaActual &&
        d.turnoActual === turnoActual
    );
  };

  //const descansosIncorrectos = validarDescansos();//cambio
  //memo
  /*const descansosIncorrectos = useMemo(() => {
    if (!datosTurnos || datosTurnos.length === 0) return [];
    return validarDescansos(datosTurnos);
  }, [datosTurnos]);*/

  const [descansosIncorrectos, setDescansosIncorrectos] = useState([]);
  //const domingosTrabajados = contarDomingos();//cambio
  //memo
  /* const domingosTrabajados = useMemo(() => {
     if (!datosTurnos || datosTurnos.length === 0) return {};
     return contarDomingos(datosTurnos);
   }, [datosTurnos]);*/
  const [domingosTrabajados, setDomingosTrabajados] = useState({});

  const horasTurnoPresencial = horasEfectivasPorTurno + horasColacion;
  const trabajadoresMinimos = Math.ceil(totalHorasSemana / 45);
  //const cumpleHoras = totalHorasDisponibles >= totalHorasSemana;
  const [cumpleHoras, setCumpleHoras] = useState(true);
  //const cumpleCantidadTrabajadores = trabajadores.length >= trabajadoresMinimos;
  const [cumpleCantidadTrabajadores, setCumpleCantidadTrabajadores] = useState(true);
  //const cumpleDomingosLibres = Object.values(domingosTrabajados).every((domingos) => (semanas - domingos) >= 2);
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


  useEffect(() => {
    const totalHoras = turnos.length * horasEfectivasPorTurno * dias.length;
    const minTrabajadores = Math.ceil(totalHoras / 45);
    const horasDisponibles = trabajadores.reduce((acc, t) => acc + t.horasDisponibles, 0);

    const cumpleH = horasDisponibles >= totalHoras;
    const cumpleCantidad = trabajadores.length >= minTrabajadores;

    const domingosContados = contarDomingos(datosTurnos);
    const cumpleDomingos = Object.values(domingosContados).every((dom) => (semanas - dom) >= 2);


    setCumpleHoras(cumpleH);
    setCumpleCantidadTrabajadores(cumpleCantidad);
    setCumpleDomingosLibres(cumpleDomingos);

    const violaciones = validarDiasSeguidos(datosTurnos);
    setViolacionesDiasSeguidos(violaciones);
  }, [datosTurnos, trabajadores, turnos, dias.length, horasEfectivasPorTurno, horasColacion, semanas]);




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
          <label>Horas efectivas por turno:</label>
          <input
            type="number"
            value={horasEfectivasPorTurno}
            onChange={(e) => setHorasEfectivasPorTurno(Number(e.target.value))}
          />
        </div>

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
          <label>Horario de atención:</label>
          <input
            type="number"
            step="0.1"
            value={horarioAbiertoInput}
            onChange={(e) => setHorarioAbiertoInput(Number(e.target.value))}
          />
          <input
            type="number"
            step="0.1"
            value={horarioCierreInput}
            onChange={(e) => setHorarioCierreInput(Number(e.target.value))}
          />
          <button className="primary-button" onClick={() => {
            setHorarioAbierto(horarioAbiertoInput);
            setHorarioCierre(horarioCierreInput);
          }}>
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
            <li>Horas necesarias 24/7: {totalHorasSemana} horas</li>
            <li>Horas efectivas por turno: {horasEfectivasPorTurno} horas</li>
            <li>Horas presenciales por turno: {horasTurnoPresencial} horas</li>
          </ul>
        </div>

        <div className="card">
          <h2>Validaciones Legales</h2>
          {!cumpleHoras && <p className="alert">⚠️ No se cumplen las horas mínimas.</p>}
          {!cumpleDomingosLibres && <p className="alert">⚠️ No todos los trabajadores tienen 2 domingos libres.</p>}
          {!cumpleCantidadTrabajadores && <p className="alert">⚠️ Se recomienda mínimo {trabajadoresMinimos} trabajadores.</p>}
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
                    {turnos.map((turno) => (
                      <th key={turno.nombre}>{turno.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {semana.dias.map((diaData, idx) => (
                    <tr key={idx}>
                      <td>
                        {diaData.dia} <br />
                        <small>{diaData.fecha}</small>
                      </td>
                      {turnos.map((turno, index) => {
                        const asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
                        const trabajadoresAsignados = asignacion?.trabajadores || [];
                        const nombresTrabajadores = trabajadoresAsignados.map(t => t.nombre).join(", ");

                        const esInfraccion = trabajadoresAsignados.some((t) =>
                          descansosIncorrectos.some((d) =>
                            d.trabajador === t.nombre &&
                            (
                              (d.fechaActual === diaData.fecha && d.turnoActual === turno.nombre) ||
                              (d.fechaSiguiente === diaData.fecha && d.turnoSiguiente === turno.nombre)
                            )
                          )
                        );

                        return (
                          <td key={index} className={esInfraccion ? 'infraccion-turno' : ''}>
                            {Array.from({ length: Math.max(trabajadoresAsignados.length, 2) }).map((_, i) => (
                              <div key={i} style={{ marginBottom: '4px' }}>
                                <select
                                  value={trabajadoresAsignados[i]?.nombre || ''}
                                  onChange={(e) =>
                                    handleCambioTrabajador(e.target.value, semana.semana, diaData.fecha, turno.nombre, i)
                                  }
                                >
                                  <option value="">❌ No cobertura</option>
                                  {trabajadores.map((trab) => (
                                    <option key={trab.nombre} value={trab.nombre}>
                                      {trab.nombre}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}

                            <div style={{ fontSize: '0.85em', marginTop: '4px' }}>
                              {nombresTrabajadores}
                            </div>

                            <br />
                            <small>{asignacion?.horario || `${formatearHora(turno.inicio)}–${formatearHora(turno.fin)}`}</small>

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
 }, [horarioAbierto, horarioCierre]);*/