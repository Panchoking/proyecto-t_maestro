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

  const generarTurnosDinamicos = (inicio, fin, duracionTurno, solape = 0) => {
    const turnos = [];
    let actual = inicio;
    let index = 1;

    // Asegura que el límite sea al menos 24 si fin < inicio
    const limite = fin > inicio ? fin : fin + 24;

    while (actual < limite) {
      const inicioTurno = actual;
      let finTurno = actual + duracionTurno;

      // No cortar turno si es 24/7
      /*if (finTurno > limite && horarioAbierto !== horarioCierre) {
         finTurno = limite;
       }*/

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
    }

    return turnos;
  };




  const turnos = useMemo(() => {
    let solape = 0;

    const duracionTurnoTotal = horasEfectivasPorTurno + horasColacion;

    if ((24 % duracionTurnoTotal) !== 0) {
      solape = 1;
    }

    if (horarioAbierto === horarioCierre) {
      return generarTurnosDinamicos(horarioAbierto, horarioAbierto + 24, duracionTurnoTotal, solape);
    }

    const finReal = horarioCierre > horarioAbierto
      ? horarioCierre
      : horarioCierre + 24;

    return generarTurnosDinamicos(horarioAbierto, finReal, duracionTurnoTotal, solape);
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


    // Inicializar contador de domingos
    trabajadores.forEach((trabajador) => {
      domingosContador[trabajador.nombre] = 0;
    });
    const horasTrabajadasPorTrabajador = {};
    trabajadores.forEach((t) => {
      horasTrabajadasPorTrabajador[t.nombre] = 0;
    });

    let indiceRotacion = 0; // rotación global
    const horasAsignadas = {};
    for (let semana = 0; semana < semanas; semana++) {
      const semanaData = { semana: semana + 1, dias: [] };
      indiceRotacion = semana % trabajadores.length;

      for (let diaIndex = 0; diaIndex < dias.length; diaIndex++) {
        const fechaActual = new Date(fechaInicio);
        fechaActual.setDate(fechaInicio.getDate() + semana * 7 + diaIndex);
        const fechaISO = fechaActual.toISOString().split('T')[0];
        const diaNombre = dias[diaIndex];
        const diaData = { dia: diaNombre, fecha: fechaISO, asignaciones: [] };

        for (let turnoIndex = 0; turnoIndex < turnos.length; turnoIndex++) {
          const turnoSeleccionado = turnos[turnoIndex];

          // Obtener lista circular rotada
          const trabajadorOrdenado = [];
          for (let offset = 0; offset < trabajadores.length; offset++) {
            const index = (indiceRotacion + offset) % trabajadores.length;
            trabajadorOrdenado.push(trabajadores[index]);
          }


          const trabajadorElegible = trabajadorOrdenado.find((trabajador) => {
            console.log(' Evaluando trabajador:', {
              nombre: trabajador.nombre,
              horasDisponibles: trabajador.horasDisponibles,
              horasAsignadas: horasAsignadas[trabajador.nombre],
              domingosTrabajados: domingosContador[trabajador.nombre],
              dia: diaNombre,
              fecha: fechaISO,
            });


            const yaAsignadoHoy = diaData.asignaciones.some(a => a.trabajador?.nombre === trabajador.nombre);
            if (yaAsignadoHoy) return false;

            const puedeDomingo = !(diaNombre === "Domingo" && domingosContador[trabajador.nombre] >= 2);
            if (!puedeDomingo) return false;

            const horasPendientes = trabajador.horasDisponibles - horasAsignadas[trabajador.nombre];
            if (horasPendientes < duracionTurnoTotal) return false;

            // Validar descanso de al menos 12 horas
            const fechaAnterior = new Date(fechaActual);
            fechaAnterior.setDate(fechaAnterior.getDate() - 1);
            const fechaAnteriorISO = fechaAnterior.toISOString().split('T')[0];
            const fechaActualObj = new Date(fechaISO);


            const turnosAnteriores = resultado
              .flatMap(s => s.dias)
              .filter(d => {
                const fechaD = new Date(d.fecha);
                return fechaD <= fechaActualObj; //  solo días anteriores o el mismo
              })
              .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)) //  ordenar cronológicamente
              .slice(-2) //  solo los últimos 2 días previos (opcional, para optimizar)
              .flatMap(dia => dia.asignaciones.filter(
                a => a.trabajador?.nombre === trabajador.nombre
              ))

            for (let asign of turnosAnteriores) {
              const turnoAnterior = turnos.find(t => t.nombre === asign.turno);
              const turnoActual = turnoSeleccionado;


              const fechaFinAnterior = new Date(asign.fecha); // ← Asegúrate de tener 'fecha' en la asignación
              fechaFinAnterior.setHours(turnoAnterior.fin, 0, 0, 0);

              const fechaInicioActual = new Date(fechaISO);
              fechaInicioActual.setHours(turnoActual.inicio, 0, 0, 0);

              if (fechaInicioActual <= fechaFinAnterior) {
                fechaInicioActual.setDate(fechaInicioActual.getDate() + 1);
              }


              const horasDescanso = (fechaInicioActual - fechaFinAnterior) / (1000 * 60 * 60);
              console.log('🔻 Descanso entre turnos:', {
                trabajador: trabajador.nombre,
                fechaTurnoAnterior: asign.fecha,
                turnoAnterior: turnoAnterior.nombre,
                finAnterior: formatearHora(turnoAnterior.fin),
                turnoActual: turnoActual.nombre,
                inicioActual: formatearHora(turnoActual.inicio),
                horasDescanso
              });
              if (horasDescanso < 12) return false;
            }


            return true;
          });

          if (trabajadorElegible) {
            diaData.asignaciones.push({
              turno: turnoSeleccionado.nombre,
              horario: `${formatearHora(turnoSeleccionado.inicio)}–${formatearHora(turnoSeleccionado.fin)}`,
              trabajador: trabajadorElegible
            });
            console.log('✅ Asignado:', {
              trabajador: trabajadorElegible.nombre,
              fecha: fechaISO,
              turno: turnoSeleccionado.nombre,
              horasAcumuladas: horasAsignadas[trabajadorElegible.nombre],
            });
            horasTrabajadasPorTrabajador[trabajadorElegible.nombre] += duracionTurnoTotal;

            if (diaNombre === "Domingo") {
              domingosContador[trabajadorElegible.nombre]++;
            }

            horasAsignadas[trabajadorElegible.nombre] += duracionTurnoTotal;

            indiceRotacion = (indiceRotacion + 1) % trabajadores.length;
          } else {
            diaData.asignaciones.push({
              turno: turnoSeleccionado.nombre,
              horario: `${formatearHora(turnoSeleccionado.inicio)}–${formatearHora(turnoSeleccionado.fin)}`,
              trabajador: { nombre: '❌ No cobertura' }

            });
            console.log('❌ No cobertura en:', {
              fecha: fechaISO,
              turno: turnoSeleccionado.nombre,
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





  const turnosPorDia = turnos.length;
  const diasPorSemana = dias.length;
  const totalHorasSemana = turnos.length * horasEfectivasPorTurno * diasPorSemana;
  const totalHorasDisponibles = trabajadores.reduce((total, trabajador) => total + trabajador.horasDisponibles, 0);
  //const datosTurnos = generarTurnos();//cambiar
  const [datosTurnos, setDatosTurnos] = useState([]);
  const [horasTrabajadasPorTrabajador, setHorasTrabajadas] = useState({});
  useEffect(() => {
    if (horasColacion < 0.5) {
      alert("❗ La colación mínima debe ser de 0.5 horas (30 minutos). Ajusta el valor.");
      setHorasColacion(0.5);
      return;
    }
    const { resultado, horasTrabajadasPorTrabajador } = generarTurnos();
    setDatosTurnos(resultado);
    setHorasTrabajadas(horasTrabajadasPorTrabajador);
  }, [trabajadores, semanas, horasEfectivasPorTurno, horasColacion, horarioAbierto, horarioCierre, fechaInicio,inicioSemana,diasFuncionamiento]);

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
        const nombre = asignacion.trabajador?.nombre;
        if (nombre && contador[nombre] !== undefined) {
          contador[nombre]++;
        }
      });
    });

    return contador;
  };


  const validarDescansos = (datosTurnos) => {
    const descansosIncorrectos = [];

    trabajadores.forEach((trabajador) => {
      for (let s = 0; s < datosTurnos.length; s++) {
        const semana = datosTurnos[s];

        if (semana.dias.length < 2) continue; 
        for (let d = 0; d < semana.dias.length - 1; d++) {
          const diaHoy = semana.dias[d];
          const diaManiana = semana.dias[d + 1];

          const fechaHoy = new Date(diaHoy.fecha);
          const fechaManiana = new Date(diaManiana.fecha);

          // Confirmar que el día siguiente es posterior al actual
          if (fechaManiana <= fechaHoy) continue;

          // Buscar turnos del trabajador en ambos días
          const asignacionesHoy = diaHoy.asignaciones.filter(
            (a) => a.trabajador?.nombre === trabajador.nombre
          );
          const asignacionesManiana = diaManiana.asignaciones.filter(
            (a) => a.trabajador?.nombre === trabajador.nombre
          );

          // Comparar cada turno de hoy con cada turno de mañana
          for (const asignacionHoy of asignacionesHoy) {
            const turnoHoy = turnos.find((t) => t.nombre === asignacionHoy.turno);
            for (const asignacionManiana of asignacionesManiana) {
              const turnoManiana = turnos.find((t) => t.nombre === asignacionManiana.turno);
              const finHoy = new Date(`${diaHoy.fecha}T${formato24(turnoHoy.fin)}`);
              const inicioManiana = new Date(`${diaManiana.fecha}T${formato24(turnoManiana.inicio)}`);

              // Si por algún motivo la hora de inicio es antes de fin (casos límite), ajustamos
              if (inicioManiana <= finHoy) {
                inicioManiana.setDate(inicioManiana.getDate() + 1);
              }

              const descanso = (inicioManiana - finHoy) / (1000 * 60 * 60); // en horas

              if (descanso < 12) {
                descansosIncorrectos.push({
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
                });
              }
            }
          }
        }
      }
    });

    return descansosIncorrectos;
  };




  const tieneInfraccion = (nombreTrabajador, diaActual, turnoActual) => {
    return descansosIncorrectos.some(
      (d) =>
        d.trabajador === nombreTrabajador &&
        d.diaActual === diaActual &&
        d.turnoActual === turnoActual
    );
  };

  //const descansosIncorrectos = validarDescansos();//cambio

  const descansosIncorrectos = useMemo(() => {
    if (!datosTurnos || datosTurnos.length === 0) return [];
    return validarDescansos(datosTurnos);
  }, [datosTurnos]);


  //const domingosTrabajados = contarDomingos();//cambio
  const domingosTrabajados = useMemo(() => {
    if (!datosTurnos || datosTurnos.length === 0) return {};
    return contarDomingos(datosTurnos);
  }, [datosTurnos]);

  const horasTurnoPresencial = horasEfectivasPorTurno + horasColacion;
  const trabajadoresMinimos = Math.ceil(totalHorasSemana / 45);
  const cumpleHoras = totalHorasDisponibles >= totalHorasSemana;
  const cumpleCantidadTrabajadores = trabajadores.length >= trabajadoresMinimos;
  const cumpleDomingosLibres = Object.values(domingosTrabajados).every((domingos) => (semanas - domingos) >= 2);



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



        </div>
        {descansosIncorrectos.length > 0 && (
          <>
            <h3>Violaciones de descanso entre turnos:</h3>
            <ul>
              {descansosIncorrectos.map((descanso, idx) => (
                <li key={idx} style={{ color: 'red', marginBottom: '5px' }}>
                  ⚠️ {descanso.trabajador} trabajó el {descanso.diaActual} {descanso.fechaActual} ({descanso.turnoActual} {descanso.horarioActual}) y luego el {descanso.diaSiguiente} {descanso.fechaSiguiente} ({descanso.turnoSiguiente} {descanso.horarioSiguiente}), con solo {descanso.descanso} horas de descanso (mínimo legal 12h).
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
                        const nombreTrabajador = asignacion?.trabajador?.nombre;
                        const esInfraccion = nombreTrabajador && tieneInfraccion(nombreTrabajador, diaData.dia, turno.nombre);

                        return (
                          <td key={index} className={esInfraccion ? 'infraccion-turno' : ''}>
                            <strong>
                              {esInfraccion ? '⚠️ ' : ''}
                              {nombreTrabajador || '❌ No cobertura'}
                            </strong><br />
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