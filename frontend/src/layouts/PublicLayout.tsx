import { usePublicSettings } from '../context/SettingsContext';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function PublicLayout() {
  const settings = usePublicSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      {settings?.maintenance && settings.maintenanceMessage && <aside role="status" className="bg-brass-50 border-b border-brass-200 px-4 py-3 text-center text-sm whitespace-pre-line">{settings.maintenanceMessage}</aside>}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
