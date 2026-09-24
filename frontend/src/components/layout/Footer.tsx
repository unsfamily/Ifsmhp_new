import { usePublicSettings } from '../../context/SettingsContext';
import { Link, useLocation } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, BookOpen, Images } from 'lucide-react';
import logoImg from '../../assets/images/logo.png';

function GalleryAnchor({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const location = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      const el = document.getElementById('gallery-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', '/#gallery-section');
    } else {
      window.location.href = '/#gallery-section';
    }
  };

  return (
    <a href="/#gallery-section" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/membership', label: 'Membership' },
  { to: '/research', label: 'Research Publications' },
  { to: '/gallery', label: 'Media Gallery', anchor: true },
  { to: '/support-services', label: 'Support Services' },
  { to: '/events', label: 'Events' },
  { to: '/contact', label: 'Contact' },
];

const memberLinks = [
  { to: '/login', label: 'Member Login' },
  { to: '/dashboard', label: 'Dashboard Access' },
  { to: '/dashboard/projects/upload', label: 'Upload Research' },
  { to: '/dashboard/support', label: 'Request Support' },
];

const legalLinks = [
  { to: '#', label: 'Privacy Policy' },
  { to: '#', label: 'Terms of Service' },
  { to: '#', label: 'Code of Ethics' },
  { to: '#', label: 'Cookie Policy' },
];

export default function Footer() {
  const settings = usePublicSettings();
  return (
    <footer className="border-t border-paper-border bg-forum-900 text-forum-100">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 text-sm space-y-2">
        {settings?.legalName && <p>{settings.legalName}{settings.registrationNumber ? ` · ${settings.registrationNumber}` : ''}</p>}
        {!settings?.legalName && settings?.registrationNumber && <p>{settings.registrationNumber}</p>}
        {settings?.address && <p className="whitespace-pre-line">{settings.address}</p>}
        {settings?.contactEmail && <p><a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a></p>}
        {settings?.contactPhone && <p>{settings.contactPhone}</p>}
        {settings?.homepageUrl && <p><a href={settings.homepageUrl}>Organization website</a></p>}
        {settings?.communityUrl && <p><a href={settings.communityUrl}>Community</a></p>}
        {settings?.privacyEmail && <p>Privacy contact: <a href={`mailto:${settings.privacyEmail}`}>{settings.privacyEmail}</a></p>}
      </div>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <img
                src={logoImg}
                alt={`${settings?.shortName || 'IFSMHP'} Logo`}
                className="h-9 w-9 rounded-md object-contain bg-white p-0.5"
              />
              <div>
                <span className="block font-display text-base font-semibold text-white">
                  {settings?.shortName || 'IFSMHP'}
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-forum-200/70">
                  {settings?.fullName || ''}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-forum-200/70">
              Advancing global research and mental health through collaborative
              excellence.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[
                { Icon: Linkedin, label: 'LinkedIn' },
                { Icon: Twitter, label: 'Twitter' },
                { Icon: Facebook, label: 'Facebook' },
                { Icon: BookOpen, label: 'ResearchGate' },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-700/60 text-forum-100 ring-1 ring-inset ring-white/5 hover:bg-brass-500 hover:text-white transition-all duration-200 hover:shadow-md"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  {link.anchor ? (
                    <GalleryAnchor className="text-sm text-forum-200/70 hover:text-brass-500 transition-colors inline-flex items-center gap-1.5">
                      <Images className="h-3 w-3" />
                      {link.label}
                    </GalleryAnchor>
                  ) : (
                    <Link
                      to={link.to}
                      className="text-sm text-forum-200/70 hover:text-brass-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              For Members
            </h3>
            <ul className="mt-4 space-y-2.5">
              {memberLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-forum-200/70 hover:text-brass-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.to}
                    className="text-sm text-forum-200/70 hover:text-brass-500 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-forum-700/80 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-forum-200/60">
            © {new Date().getFullYear()} International Forum of Scientists and
            Mental Health Professionals. All Rights Reserved.
          </p>
          <p className="text-xs text-brass-500/80 font-medium">
            Built for collaborative scientific excellence.
          </p>
        </div>
      </div>
    </footer>
  );
}
