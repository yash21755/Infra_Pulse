import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 font-body">
      <h1 className="text-9xl font-display font-bold text-brand-100 mb-4">404</h1>
      <h2 className="text-3xl font-bold text-slate-900 mb-2">Issue not found</h2>
      <p className="text-slate-500 mb-8 max-w-md">The page you are looking for seems to have gone missing, much like the AC remote in Room 302.</p>
      <Link to="/feed">
        <Button variant="primary" className="gap-2">
          <ArrowLeft size={18} /> Back to Feed
        </Button>
      </Link>
    </div>
  );
};