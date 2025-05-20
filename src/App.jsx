import React from 'react';
import { Toaster } from 'react-hot-toast';
import TurnoRotativos from './components/TurnoRotativos';
import "./styles/App.css";  

function App() {
  return (
    <div className="App">
      <TurnoRotativos />
      <Toaster 
        position="top-right"
        toastOptions={{
          // Personalización global para todos los toast
          duration: 3000,
          success: {
            iconTheme: {
              primary: '#38a169',
              secondary: 'white',
            },
            style: {
              background: '#f0fff4',
              color: '#276749',
              border: '1px solid #9ae6b4',
            },
          },
          error: {
            iconTheme: {
              primary: '#e53e3e',
              secondary: 'white',
            },
            style: {
              background: '#fff5f5',
              color: '#c53030',
              border: '1px solid #feb2b2',
            },
          },
        }}
      />
    </div>
  );
}

export default App;