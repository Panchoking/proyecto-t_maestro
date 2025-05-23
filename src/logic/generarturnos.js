import { formatearHora } from '../utils/tiempo';
import { calcularDistribucionTurnos } from '../utils/distribucion';

/**
 * Genera la distribución de turnos basado en los parámetros proporcionados
 * 
 * @param {Object} params - Parámetros para la generación de turnos
 * @param {Array} params.trabajadores - Lista de trabajadores disponibles
 * @param {number} params.semanas - Número de semanas a planificar
 * @param {Array} params.dias - Lista de nombres de días (ej: ["Lunes", "Martes"...])
 * @param {number} params.t - Bloque mínimo de tiempo (ej: 0.5 para media hora)
 * @param {number} params.horarioAbierto - Hora de apertura (ej: 7 para 07:00)
 * @param {number} params.horasColacion - Horas asignadas para colación (ej: 1)
 * @param {number} params.diasFuncionamiento - Días de funcionamiento por semana (ej: 7)
 * @param {Date} params.fechaInicio - Fecha de inicio de la planificación
 * @param {Array} params.turnos - Definición de turnos disponibles
 * @param {number} params.horasEfectivasPorTurno - Horas efectivas de trabajo por turno (ej: 8)
 * @returns {Object} Resultados de la generación de turnos
 */
export const generarTurnos = ({
    trabajadores = [],
    semanas = 4,
    dias = [],
    t = 0.5,
    horarioAbierto = 0,
    horasColacion = 1,
    diasFuncionamiento = 7,
    fechaInicio = new Date(),
    turnos = [],
    horasEfectivasPorTurno = 8
}) => {
    // Validación de parámetros
    if (!trabajadores.length || !dias.length || !turnos.length) {
        return { resultado: [], horasTrabajadasPorTrabajador: {}, distribuciones: {} };
    }

    const resultado = [];
    const domingosContador = {};
    const horasTrabajadasPorTrabajador = {};
    const horasAsignadas = {};
    const distribuciones = {};

    // Inicializar contadores y distribuciones
    trabajadores.forEach(({ nombre, horasDisponibles }) => {
        horasTrabajadasPorTrabajador[nombre] = 0;
        horasAsignadas[nombre] = 0;
        domingosContador[nombre] = 0;

        try {
            distribuciones[nombre] = calcularDistribucionTurnos(
                horasDisponibles, diasFuncionamiento, t, horarioAbierto, horasColacion
            );
        } catch (e) {
            console.warn(`Distribución inválida para ${nombre}:`, e.message);
        }
    });

    // Ordenar trabajadores alfabéticamente para facilitar la rotación
    const trabajadoresOrdenados = [...trabajadores].sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Función de rotación circular segura
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
            fechaActual.setDate(fechaInicio.getDate() + semana * 7 + diaIndex);
            const fechaISO = fechaActual.toISOString().split('T')[0];
            const diaNombre = dias[diaIndex];
            const diaData = { dia: diaNombre, fecha: fechaISO, asignaciones: [] };

            // Definir grupos base y apoyo según patrón de semana
            let base = [];
            let apoyo = [];

            // Cantidad de trabajadores ajustada dinámicamente según los turnos disponibles
            const cantidadBase = Math.min(3, trabajadoresOrdenados.length, turnos.length);
            const cantidadApoyo = Math.min(3, trabajadoresOrdenados.length - cantidadBase);

            // Patrón según semana y día
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
                const suficientesTrabajadores = trabajadoresOrdenados.length >= 6;

                if (semana % 2 === 0) { // Semana 3
                    if (diaNombre === "Lunes") {
                        if (suficientesTrabajadores) {
                            base = [
                                trabajadoresOrdenados[3], // d
                                trabajadoresOrdenados[4], // e
                                trabajadoresOrdenados[5]  // f
                            ].filter(Boolean);
                        } else {
                            base = circularSlice(trabajadoresOrdenados, 0, cantidadBase);
                        }
                    } else if (diaNombre === "Domingo") {
                        if (suficientesTrabajadores) {
                            apoyo = [
                                trabajadoresOrdenados[0], // a
                                trabajadoresOrdenados[1], // b
                                trabajadoresOrdenados[2]  // c
                            ].filter(Boolean);
                        } else {
                            apoyo = circularSlice(trabajadoresOrdenados, 0, turnos.length);
                        }
                        base = [];
                    } else {
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
                                trabajadoresOrdenados[1], // b
                                trabajadoresOrdenados[2], // c
                                trabajadoresOrdenados[3]  // d
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
                if (trabajadoresOrdenados.length >= 3 && semana >= 2 && diaNombre === "Domingo" && turnoIndex < apoyo.length) {

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
                            console.log(`🚩 Forzando asignación para el patrón específico de domingo en semana ${semana + 1}`);
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
                    if ((semana === 2 || semana === 3) && diaNombre === "Domingo" && trabajadoresOrdenados.length >= 3) {

                        // Determinar qué patrón usar
                        const patronDomingo = semana === 2
                            ? [0, 1, 2] // a, b, c para semana 3
                            : [1, 2, 3]; // b, c, d para semana 4

                        // Verificar si este turno corresponde al patrón específico
                        if (turnoIndex < patronDomingo.length && trabajadoresOrdenados.length > patronDomingo[turnoIndex]) {
                            const idxTrabajador = patronDomingo[turnoIndex];
                            const trabajadorForzado = trabajadoresOrdenados[idxTrabajador];

                            if (trabajadorForzado) {
                                console.log(`🔧 Forzando asignación de ${trabajadorForzado.nombre} para ${turno.nombre} del domingo en semana ${semana + 1} (última oportunidad)`);

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

    return { resultado, horasTrabajadasPorTrabajador, distribuciones };
};

/**
 * Rellena turnos sin cobertura con trabajadores extras
 * 
 * @param {Array} resultado - Resultado de turnos generados
 * @param {Object} horasAsignadas - Horas asignadas por trabajador
 * @param {Array} trabajadores - Lista de trabajadores disponibles
 * @param {Object} distribuciones - Distribuciones calculadas por trabajador
 * @param {Array} dias - Lista de nombres de días
 * @param {Array} turnos - Lista de turnos disponibles
 * @param {number} horarioAbierto - Hora de apertura
 * @param {number} horasColacion - Horas de colación
 * @param {number} horasEfectivasPorTurno - Horas efectivas por turno
 * @returns {Object} Resultado modificado
 */
export const rellenarNoCoberturaConExtras = (
    resultado,
    horasAsignadas,
    trabajadores,
    distribuciones,
    dias,
    turnos,
    horarioAbierto,
    horasColacion,
    horasEfectivasPorTurno = 8
) => {
    if (!resultado || !Array.isArray(resultado) || 
        !trabajadores || !Array.isArray(trabajadores) ||
        !turnos || !Array.isArray(turnos)) {
        return { resultado, horasAsignadas };
    }

    for (let semana of resultado) {
        if (!semana || !semana.dias) continue;
        
        for (let diaIndex = 0; diaIndex < semana.dias.length; diaIndex++) {
            const dia = semana.dias[diaIndex];
            if (!dia || !dia.asignaciones) continue;

            for (let asignacion of dia.asignaciones) {
                if (!asignacion) continue;
                
                // Si ya tiene al menos 1 trabajador, no intervenir
                if (asignacion.trabajadores && asignacion.trabajadores.length >= 1) continue;

                const candidatos = trabajadores.filter((t) => {
                    if (!t || !t.nombre) return false;
                    
                    const yaAsignado = asignacion.trabajadores && 
                                      asignacion.trabajadores.some(tr => tr && tr.nombre === t.nombre);
                    if (yaAsignado) return false;

                    const dist = distribuciones[t.nombre];
                    if (!dist || diaIndex >= dist.jornadas.length) return false;

                    const Ji = dist.jornadas[diaIndex];
                    const horasRestantes = t.horasDisponibles - (horasAsignadas[t.nombre] || 0);
                    return Ji !== undefined && horasRestantes >= Ji;
                });

                const refuerzo = candidatos[0];
                if (refuerzo) {
                    const dist = distribuciones[refuerzo.nombre];
                    let Ji = dist?.jornadas?.[diaIndex];

                    // Validación defensiva
                    if (Ji === undefined || isNaN(Ji) || Ji <= 0) {
                        Ji = horasEfectivasPorTurno;
                    }

                    // Sumar horas
                    horasAsignadas[refuerzo.nombre] = (horasAsignadas[refuerzo.nombre] || 0) + Ji;

                    // Asegurar que trabajadores sea un array
                    if (!asignacion.trabajadores) {
                        asignacion.trabajadores = [];
                    }
                    
                    // Agregar a la asignación
                    asignacion.trabajadores.push(refuerzo);

                    const turnoMatch = turnos.find(t => t && t.nombre === asignacion.turno);
                    const Ei = turnoMatch?.inicio ?? horarioAbierto;

                    if (typeof Ei === 'number' && !isNaN(Ei)) {
                        const Si = parseFloat((Ei + Ji + horasColacion).toFixed(2));
                        asignacion.horario = `${formatearHora(Ei)}–${formatearHora(Si)}`;
                    } else {
                        asignacion.horario = `Horario inválido (${asignacion.turno})`;
                    }

                    asignacion.duracion = Ji;
                }
            }
        }
    }

    return { resultado, horasAsignadas };
};