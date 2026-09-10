import { redirect } from 'next/navigation';

export default function ServiceStatusRedirect() {
  redirect('/status');
}
