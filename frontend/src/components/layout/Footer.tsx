import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Facebook, BookOpen } from 'lucide-react';
import logoImg from '../../assets/images/logo.png';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/membership', label: 'Membership' },
  { to: '/research', label: 'Research Publications' },
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
  return (
    <footer className="border-t border-paper-border bg-forum-900 text-forum-100">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <img
                src={logoImg}
                alt="IFSMHP Logo"
                className="h-9 w-9 rounded-md object-contain bg-white p-0.5"
              />
              <div>
                <span className="block font-display text-base font-semibold text-white">
                  IFSMHP
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-forum-200/70">
                  Int'l Forum of Scientists
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-forum-200/70">
              Advancing global research and mental health through collaborative
              excellence. Join 277+ scientists and professionals worldwide.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-700 text-forum-100 hover:bg-brass-500 hover:text-white transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-700 text-forum-100 hover:bg-brass-500 hover:text-white transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-700 text-forum-100 hover:bg-brass-500 hover:text-white transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="ResearchGate"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-700 text-forum-100 hover:bg-brass-500 hover:text-white transition-colors"
              >
                <BookOpen className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
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

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-forum-700 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-forum-200/60">
            © {new Date().getFullYear()} International Forum of Scientists and
            Mental Health Professionals. All Rights Reserved.
          </p>
          <p className="text-xs text-forum-200/60">
            Built for collaborative scientific excellence.
          </p>
        </div>
      </div>
    </footer>
  );
}
