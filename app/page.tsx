import { redirect } from 'next/navigation';
import { defaultRouteForRole, requireUser } from '@/lib/auth';

export default async function Home() {
  const user = await requireUser();
  redirect(defaultRouteForRole(user.role));
}
