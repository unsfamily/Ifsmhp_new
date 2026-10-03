import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import MembershipPanel from '../../components/membership/MembershipPanel';
import Button from '../../components/common/Button';
export default function ApplicationStatusPage() {
  const { user, logout } = useAuth();
  return <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="font-display text-2xl">Your membership application</h1><Button variant="outline" onClick={() => void logout()}>Sign Out</Button></div><p>{user?.fullName}</p><MembershipPanel /><Link to="/" className="underline">Return home</Link></main>;
}
