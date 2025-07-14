import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton'; // For a visual loading state

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
  const [addingCreator, setAddingCreator] = useState(false); // Loading state for "Add Creator" button
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase session listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchCreators(session.user.id);
      } else {
        setLoading(false);
        navigate('/'); // Redirect if no session
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
          navigate('/'); // Redirect if session ends
        }
      }
    );

    // Handle URL parameters after returning from the Edge Function
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('creator_added') === 'true') {
      alert('Creator added successfully!');
      // Clean up the URL
      navigate('/dashboard', { replace: true });
    } else if (urlParams.get('creator_added') === 'false' && urlParams.get('error') === 'true') {
      alert('Error adding creator. Please try again.');
      navigate('/dashboard', { replace: true });
    }

    return () => {
      authListener?.unsubscribe();
    };
  }, [navigate]);

  const fetchCreators = async (userId: string) => {
    setLoading(true);
    // Retrieve creators associated with the logged-in user's ID
    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', userId); // Filter by manager's ID

    if (error) {
      console.error('Error fetching creators:', error.message);
      alert('Error loading creators.');
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

  // --- Function to Connect a Creator's Gmail Account ---
  const handleCreatorGmailConnect = () => {
    if (!session || !session.user || !session.user.id) {
      alert("You must be logged in to add a creator.");
      navigate('/'); // Redirect to login page
      return;
    }

    setAddingCreator(true); // Activate loading state for the button

    const managerUserId = session.user.id;
    console.log('Manager User ID for creator flow:', managerUserId);

    // Required scopes for Gmail API
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify');

    // Google Cloud Client ID for the creator flow (configured for the Edge Function callback)
    const GOOGLE_CLIENT_ID_CREATOR_FRONTEND = import.meta.env.VITE_GOOGLE_CLIENT_ID_CREATOR_FLOW;

    // The redirect URL must be the PUBLIC URL of your handle-gmail-oauth-callback Edge Function
    const REDIRECT_URI_CREATOR = import.meta.env.VITE_GOOGLE_REDIRECT_URI_CREATOR;

    if (!GOOGLE_CLIENT_ID_CREATOR_FRONTEND || !REDIRECT_URI_CREATOR) {
      alert("Configuration error: Missing Google keys or redirect URL for creator flow.");
      setAddingCreator(false);
      return;
    }

    // Construct the Google OAuth authorization URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `scope=${scopes}&` +
      `access_type=offline&` + // Crucial for obtaining a refresh_token
      `include_granted_scopes=true&` +
      `response_type=code&` +
      `state=${managerUserId}&` + // Pass the manager's ID in the 'state' parameter
      `redirect_uri=${encodeURIComponent(REDIRECT_URI_CREATOR)}&` +
      `client_id=${GOOGLE_CLIENT_ID_CREATOR_FRONTEND}&` +
      `prompt=consent`; // <-- ADD THIS LINE TO FORCE RE-CONSENT AND GET A REFRESH TOKEN

    // Redirect the browser to the Google authorization URL
    window.location.href = authUrl;
  };

  if (!session) {
    // If session is not yet loaded or doesn't exist, show a skeleton or redirect
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Skeleton className="w-full max-w-md h-64 rounded-lg shadow-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <span className="text-lg text-gray-700">Logged in as: <span className="font-semibold">{session.user.email}</span></span>
          <Button onClick={handleSignOut} disabled={loading} variant="destructive" className="rounded-md">
            Sign Out
          </Button>
        </div>
      </header>

      <section className="mb-8">
        <Card className="p-6 rounded-lg shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">Manage Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreatorGmailConnect}
              disabled={addingCreator}
              className="w-full sm:w-auto p-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
            >
              {addingCreator ? 'Redirecting to Google...' : 'Add New Creator (Connect Gmail)'}
            </Button>

            <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-800">Your Current Creators</h3>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            ) : creators.length === 0 ? (
              <p className="text-gray-600">You don't have any connected creators yet. Add one to get started!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {creators.map((creator) => (
                  <Card key={creator.id} className="p-4 rounded-lg shadow-sm border border-gray-200">
                    <CardTitle className="text-lg font-semibold mb-2">{creator.name}</CardTitle>
                    <p className="text-gray-700 text-sm mb-1">Email: {creator.email_address}</p>
                    <p className={`text-sm font-medium ${creator.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                      Status: {creator.status.charAt(0).toUpperCase() + creator.status.slice(1)}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Added on: {new Date(creator.created_at).toLocaleDateString()}</p>
                    {/* Add other actions here like "View Conversations", "Deactivate", etc. */}
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
