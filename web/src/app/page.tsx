import { redirect } from 'next/navigation';
import { Providers } from './providers';

// Root page redirects to dashboard
export default function HomePage() {
  redirect('/login');
}