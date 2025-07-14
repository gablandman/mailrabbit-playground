import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import CreatorPage from './pages/CreatorPage';
import AddCreatorPage from './pages/AddCreatorPage';
import { supabase } from './lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

// Composant pour gérer le callback OAuth de Supabase (pour l'authentification du MANAGER)
function AuthCallbackHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        console.error('Session non trouvée après le callback OAuth pour le manager.');
        navigate('/', { replace: true });
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
        const { user } = currentSession;
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'Nouvel Utilisateur',
          });
          if (insertError) {
            console.error('Erreur lors de la création du profil:', insertError.message);
            await supabase.auth.signOut();
            navigate('/', { replace: true });
            return;
          }
          console.log('Profil créé pour:', user.email);
        } else if (error) {
          console.error('Erreur lors de la vérification du profil:', error.message);
          await supabase.auth.signOut();
          navigate('/', { replace: true });
          return;
        }
      } else {
        navigate('/', { replace: true });
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthStateChange('INITIAL_LOAD', session);
    });

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

  return session ? <>{children}</> : null;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackHandler />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator/:id"
          element={
            <ProtectedRoute>
              <CreatorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-creator"
          element={
            <ProtectedRoute>
              <AddCreatorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
