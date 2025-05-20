import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import '../styles/TurnoRotativos.css';

// Importación de utilidades y lógica
import { formatearHora } from '../utils/tiempo';
import { calcularDistribucionTurnos } from '../utils/distribucion';
import { generarTurnos, rellenarNoCoberturaConExtras } from '../logic/generarturnos';
import { contarDomingos, validarDescansos, validarDiasSeguidos } from '../logic/validaciones';

// Importar componente de vista de ciclo
import VistaCiclo from './VistaCiclo.jsx';

/**
 * Componente principal para gestionar turnos rotativos
 */
const TurnoRotativos = () => {
    // Estados para parámetros del componente
    const [trabajadores, setTrabajadores] = useState([]);
    const [nuevoTrabajador, setNuevoTrabajador] = useState('');
    const [tipoContrato, setTipoContrato] = useState('Completo');
    const [horasContrato, setHorasContrato] = useState(45);
    const [t, setT] = useState(0.5);
    const [semanas] = useState(4);
    const [fechaInicio, setFechaInicio] = useState(() => {
        const hoy = new Date();
        hoy.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // Lunes anterior
        return hoy;
    });

    // Estados para horarios
    const [horarioAbierto, setHorarioAbierto] = useState(0);
    const [horarioCierre, setHorarioCierre] = useState(24);
    const [horarioAbiertoInput, setHorarioAbiertoInput] = useState(0);
    const [horarioCierreInput, setHorarioCierreInput] = useState(24);
    const [horasEfectivasPorTurno] = useState(8);
    const [horasColacion, setHorasColacion] = useState(1);

    // Configuración de días
    const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const [inicioSemana, setInicioSemana] = useState('Lunes');
    const [diasFuncionamiento, setDiasFuncionamiento] = useState(7);

    // Estados para almacenar resultados
    const [datosTurnos, setDatosTurnos] = useState([]);
    const [horasTrabajadasPorTrabajador, setHorasTrabajadas] = useState({});
    const [descansosIncorrectos, setDescansosIncorrectos] = useState([]);
    const [domingosTrabajados, setDomingosTrabajados] = useState({});
    const [violacionesDiasSeguidos, setViolacionesDiasSeguidos] = useState([]);

    // Estados para validaciones
    const [cumpleHoras, setCumpleHoras] = useState(true);
    const [cumpleCantidadTrabajadores, setCumpleCantidadTrabajadores] = useState(true);
    const [cumpleDomingosLibres, setCumpleDomingosLibres] = useState(true);
    const [trabajadoresMinimos, setTrabajadoresMinimos] = useState(0);
    const [minPorHoras, setMinPorHoras] = useState(0);
    const [minPorDias, setMinPorDias] = useState(0);
    const [minPorDomingos, setMinPorDomingos] = useState(0);
    const [razonMinTrabajadores, setRazonMinTrabajadores] = useState("");
    
    // Estado para controlar la visualización activa
    const [vistaActiva, setVistaActiva] = useState('semanal'); // 'semanal' o 'ciclo'

    // Calcular días de la semana según el inicio configurado
    const dias = useMemo(() => {
        const index = diasSemana.findIndex(d => d.toLowerCase() === inicioSemana.toLowerCase());
        if (index === -1) {
            console.warn("Inicio de semana inválido:", inicioSemana);
            return diasSemana.slice(0, diasFuncionamiento); // fallback
        }
        const diasRotados = [...diasSemana.slice(index), ...diasSemana.slice(0, index)];
        return diasRotados.slice(0, diasFuncionamiento);
    }, [inicioSemana, diasFuncionamiento]);

    // Calcular turnos según horario configurado
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

    // Agregar un trabajador a la lista
    const agregarTrabajador = () => {
        if (nuevoTrabajador.trim() === '') {
            toast.error('Ingresa un nombre válido para el trabajador');
            return;
        }
        
        if (horasContrato <= 0) {
            toast.error('Las horas de contrato deben ser mayores a 0');
            return;
        }
        
        const nuevosTrabajadores = [...trabajadores, {
            nombre: nuevoTrabajador.trim(),
            tipoContrato,
            horasDisponibles: horasContrato
        }];
        
        setTrabajadores(nuevosTrabajadores);
        setNuevoTrabajador('');
        setHorasContrato(45); // resetea al valor por defecto
        
        toast.success(`Trabajador "${nuevoTrabajador}" agregado correctamente`);
    };

    // Eliminar un trabajador de la lista
    const eliminarTrabajador = (index) => {
        const trabajadorEliminado = trabajadores[index].nombre;
        const nuevosTrabajadores = [...trabajadores];
        nuevosTrabajadores.splice(index, 1);
        setTrabajadores(nuevosTrabajadores);
        
        toast.success(`Trabajador "${trabajadorEliminado}" eliminado`);
    };

    // Cálculos para mostrar en UI
    const horasPorDia = (horarioCierre - horarioAbierto + 24) % 24 || 24;
    const totalHorasSemana = horasPorDia * diasFuncionamiento;
    const totalHorasDisponibles = trabajadores.reduce(
        (total, t) => total + t.horasDisponibles, 0
    );

    // Regenerar turnos cuando cambien los parámetros principales
    useEffect(() => {
        if (horasColacion < 0.5) {
            toast.error('La colación mínima debe ser de 0.5 horas (30 minutos)', {
                id: 'colacion-error',
            });
            setHorasColacion(0.5);
            return;
        }

        // No generar si no hay trabajadores o turnos
        if (trabajadores.length === 0 || turnos.length === 0) {
            setDatosTurnos([]);
            setHorasTrabajadas({});
            setDescansosIncorrectos([]);
            setDomingosTrabajados({});
            setViolacionesDiasSeguidos([]);
            return;
        }

        // Generar turnos
        const { resultado, horasTrabajadasPorTrabajador, distribuciones } = generarTurnos({
            trabajadores,
            semanas,
            dias,
            t,
            horarioAbierto,
            horasColacion,
            diasFuncionamiento,
            fechaInicio,
            turnos,
            horasEfectivasPorTurno
        });

        // Rellenar turnos sin cobertura
        const postProcesado = rellenarNoCoberturaConExtras(
            resultado,
            horasTrabajadasPorTrabajador,
            trabajadores,
            distribuciones,
            dias,
            turnos,
            horarioAbierto,
            horasColacion,
            horasEfectivasPorTurno
        );

        // Actualizar estados con los resultados
        setDatosTurnos(postProcesado.resultado);
        setHorasTrabajadas(postProcesado.horasAsignadas);
        
        // Ejecutar validaciones
        const descansosValid = validarDescansos(postProcesado.resultado, turnos, trabajadores);
        const domingosValid = contarDomingos(postProcesado.resultado, trabajadores);
        const diasSeguidosValid = validarDiasSeguidos(postProcesado.resultado, trabajadores);
        
        setDescansosIncorrectos(descansosValid);
        setDomingosTrabajados(domingosValid);
        setViolacionesDiasSeguidos(diasSeguidosValid);
        
        // Mostrar toast para informar que se generaron los turnos
        toast.success('Turnos generados correctamente', {
            id: 'turnos-generados',
        });
    }, [
        trabajadores, semanas, horasColacion, horarioAbierto, horarioCierre, 
        fechaInicio, inicioSemana, diasFuncionamiento, turnos, dias, 
        t, horasEfectivasPorTurno
    ]);

    // Calcular requisitos mínimos y validaciones legales
    useEffect(() => {
        if (turnos.length === 0 || trabajadores.length === 0 || !datosTurnos.length) return;

        const horasDisponibles = trabajadores.reduce(
            (acc, t) => acc + (t.horasDisponibles * semanas), 0
        );

        // Promedio de horas semanales por trabajador
        const promedioHoras = trabajadores.length > 0
            ? horasDisponibles / trabajadores.length / semanas
            : 45; // Fallback

        // Mínimo por horas
        const minPorHoras = Math.ceil(totalHorasSemana / promedioHoras);

        // Mínimo por días (6 días por semana máx)
        const bloquesACubrir = turnos.length * diasFuncionamiento * semanas;
        const maxBloquesPorTrabajador = 6 * semanas;
        const minPorDias = Math.ceil(bloquesACubrir / maxBloquesPorTrabajador);

        // Mínimo por domingos (cada trabajador solo puede cubrir hasta 2 domingos)
        const turnosPorDomingo = turnos.length;
        const totalTurnosDomingo = dias.includes("Domingo") ? turnosPorDomingo * semanas : 0;
        const maxTurnosPorTrabajador = 2;
        const minPorDomingos = Math.ceil(totalTurnosDomingo / maxTurnosPorTrabajador);

        // Elegir el valor máximo como requisito mínimo
        const minTrabajadores = Math.max(minPorHoras, minPorDias, minPorDomingos);

        // Validaciones de cumplimiento
        const cumpleH = horasDisponibles >= totalHorasSemana * semanas;
        const cumpleCantidad = trabajadores.length >= minTrabajadores;

        // Cálculo de domingos trabajados
        const domingosContados = domingosTrabajados;
        const cumpleDomingos = Object.values(domingosContados).every(
            (dom) => (semanas - dom) >= 2
        );

        // Actualizar estados
        setCumpleHoras(cumpleH);
        setCumpleCantidadTrabajadores(cumpleCantidad);
        setCumpleDomingosLibres(cumpleDomingos);
        setTrabajadoresMinimos(minTrabajadores);
        setMinPorHoras(minPorHoras);
        setMinPorDias(minPorDias);
        setMinPorDomingos(minPorDomingos);

        // Establecer la razón para el mínimo de trabajadores
        if (minTrabajadores === minPorHoras) {
            setRazonMinTrabajadores("📊 Basado en horas semanales necesarias.");
        } else if (minTrabajadores === minPorDias) {
            setRazonMinTrabajadores("📅 Basado en máximo 6 días trabajables.");
        } else {
            setRazonMinTrabajadores("🕐 Basado en restricción de 2 domingos como máximo.");
        }
        
        // Notificaciones toast para las validaciones
        // Identificamos cada toast para evitar duplicados
        if (!cumpleH) {
            toast.error(`No se cumplen las horas mínimas requeridas (${totalHorasDisponibles} de ${totalHorasSemana * semanas} h)`, {
                id: 'horas-error',
                duration: 4000,
            });
        }
        
        if (!cumpleCantidad) {
            toast.error(`Se requieren mínimo ${minTrabajadores} trabajadores para cubrir la jornada. Actualmente tienes ${trabajadores.length}.`, {
                id: 'trabajadores-error',
                duration: 4000,
            });
        }
        
        if (!cumpleDomingos) {
            toast.error('No todos los trabajadores tienen 2 domingos libres mínimos obligatorios.', {
                id: 'domingos-error',
                duration: 4000,
            });
        }
        
        if (violacionesDiasSeguidos.length > 0) {
            toast.error(`Hay ${violacionesDiasSeguidos.length} casos de trabajadores con más de 6 días seguidos sin descanso.`, {
                id: 'dias-seguidos-error',
                duration: 4000,
            });
        }
        
        if (descansosIncorrectos.length > 0) {
            toast.error(`Hay ${descansosIncorrectos.length} violaciones de descanso mínimo entre turnos (12h).`, {
                id: 'descansos-error',
                duration: 4000,
            });
        }
        
        // Toast de éxito si todo está bien
        if (cumpleH && cumpleCantidad && cumpleDomingos && 
            violacionesDiasSeguidos.length === 0 && 
            descansosIncorrectos.length === 0) {
            toast.success('Todos los requisitos legales están cumplidos.', {
                id: 'validacion-ok',
                duration: 3000,
            });
        }
        
    }, [
        datosTurnos, trabajadores, turnos, dias, totalHorasSemana, 
        domingosTrabajados, diasFuncionamiento, semanas, 
        violacionesDiasSeguidos, descansosIncorrectos
    ]);

    // Función para exportar a Excel
    const exportarExcel = () => {
        if (!datosTurnos.length) {
            toast.error('No hay datos para exportar', {
                id: 'error-exportar'
            });
            return;
        }
        
        // Elegir qué tipo de datos exportar basado en la vista activa
        if (vistaActiva === 'ciclo') {
            // Exportar vista de ciclo
            const header = ["Trabajador", ...Array.from({ length: diasFuncionamiento * semanas }, (_, i) => `D${i + 1}`)];
            const worksheetData = [header];
            
            // Segunda fila para semanas
            const semanasRow = ["Semana"];
            datosTurnos.forEach(semana => {
                semana.dias.forEach(() => {
                    semanasRow.push(`S${semana.semana}`);
                });
            });
            worksheetData.push(semanasRow);
            
            // Datos de trabajadores
            trabajadores.forEach((trabajador, index) => {
                const row = [`Trabajador ${index + 1}`];
                
                // Obtener todos los días de todas las semanas
                const todosLosDias = datosTurnos.flatMap(semana => semana.dias);
                
                // Limitar a los primeros diasFuncionamiento * semanas días
                const diasMostrados = todosLosDias.slice(0, diasFuncionamiento * semanas);
                
                diasMostrados.forEach(dia => {
                    // Buscar asignaciones para este trabajador en este día
                    const asignaciones = dia.asignaciones?.filter(asig => 
                        asig.trabajadores?.some(t => t.nombre === trabajador.nombre)
                    ) || [];
                    
                    // Si el trabajador tiene alguna asignación en este día
                    if (asignaciones.length > 0) {
                        // Usar el turno principal y convertirlo a código
                        const turnoAsignado = asignaciones[0].turno;
                        const numeroTurno = turnoAsignado.replace(/\D/g, '');
                        let codigoTurno = '-';
                        
                        switch (numeroTurno) {
                            case '1': codigoTurno = 'M'; break;
                            case '2': codigoTurno = 'T'; break;
                            case '3': codigoTurno = 'N'; break;
                            default: codigoTurno = numeroTurno;
                        }
                        
                        row.push(codigoTurno);
                    } else {
                        // Si no hay asignación, mostrar descanso
                        row.push('-');
                    }
                });
                
                worksheetData.push(row);
            });
            
            // Crear y guardar el archivo
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ciclo de Turnos");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'Ciclo_Turnos.xlsx');
        } else {
            // Exportar vista semanal (original)
            const header = ["Semana", "Día", ...turnos.map(t => `${t.nombre} (${t.inicioVisual}–${t.finVisual})`)];
            const worksheetData = [header];

            datosTurnos.forEach((semana) => {
                semana.dias.forEach((dia) => {
                    const fila = [
                        `Semana ${semana.semana}`,
                        `${dia.dia} ${dia.fecha}`,
                        ...turnos.map(turno => {
                            const asignacion = dia.asignaciones.find(a => a.turno === turno.nombre);
                            if (!asignacion || !asignacion.trabajadores || asignacion.trabajadores.length === 0) {
                                return '❌ Sin cobertura';
                            }
                            return asignacion.trabajadores.map(t => t.nombre).join(", ");
                        })
                    ];
                    worksheetData.push(fila);
                });
            });

            // Crear y guardar el archivo
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Turnos");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), 'Turnos_Dinamico.xlsx');
        }
        
        toast.success('Excel exportado correctamente', {
            id: 'excel-exportado'
        });
    };

    // Aplicar horario
    const aplicarHorario = () => {
        setHorarioAbierto(horarioAbiertoInput);
        setHorarioCierre(horarioCierreInput);
        toast.success('Horario actualizado correctamente');
    };

    return (
        <div className="container">
            <div className="left-panel">
                <h1 className="title">Parámetros Generales</h1>

                {/* Alertas para requisitos mínimos importantes - mantener esta alerta visible siempre */}
                {trabajadores.length > 0 && trabajadoresMinimos > 0 && (
                    <div className={`alerta-requisito ${cumpleCantidadTrabajadores ? 'cumple' : 'no-cumple'}`}>
                        <span className="icono">{cumpleCantidadTrabajadores ? '✅' : '⚠️'}</span>
                        <span className="mensaje">
                            Se requieren <strong>{trabajadoresMinimos}</strong> trabajadores para cubrir todos los turnos
                        </span>
                    </div>
                )}

                {/* Agregar trabajador */}
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

                {/* Lista de trabajadores */}
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

                {/* Configuración de colación */}
                <div className="input-group">
                    <label>Horas de colación:</label>
                    <input
                        type="number"
                        min="0.5"
                        step="0.1"
                        value={horasColacion}
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            if (value >= 0.5) {
                                setHorasColacion(value);
                            } else {
                                toast.error("La colación debe ser de al menos 0.5 horas.");
                                setHorasColacion(0.5);
                            }
                        }}
                    />
                </div>

                {/* Configuración de fecha */}
                <div className="input-group">
                    <label>Fecha de inicio:</label>
                    <input
                        type="date"
                        value={fechaInicio.toISOString().split('T')[0]}
                        onChange={(e) => setFechaInicio(new Date(e.target.value))}
                    />
                </div>

                {/* Configuración de horario */}
                <div className="input-group">
                    <label style={{ fontWeight: 'bold' }}>Horario de Atención:</label>

                    {/* Hora de apertura */}
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

                    {/* Hora de cierre */}
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
                        onClick={aplicarHorario}
                    >
                        Aplicar horario
                    </button>
                </div>

                {/* Alerta si no hay turnos */}
                {turnos.length === 0 && (
                    <p className="alert">⚠️ El rango de horario no permite generar al menos un turno completo.</p>
                )}

                {/* Botones de exportación y cambio de vista */}
                <div className="actions-container">
                    <button 
                        onClick={exportarExcel} 
                        className="export-button"
                        disabled={!datosTurnos.length}
                    >
                        📥 Exportar Excel
                    </button>
                    
                    <div className="toggle-view">
                        <button 
                            className={`view-button ${vistaActiva === 'semanal' ? 'active' : ''}`}
                            onClick={() => setVistaActiva('semanal')}
                        >
                            Vista Semanal
                        </button>
                        <button 
                            className={`view-button ${vistaActiva === 'ciclo' ? 'active' : ''}`}
                            onClick={() => setVistaActiva('ciclo')}
                        >
                            Vista Ciclo
                        </button>
                    </div>
                </div>

                {/* Panel de variables matemáticas */}
                <div className="card">
                    <h2>Variables Matemáticas</h2>
                    <ul>
                        <li>Trabajadores activos: {trabajadores.length}</li>
                        <li>Horas disponibles totales: {totalHorasDisponibles} horas</li>
                        <li>Horas necesarias semana: {totalHorasSemana} horas</li>
                        {trabajadores.length > 0 && (
                            <>
                                <li>Duración turno largo (incluye colación): {
                                    (() => {
                                        try {
                                            return calcularDistribucionTurnos(
                                                trabajadores[0].horasDisponibles, 
                                                diasFuncionamiento, 
                                                t, 
                                                horarioAbierto,
                                                horasColacion
                                            ).J_l;
                                        } catch (e) {
                                            return 'N/A';
                                        }
                                    })()
                                } h</li>
                                <li>Duración turno chico (incluye colación): {
                                    (() => {
                                        try {
                                            return calcularDistribucionTurnos(
                                                trabajadores[0].horasDisponibles, 
                                                diasFuncionamiento, 
                                                t, 
                                                horarioAbierto,
                                                horasColacion
                                            ).J_ch;
                                        } catch (e) {
                                            return 'N/A';
                                        }
                                    })()
                                } h</li>
                            </>
                        )}
                    </ul>
                </div>

                {/* Configuración de inicio de semana y días de funcionamiento */}
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

                {/* Configuración de bloque mínimo */}
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

            {/* Panel Derecho - Malla de Turnos */}
            <div className="right-panel">
                {vistaActiva === 'ciclo' ? (
                    // Vista de ciclo (nuevo formato)
                    <VistaCiclo 
                        datosTurnos={datosTurnos} 
                        trabajadores={trabajadores} 
                        turnos={turnos} 
                        diasCiclo={diasFuncionamiento * semanas} 
                    />
                ) : (
                    // Vista semanal (formato original)
                    <>
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
                                                        const nombres = asignacion?.trabajadores?.map(t => t.nombre).join(", ") || "❌ Sin cobertura";

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
                    </>
                )}
            </div>
        </div>
    );
};

export default TurnoRotativos;