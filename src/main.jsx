import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/theme.css';
import App from './App.jsx';
import { AuthProvider } from './lib/AuthContext.jsx';
import { LanguageProvider } from './i18n/LanguageContext.jsx';
import { MascotProvider } from './mascot/MascotContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <MascotProvider>
            <App />
          </MascotProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);