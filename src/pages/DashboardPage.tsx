import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton'; // Pour un état de chargement visuel

interface Creator {
  id: string;
  name: string;
  email_address: string;
  status: 'active' | 'inactive' | 'onboarding';
  created_at: string;
}

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCreator, setAddingCreator] = useState(false); // État pour le bouton "Ajouter un créateur"
  const navigate = useNavigate();

  useEffect(() => {
    // Écouteur de session Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchCreators(session.user.id);
      } else {
        setLoading(false);
        navigate('/'); // Rediriger si pas de session
      }
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          fetchCreators(session.user.id);
        } else {
          setCreators([]);
          setLoading(false);
          navigate('/'); // Rediriger si la session est terminée
        }
      }
    );

    // Gérer les paramètres d'URL après le retour de l'Edge Function
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('creator_added') === 'true') {
      alert('Créateur ajouté avec succès !');
      // Nettoyer l'URL
      navigate('/dashboard', { replace: true });
    } else if (urlParams.get('creator_added') === 'false' && urlParams.get('error') === 'true') {
      alert('Erreur lors de l\'ajout du créateur. Veuillez réessayer.');
      navigate('/dashboard', { replace: true });
    }

    return () => {
      authListener?.unsubscribe();
    };
  }, [navigate]);

  const fetchCreators = async (userId: string) => {
    setLoading(true);
    // Récupérer les créateurs associés à l'ID de l'utilisateur connecté
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', userId); // Filtrer par l'ID du manager

    if (error) {
      console.error('Erreur lors de la récupération des créateurs:', error.message);
      alert('Erreur lors du chargement des créateurs.');
    } else {
      setCreators(data || []);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
    setLoading(false);
  };

  // --- Fonction pour Connecter un Compte Gmail de CRÉATEUR ---
  const handleCreatorGmailConnect = () => {
    if (!session || !session.user || !session.user.id) {
      alert("Vous devez être connecté pour ajouter un créateur.");
      navigate('/'); // Rediriger vers la page de connexion
      return;
    }

    setAddingCreator(true); // Activer l'état de chargement du bouton

    const managerUserId = session.user.id;
    console.log('Manager User ID for creator flow:', managerUserId);

    // Les scopes nécessaires pour Gmail API
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify');

    // L'ID Client de Google Cloud pour le flux créateur (celui configuré pour l'Edge Function callback)
    // Idéalement, cela devrait venir d'une variable d'environnement frontend
    // Pour l'instant, utilisez la valeur que vous avez mise dans AuthTestPage.tsx
    const GOOGLE_CLIENT_ID_CREATOR_FRONTEND = import.meta.env.VITE_GOOGLE_CLIENT_ID_CREATOR_FLOW; // Assurez-vous que cette variable est définie dans .env.local

    // L'URL de redirection doit être l'URL PUBLIQUE de votre Edge Function handle-gmail-oauth-callback
    const REDIRECT_URI_CREATOR = import.meta.env.VITE_GOOGLE_REDIRECT_URI_CREATOR; // Assurez-vous que cette variable est définie dans .env.local

    if (!GOOGLE_CLIENT_ID_CREATOR_FRONTEND || !REDIRECT_URI_CREATOR) {
      alert("Erreur de configuration: Clés Google ou URL de redirection manquantes pour le flux créateur.");
      setAddingCreator(false);
      return;
    }

    // Construire l'URL d'autorisation Google OAuth
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `scope=${scopes}&` +
      `access_type=offline&` + // Très important pour obtenir un refresh_token
      `include_granted_scopes=true&` +
      `response_type=code&` +
      `state=${managerUserId}&` + // Passer l'ID du manager dans le paramètre 'state'
      `redirect_uri=${encodeURIComponent(REDIRECT_URI_CREATOR)}&` +
      `client_id=${GOOGLE_CLIENT_ID_CREATOR_FRONTEND}`;

    // Rediriger le navigateur vers l'URL d'autorisation Google
    window.location.href = authUrl;
  };

  if (!session) {
    // Si la session n'est pas encore chargée ou n'existe pas, afficher un squelette ou rediriger
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Skeleton className="w-full max-w-md h-64 rounded-lg shadow-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Tableau de Bord</h1>
        <div className="flex items-center space-x-4">
          <span className="text-lg text-gray-700">Connecté en tant que: <span className="font-semibold">{session.user.email}</span></span>
          <Button onClick={handleSignOut} disabled={loading} variant="destructive" className="rounded-md">
            {loading ? 'Déconnexion...' : 'Se déconnecter'}
          </Button>
        </div>
      </header>

      <section className="mb-8">
        <Card className="p-6 rounded-lg shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">Gérer les Créateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreatorGmailConnect}
              disabled={addingCreator}
              className="w-full sm:w-auto p-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
            >
              {addingCreator ? 'Redirection Google...' : 'Ajouter un nouveau Créateur (Connecter Gmail)'}
            </Button>

            <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-800">Vos Créateurs Actuels</h3>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ) : creators.length === 0 ? (
              <p className="text-gray-600">Vous n'avez pas encore de créateurs connectés. Ajoutez-en un pour commencer !</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {creators.map((creator) => (
                  <Card key={creator.id} className="p-4 rounded-lg shadow-sm border border-gray-200">
                    <CardTitle className="text-lg font-semibold mb-2">{creator.name}</CardTitle>
                    <p className="text-gray-700 text-sm mb-1">Email: {creator.email_address}</p>
                    <p className={`text-sm font-medium ${creator.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                      Statut: {creator.status.charAt(0).toUpperCase() + creator.status.slice(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Ajouté le: {new Date(creator.created_at).toLocaleDateString()}</p>
                    {/* Ajoutez ici d'autres actions comme "Voir les conversations", "Désactiver", etc. */}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
