'use client';

import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <AlertCircle className="mx-auto h-14 w-14 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold">Page not found</h2>
      <p className="text-muted-foreground mb-8">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Button onClick={() => navigate('/')}>
        Go home
      </Button>
    </div>
  );
}
