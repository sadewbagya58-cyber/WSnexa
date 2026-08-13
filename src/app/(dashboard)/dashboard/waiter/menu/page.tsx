import { redirect } from 'next/navigation';

export default function WaiterMenuRedirectPage() {
  redirect('/dashboard/waiter/order');
}
