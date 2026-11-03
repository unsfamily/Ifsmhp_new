import { Navigate } from 'react-router-dom';

/** Ceremony interest CTAs now use membership registration at /register. */
export default function CeremonyRegistrationPage() {
  return <Navigate to="/register" replace />;
}
