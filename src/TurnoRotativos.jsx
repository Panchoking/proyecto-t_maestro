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
    const inicioIndex = diasSemana.indexOf(inicioSemana);
    const diasRotados = [...diasSemana.slice(inicioIndex), ...diasSemana.slice(0, inicioIndex)];
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

  const generarTurnos = () => {
    const resultado = [];
    const domingosContador = {};
    const horasTrabajadasPorTrabajador = {};
    const horasAsignadas = {};

    trabajadores.forEach((t) => {
      horasTrabajadasPorTrabajador[t.nombre] = 0;
      horasAsignadas[t.nombre] = 0;
      domingosContador[t.nombre] = 0;
    });

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

    for (let semana = 0; semana < semanas; semana++) {
      const semanaData = { semana: semana + 1, dias: [] };
      const horasSemanaTrabajador = {};
      trabajadores.forEach(t => {
        horasSemanaTrabajador[t.nombre] = 0;
      });

      for (let diaIndex = 0; diaIndex < dias.length; diaIndex++) {
        const fechaActual = new Date(fechaInicio);
        fechaActual.setDate(fechaInicio.getDate() + semana * dias.length + diaIndex);
        const fechaISO = fechaActual.toISOString().split('T')[0];
        const diaNombre = dias[diaIndex];
        const diaData = { dia: diaNombre, fecha: fechaISO, asignaciones: [] };

        // VALIDACIÓN ELEGIBILIDAD CON DESCANSO
        const validarElegibilidad = (trabajador, turno) => {
          const dist = distribuciones[trabajador.nombre];
          if (!dist) return false;

          const Ji = dist.jornadas[diaIndex];
          if (Ji === 0) return false;

          const yaAsignadoHoy = diaData.asignaciones.some(
            a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
          );
          if (yaAsignadoHoy) return false;

          if (diaNombre === "Domingo" && domingosContador[trabajador.nombre] >= 2) return false;

          const horasRestantesSemana = trabajador.horasDisponibles - horasSemanaTrabajador[trabajador.nombre];
          if (horasRestantesSemana < Ji) return false;

          // Validar descanso
          const Ei = turno.inicio;
          const fechaTurno = new Date(fechaISO);
          fechaTurno.setHours(Math.floor(Ei), (Ei % 1) * 60, 0, 0);

          const turnosAnteriores = resultado
            .flatMap(s => s.dias)
            .filter(d => new Date(d.fecha) <= fechaTurno)
            .flatMap(dia =>
              dia.asignaciones.filter(
                a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
              ).map(a => {
                const turnoPrev = turnos.find(t => t.nombre === a.turno);
                const fin = turnoPrev?.fin || 0;
                const inicio = turnoPrev?.inicio || 0;
                const fechaFin = new Date(dia.fecha);
                fechaFin.setHours(Math.floor(fin), (fin % 1) * 60, 0, 0);
                if (fin < inicio) {
                  fechaFin.setDate(fechaFin.getDate() + 1); // turno que cruza de día
                }
                return {
                  horaFin: fechaFin
                };
              })
            )
            .sort((a, b) => b.horaFin - a.horaFin)
            .slice(0, 2);

          for (let asign of turnosAnteriores) {
            const horasDescanso = (fechaTurno - asign.horaFin) / (1000 * 60 * 60);
            if (horasDescanso < 12) return false;
          }

          return true;
        };

        for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
          const turno = turnos[turnoIndex];

          const elegible = trabajadores.find(t => validarElegibilidad(t, turno));
          if (elegible) {
            const dist = distribuciones[elegible.nombre];
            const Ji = dist.jornadas[diaIndex]; // usa la jornada real (no 9h fija)
            const Ei = turno.inicio;
            const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2)); // entrada + jornada + colación

            horasTrabajadasPorTrabajador[elegible.nombre] += Ji;
            horasSemanaTrabajador[elegible.nombre] += Ji;
            horasAsignadas[elegible.nombre] += Ji;
            if (diaNombre === "Domingo") domingosContador[elegible.nombre]++;

            let asignacion = diaData.asignaciones.find(a => a.turno === turno.nombre);
            if (!asignacion) {
              asignacion = {
                turno: turno.nombre,
                horario: `${formatearHora(Ei)}–${formatearHora(Si)}`,
                trabajadores: [],
                tipo: dist.clasificacion[diaIndex],
                duracion: Ji,
                fecha: fechaISO
              };
              diaData.asignaciones.push(asignacion);
            }

            asignacion.trabajadores.push(elegible);

          }
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

          // Mientras no se llene el segundo slot
          while (asignacion.trabajadores.length < 2) {
            const elegible = trabajadores.find(t => {
              const horasRestantes = t.horasDisponibles - (horasAsignadas[t.nombre] || 0);

              if (horasRestantes < duracionTurnoTotal) return false;

              // Evitar duplicado
              if (asignacion.trabajadores.some(trab => trab.nombre === t.nombre)) return false;

              return true;
            });

            if (elegible) {
              asignacion.trabajadores.push(elegible);
              horasAsignadas[elegible.nombre] = (horasAsignadas[elegible.nombre] || 0) + duracionTurnoTotal;
            } else {
              break; // No hay más elegibles
            }
          }

        }
      }
    }

    return { resultado, horasAsignadas };
  };






  // ✅ Suma las jornadas reales directamente:
  const totalHorasSemana = datosTurnos.reduce((semAcc, sem) =>
    semAcc + sem.dias.reduce((diaAcc, dia) =>
      diaAcc + dia.asignaciones.reduce((asigAcc, asig) =>
        asigAcc + asig.duracion * asig.trabajadores.length, 0)
      , 0)
    , 0);
  const totalHorasDisponibles = trabajadores.reduce((total, trabajador) => total + trabajador.horasDisponibles, 0);
  //const datosTurnos = generarTurnos();//cambiar


  const [horasTrabajadasPorTrabajador, setHorasTrabajadas] = useState({});
  useEffect(() => {
    if (horasColacion < 0.5) {
      alert("❗ La colación mínima debe ser de 0.5 horas (30 minutos). Ajusta el valor.");
      setHorasColacion(0.5);
      return;
    }
    const { resultado, horasTrabajadasPorTrabajador } = generarTurnos();
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
      mEjemplo
    );
    setDatosTurnos(postProcesado.resultado);
    setHorasTrabajadas(postProcesado.horasAsignadas);

    setDescansosIncorrectos(validarDescansos(resultado));
    setDomingosTrabajados(contarDomingos(resultado));

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

  const trabajadoresMinimos = Math.ceil(totalHorasSemana / 45);

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


  useEffect(() => {
    const totalHoras = totalHorasSemana;
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
            <li>Horas necesarias 24/7: {totalHorasSemana} horas</li>
            <li>Duración turno largo (incluye colación): {trabajadores[0] && calcularDistribucionTurnos(trabajadores[0].horasDisponibles, diasFuncionamiento, t, horarioAbierto).J_l} h</li>
            <li>Duración turno chico (incluye colación): {trabajadores[0] && calcularDistribucionTurnos(trabajadores[0].horasDisponibles, diasFuncionamiento, t, horarioAbierto).J_ch} h</li>

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


 
 */