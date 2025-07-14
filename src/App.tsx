import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage'; // Nouvelle page d'authentification
import DashboardPage from './pages/DashboardPage'; // Nouvelle page de tableau de bord
import { supabase } from './lib/supabase'; // Votre client Supabase
import { Skeleton } from '@/components/ui/skeleton'; // Pour un état de chargement

// Composant pour gérer le callback OAuth de Supabase (pour l'authentification du MANAGER)
function AuthCallbackHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase gère automatiquement la session ici après la redirection OAuth.
    // Cette fonction est appelée quand l'utilisateur revient de Google après s'être connecté.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true }); // Rediriger vers le tableau de bord
      } else {
        console.error('Session non trouvée après le callback OAuth pour le manager.');
        navigate('/', { replace: true }); // Retour à la page d'authentification si échec
      }
    });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Skeleton className="w-64 h-16 rounded-md" />
      <p className="ml-4 text-gray-700">Chargement de la session...</p>
    </div>
  );
}

// Composant pour protéger les routes et créer le profil
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthStateChange = async (_event: string, currentSession: any | null) => {
      setSession(currentSession);
      setLoading(false);

      if (currentSession) {
        // L'utilisateur est connecté. Vérifions ou créons son profil.
        const { user } = currentSession;
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (error && error.code === 'PGRST116') { // PGRST116 est le code pour "No rows found"
          // Le profil n'existe pas, créons-le
          const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email, // Ajoutez l'email si vous avez cette colonne dans profiles
            full_name: user.email?.split('@')[0] || 'Nouvel Utilisateur', // Nom par défaut
            // Vous pouvez ajouter d'autres champs par défaut ici
          });
          if (insertError) {
            console.error('Erreur lors de la création du profil:', insertError.message);
            // Gérer l'erreur, peut-être déconnecter l'utilisateur ou afficher un message
            await supabase.auth.signOut();
            navigate('/', { replace: true });
            return;
          }
          console.log('Profil créé pour:', user.email);
        } else if (error) {
          console.error('Erreur lors de la vérification du profil:', error.message);
          // Gérer d'autres erreurs de base de données
          await supabase.auth.signOut();
          navigate('/', { replace: true });
          return;
        }
        // Si le profil existe ou vient d'être créé, continuer
      } else {
        // L'utilisateur n'est pas connecté, rediriger
        navigate('/', { replace: true });
      }
    };

    // Obtenir la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthStateChange('INITIAL_LOAD', session);
    });

    // Écouter les changements d'état d'authentification
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    return () => {
      authListener?.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Skeleton className="w-64 h-16 rounded-md" />
        <p className="ml-4 text-gray-700">Vérification de l'authentification...</p>
      </div>
    );
  }

  return session ? <>{children}</> : null; // Rendre les enfants si authentifié
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Route par défaut pour l'authentification (managers) */}
        <Route path="/" element={<AuthPage />} />

        {/* Route pour le callback OAuth de Supabase (pour l'authentification du manager) */}
        <Route path="/auth/callback" element={<AuthCallbackHandler />} />

        {/* Route protégée pour le tableau de bord */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        {/* Vous pouvez ajouter d'autres routes protégées ici */}
      </Routes>
    </Router>
  );
}

export default App;
