import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AddCreatorPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleCreatorGmailConnect = () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !session.user || !session.user.id) {
        alert("You must be logged in to add a creator.");
        navigate('/'); // Redirect to login page
        return;
      }

      const managerUserId = session.user.id;
      const scopes = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify');
      const GOOGLE_CLIENT_ID_CREATOR_FRONTEND = import.meta.env.VITE_GOOGLE_CLIENT_ID_CREATOR_FLOW;
      const REDIRECT_URI_CREATOR = import.meta.env.VITE_GOOGLE_REDIRECT_URI_CREATOR;

      if (!GOOGLE_CLIENT_ID_CREATOR_FRONTEND || !REDIRECT_URI_CREATOR) {
        alert("Configuration error: Missing Google keys or redirect URL for creator flow.");
        return;
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `scope=${scopes}&` +
        `access_type=offline&` +
        `include_granted_scopes=true&` +
        `response_type=code&` +
        `state=${managerUserId}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI_CREATOR)}&` +
        `client_id=${GOOGLE_CLIENT_ID_CREATOR_FRONTEND}&` +
        `prompt=consent`;

      window.location.href = authUrl;
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl p-6 space-y-6 rounded-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold text-center text-gray-900">Add New Creator</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-center">Step 1: Creator Information</h2>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Creator Name</Label>
                  <Input id="name" placeholder="Creator's Name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Creator Email</Label>
                  <Input id="email" type="email" placeholder="Creator's Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-center">Step 2: Connect Gmail</h2>
              <div className="flex justify-center mt-4">
                <Button onClick={handleCreatorGmailConnect}>Connect Gmail Account</Button>
              </div>
            </div>
          )}
          <div className="flex justify-between mt-6">
            {step > 1 && (
              <Button onClick={() => setStep(step - 1)}>Previous</Button>
            )}
            {step < 2 && (
              <Button onClick={() => setStep(step + 1)} disabled={!name || !email}>Next</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}