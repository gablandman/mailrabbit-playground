import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Creator {
  id: string;
  name: string;
  email_address: string;
  status: 'onboarding' | 'active' | 'inactive' | 'paused';
  automation_mode: 'assistant' | 'agent';
}

function DashboardPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCreators = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('creators')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching creators:', error);
        } else {
          setCreators(data as Creator[]);
        }
      }
      setLoading(false);
    };

    fetchCreators();
  }, []);

  const getStatusVariant = (status: Creator['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
      case 'paused':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Creators Dashboard</h1>
        <Button onClick={() => navigate('/add-creator')}>Add New Creator</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creators.map((creator) => (
            <TableRow key={creator.id}>
              <TableCell>{creator.name}</TableCell>
              <TableCell>{creator.email_address}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(creator.status)}>{creator.status}</Badge>
              </TableCell>
              <TableCell>{creator.automation_mode}</TableCell>
              <TableCell>
                <Button variant="outline" size="sm" onClick={() => navigate(`/creator/${creator.id}`)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default DashboardPage;