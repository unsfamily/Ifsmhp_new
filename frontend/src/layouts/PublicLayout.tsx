import { useEffect, useState } from 'react';
import { usePublicSettings } from '../context/SettingsContext';
import { Outlet } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

export default function PublicLayout() {
  const settings = usePublicSettings();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 320);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  const scrollToTop = () => {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    window.scrollTo({ top: 0, behavior });
  };

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
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
        className={`fixed bottom-5 right-5 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-forum-900 text-white shadow-lg ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forum-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:bottom-7 sm:right-7 ${
          showBackToTop ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
