import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './TurnoRotativos.css';

const TurnoRotativos = () => {
  const [trabajadores, setTrabajadores] = useState([]);
  const [nuevoTrabajador, setNuevoTrabajador] = useState('');
  const [tipoContrato, setTipoContrato] = useState('Completo');
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
    const horas = Math.floor(decimal % 24);
    const minutos = Math.round((decimal % 1) * 60);

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
    if (nuevoTrabajador.trim() !== '') {
      let horas = 45;
      if (tipoContrato === 'Parcial') horas = 30;
      if (tipoContrato === 'Flexible') horas = 20;

      setTrabajadores([...trabajadores, {
        nombre: nuevoTrabajador.trim(),
        tipoContrato,
        horasDisponibles: horas
      }]);
      setNuevoTrabajador('');
    }
  };

  const eliminarTrabajador = (index) => {
    const nuevos = [...trabajadores];
    nuevos.splice(index, 1);
    setTrabajadores(nuevos);
  };

  const generarTurnos = () => {
    const resultado = [];
    const domingosContador = {};
    const duracionTurnoTotal = horasEfectivasPorTurno + horasColacion;

    // Inicializar contadores globales
    const horasTrabajadasPorTrabajador = {};
    const horasAsignadas = {};
    trabajadores.forEach((t) => {
      horasTrabajadasPorTrabajador[t.nombre] = 0;
      horasAsignadas[t.nombre] = 0;
      domingosContador[t.nombre] = 0;
    });

    let indiceRotacion = 0;

    for (let semana = 0; semana < semanas; semana++) {
      const semanaData = { semana: semana + 1, dias: [] };
      indiceRotacion = semana % trabajadores.length;

      // Inicializar contador semanal
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

        for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
          const turnoSeleccionado = turnos[turnoIndex];

          // Mantener rotación pero filtrar elegibles por semana
          const trabajadorOrdenado = [];
          for (let offset = 0; offset < trabajadores.length; offset++) {
            const index = (indiceRotacion + offset) % trabajadores.length;
            trabajadorOrdenado.push(trabajadores[index]);
          }

          const trabajadorElegible = trabajadorOrdenado.find((trabajador) => {
            const yaAsignadoHoy = diaData.asignaciones.some(
              a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
            );
            
            if (yaAsignadoHoy) return false;

            if (diaNombre === "Domingo" && domingosContador[trabajador.nombre] >= 2) return false;

            const horasPendientesSemana = trabajador.horasDisponibles - horasSemanaTrabajador[trabajador.nombre];
            if (horasPendientesSemana < duracionTurnoTotal) return false;

            // Validar descanso de al menos 12 horas
            const fechaAnterior = new Date(fechaActual);
            fechaAnterior.setDate(fechaAnterior.getDate() - 1);
            const fechaActualObj = new Date(fechaISO);
            const turnosAnteriores = resultado
              .flatMap(s => s.dias)
              .filter(d => {
                const fechaD = new Date(d.fecha);
                return fechaD <= fechaActualObj;
              })
              .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
              .slice(-2)
              .flatMap(dia => dia.asignaciones.filter(
                a => a.trabajadores.some(t => t.nombre === trabajador.nombre)
              ));

            for (let asign of turnosAnteriores) {
              const turnoAnterior = turnos.find(t => t.nombre === asign.turno);
              const fechaFinAnterior = new Date(asign.fecha);
              fechaFinAnterior.setHours(turnoAnterior.fin, 0, 0, 0);

              const fechaInicioActual = new Date(fechaISO);
              fechaInicioActual.setHours(turnoSeleccionado.inicio, 0, 0, 0);
              if (fechaInicioActual <= fechaFinAnterior) {
                fechaInicioActual.setDate(fechaInicioActual.getDate() + 1);
              }

              const horasDescanso = (fechaInicioActual - fechaFinAnterior) / (1000 * 60 * 60);
              if (horasDescanso < 12) return false;
            }

            return true;
          });

          if (trabajadorElegible) {
            diaData.asignaciones.push({
              turno: turnoSeleccionado.nombre,
              horario: `${formatearHora(turnoSeleccionado.inicio)}–${formatearHora(turnoSeleccionado.fin)}`,
              trabajadores: [trabajadorElegible],
              fecha: fechaISO
            });

            horasTrabajadasPorTrabajador[trabajadorElegible.nombre] += duracionTurnoTotal;
            horasSemanaTrabajador[trabajadorElegible.nombre] += duracionTurnoTotal;
            horasAsignadas[trabajadorElegible.nombre] += duracionTurnoTotal;

            if (diaNombre === "Domingo") {
              domingosContador[trabajadorElegible.nombre]++;
            }

            indiceRotacion = (indiceRotacion + 1) % trabajadores.length;

          } else {
            diaData.asignaciones.push({
              turno: turnoSeleccionado.nombre,
              horario: `${formatearHora(turnoSeleccionado.inicio)}–${formatearHora(turnoSeleccionado.fin)}`,
              trabajadores: [],
              fecha: fechaISO
            });
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
    setDatosTurnos(resultado);
    setHorasTrabajadas(horasTrabajadasPorTrabajador);
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
  const handleCambioTrabajador = (nuevoNombre, semanaNum, fecha, turnoNombre) => {
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

              // Si ya existe el trabajador en la lista, no lo agregues de nuevo
              const yaExiste = asig.trabajadores.some(t => t.nombre === nuevoNombre);
              const nuevosTrabajadores = nuevoNombre
                ? yaExiste
                  ? asig.trabajadores // no hacer nada si ya existe
                  : [{ nombre: nuevoNombre }, ...asig.trabajadores.slice(1)] // reemplaza solo el primero
                : [];

              return {
                ...asig,
                trabajadores: nuevosTrabajadores
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
        <h1 className="title">Parámetros</h1>

        {/* Agregar/Eliminar Trabajadores */}
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
          <button onClick={agregarTrabajador}>Agregar</button>
        </div>

        {trabajadores.length > 0 && (
          <div className="worker-list">
            <ul>
              {trabajadores.map((trabajador, index) => (
                <li key={index}>
                  {trabajador.nombre} - {trabajador.tipoContrato} ({trabajador.horasDisponibles}h)
                  <button onClick={() => eliminarTrabajador(index)} style={{ marginLeft: '10px', color: 'red' }}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Parámetros Configurables */}
        <div className="input-group">
          <label>Horas efectivas por turno:</label>
          <input
            type="number"
            step="any"
            value={horasEfectivasPorTurno}
            onChange={(e) => setHorasEfectivasPorTurno(Number(e.target.value))}
          />
        </div>

        <div className="input-group">
          <label>Horas de colación:</label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            value={horasColacion}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 0.5) {
                setHorasColacion(value);
              } else {
                alert("La colación debe ser de al menos 0.5 horas (30 minutos)");
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

        <input
          type="number"
          min="0"
          max="23"
          value={horarioAbiertoInput}
          onChange={(e) => setHorarioAbiertoInput(Number(e.target.value))}
        />
        <input
          type="number"
          min="0"
          max="31"
          value={horarioCierreInput}
          onChange={(e) => setHorarioCierreInput(Number(e.target.value))}
        />

        <button
          className="apply-button"
          onClick={() => {
            setHorarioAbierto(horarioAbiertoInput);
            setHorarioCierre(horarioCierreInput);
          }}
        >
          Aplicar horario de atención
        </button>
        {turnos.length === 0 && (
          <p style={{ color: 'red' }}>⚠️ El rango de horario no permite generar al menos un turno completo.</p>
        )}





        <button onClick={exportarExcel} className="export-button">Exportar Excel</button>

        {/* Variables y Cumplimientos */}
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
          {!cumpleHoras && (
            <p className="alert">
              ⚠️ No se cumplen las horas mínimas de cobertura 24/7 (168h/semana). Art. 22 Código del Trabajo.
            </p>
          )}
          {!cumpleDomingosLibres && (
            <p className="alert">
              ⚠️ No todos los trabajadores tienen 2 domingos libres. Art. 38 Código del Trabajo.
            </p>
          )}
          {!cumpleCantidadTrabajadores && (
            <p className="alert">
              ⚠️ Insuficiencia de trabajadores para turnos rotativos 24/7. Se recomienda mínimo {trabajadoresMinimos} trabajadores.
            </p>
          )}
          {trabajadores.length === 1 && (
            <p className="alert">
              ⚠️ Solo un trabajador asignado: no es legalmente viable cubrir todos los turnos 24/7.
            </p>
          )}
          {cumpleHoras && cumpleDomingosLibres && cumpleCantidadTrabajadores && trabajadores.length > 1 && (
            <p className="success">
              ✅ Todos los requisitos legales están cumplidos.
            </p>
          )}
          {violacionesDiasSeguidos.length > 0 && (
            <div className="alert">
              <h3>🚨 Días seguidos sin descanso detectados:</h3>
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
          <>
            <h3>Violaciones de descanso entre turnos:</h3>
            <ul>
              {descansosIncorrectos.map((descanso, idx) => (
                <li key={idx} style={{ color: 'red', marginBottom: '5px' }}>
                  ⚠️ {descanso.trabajador} trabajó el {descanso.diaActual} {descanso.fechaActual}
                  ({descanso.turnoActual} {descanso.horarioActual}) y luego el {descanso.diaSiguiente} {descanso.fechaSiguiente}
                  ({descanso.turnoSiguiente} {descanso.horarioSiguiente}), con solo <strong>
                    {Math.max(0, descanso.descanso.toFixed(1))}</strong> horas de descanso (mínimo legal 12h).
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="card">
          <h2>Domingos Libres</h2>
          <ul>
            {Object.entries(domingosTrabajados).map(([nombre, domingos]) => {
              const domingosLibres = semanas - domingos;
              return (
                <li key={nombre}>
                  {nombre}: {domingosLibres} domingos libres {domingosLibres >= 2 ? "✅" : "⚠️"}
                </li>
              );
            })}
          </ul>
          <h3>Horas trabajadas</h3>
          <ul>
            {Object.entries(horasTrabajadasPorTrabajador).map(([nombre, horas]) => (
              <li key={nombre}>
                {nombre}: {horas} horas
              </li>
            ))}
          </ul>
        </div>
        <div className="input-group">
          <label>
            Día de inicio de semana:
            <select value={inicioSemana} onChange={(e) => setInicioSemana(e.target.value)}>
              {diasSemana.map((dia) => (
                <option key={dia} value={dia}>{dia}</option>
              ))}
            </select>
          </label>

          <label>
            Días de funcionamiento:
            <input
              type="number"
              min="1"
              max="7"
              value={diasFuncionamiento}
              onChange={(e) => setDiasFuncionamiento(Number(e.target.value))}
            />

          </label>

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

                        // Verifica si alguno de los trabajadores tiene infracción
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
                            <select
                              value={trabajadoresAsignados[0]?.nombre || ''}
                              onChange={(e) =>
                                handleCambioTrabajador(e.target.value, semana.semana, diaData.fecha, turno.nombre)
                              }
                            >
                              <option value="">❌ No cobertura</option>
                              {trabajadores.map((trab) => (
                                <option key={trab.nombre} value={trab.nombre}>
                                  {trab.nombre}
                                </option>
                              ))}
                            </select>
                            <div style={{ fontSize: '0.85em', marginTop: '4px' }}>
                              {nombresTrabajadores}
                            </div>

                            {/* Mostrar los nombres de todos los asignados */}
                            {trabajadoresAsignados.length > 1 && (
                              <div style={{ marginTop: '4px', fontSize: '0.85em' }}>
                                + {trabajadoresAsignados.slice(1).map(t => t.nombre).join(", ")}
                              </div>
                            )}

                            <br />
                            <small>
                              {turno.nombre} ({formatearHora(turno.inicio)}–{formatearHora(turno.fin)})
                            </small>
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