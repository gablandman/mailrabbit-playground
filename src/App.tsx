import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import AuthTestPage from './pages/AuthTestPage';
import { useEffect } from 'react';
import { supabase } from './lib/supabase'; // Votre client Supabase

// Composant pour gérer le callback OAuth
function AuthCallbackHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase gère automatiquement la session ici.
    // Après le traitement de la session, redirigez l'utilisateur.
    // Vous pouvez vérifier la session pour s'assurer que tout est ok.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Rediriger vers la page principale de l'application ou le dashboard
        navigate('/');
      } else {
        // En cas d'échec (très rare avec OAuth)
        console.error('Session non trouvée après le callback OAuth.');
        navigate('/auth'); // Retour à la page d'authentification
      }
    });
  }, [navigate]);

  return <div>Redirection en cours...</div>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthTestPage />} />
        {/* Cette route est CRUCIALE pour le callback OAuth de Supabase */}
        <Route path="/auth/callback" element={<AuthCallbackHandler />} />
        <Route path="/" element={<div>Bienvenue sur l'application ! (Dashboard futur)</div>} />
      </Routes>
    </Router>
  );
}

export default App;