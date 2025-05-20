import React from 'react';
import '../styles/VistaCiclo.css';

/**
 * Componente para mostrar una vista de ciclo de turnos por días
 * @param {Object} props - Propiedades del componente
 * @param {Array} props.datosTurnos - Datos de turnos generados
 * @param {Array} props.trabajadores - Lista de trabajadores
 * @param {Array} props.turnos - Definición de turnos disponibles
 * @param {number} props.diasCiclo - Número de días a mostrar en el ciclo (por defecto 28)
 * @returns {JSX.Element} Componente React
 */
const VistaCiclo = ({ datosTurnos, trabajadores, turnos, diasCiclo = 28 }) => {
  // No mostrar nada si no hay datos
  if (!datosTurnos?.length || !trabajadores?.length || !turnos?.length) {
    return null;
  }

  // Obtener todos los días combinados de todas las semanas
  const todosLosDias = datosTurnos.flatMap(semana => 
    semana.dias?.map(dia => ({
      ...dia,
      semana: semana.semana
    })) || []
  );

  // Limitar a los primeros 'diasCiclo' días
  const diasMostrados = todosLosDias.slice(0, diasCiclo);

  // Función para determinar el código del turno
  const obtenerCodigoTurno = (turnoNombre) => {
    if (!turnoNombre) return '-';
    
    // Extraer número del nombre del turno (por ejemplo, de "Turno 1" a "1")
    const numeroTurno = turnoNombre.replace(/\D/g, '');
    
    // Asignar códigos basados en el número del turno
    switch (numeroTurno) {
      case '1': return 'M'; // Mañana
      case '2': return 'T'; // Tarde
      case '3': return 'N'; // Noche
      default: return numeroTurno; // Si hay más turnos, usar su número
    }
  };

  return (
    <div className="vista-ciclo">
      <h2 className="ciclo-titulo">Planificación de Turnos - Ciclo de {diasMostrados.length} días</h2>
      
      <div className="ciclo-tabla-container">
        <table className="ciclo-tabla">
          <thead>
            <tr>
              <th>Trabajador</th>
              {diasMostrados.map((dia, index) => (
                <th key={index}>D{index + 1}</th>
              ))}
            </tr>
            <tr>
              <th>Semana</th>
              {diasMostrados.map(dia => (
                <th key={`${dia.fecha}-semana`}>S{dia.semana}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trabajadores.map((trabajador, trabajadorIndex) => (
              <tr key={trabajadorIndex}>
                <td className="trabajador-nombre">Trabajador {trabajadorIndex + 1}</td>
                
                {diasMostrados.map((dia, diaIndex) => {
                  // Buscar asignaciones para este trabajador en este día
                  const asignaciones = dia.asignaciones?.filter(asig => 
                    asig.trabajadores?.some(t => t.nombre === trabajador.nombre)
                  ) || [];
                  
                  // Si el trabajador tiene alguna asignación en este día
                  if (asignaciones.length > 0) {
                    // Usar el turno principal
                    const turnoAsignado = asignaciones[0].turno;
                    const codigoTurno = obtenerCodigoTurno(turnoAsignado);
                    
                    // Determinar clase CSS basada en el turno
                    let claseCSS = '';
                    if (codigoTurno === 'M') claseCSS = 'turno-m';
                    else if (codigoTurno === 'T') claseCSS = 'turno-t';
                    else if (codigoTurno === 'N') claseCSS = 'turno-n';
                    
                    return (
                      <td key={diaIndex} className={claseCSS}>
                        {codigoTurno}
                      </td>
                    );
                  }
                  
                  // Si no hay asignación, mostrar descanso
                  return <td key={diaIndex}>-</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="ciclo-leyenda">
        <div className="leyenda-item turno-m">M = Mañana</div>
        <div className="leyenda-item turno-t">T = Tarde</div>
        <div className="leyenda-item turno-n">N = Noche</div>
        <div className="leyenda-item">- = Descanso</div>
      </div>
    </div>
  );
};

export default VistaCiclo;