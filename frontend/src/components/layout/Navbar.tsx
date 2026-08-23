import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, UserPlus, LogIn } from 'lucide-react';
import logoImg from '../../assets/images/logo.png';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/membership', label: 'Membership' },
  { to: '/research', label: 'Research' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/support-services', label: 'Support' },
  { to: '/events', label: 'Events' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-paper-border bg-paper-raised/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="IFSMHP Logo"
              className="h-9 w-9 rounded-md object-contain"
            />
            <div className="leading-tight">
              <span className="block font-display text-base font-semibold text-forum-900">
                IFSMHP
              </span>
              <span className="hidden text-[10px] uppercase tracking-wider text-ink-subtle sm:block">
                {/* Scientists & Mental Health */}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-forum-50 text-forum-700'
                      : 'text-ink-muted hover:bg-forum-50 hover:text-forum-700'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-forum-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-forum-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Become a Member
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-700 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-paper-border pb-4 lg:hidden">
            <nav className="mt-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-forum-50 text-forum-700'
                        : 'text-ink-muted hover:bg-forum-50 hover:text-forum-700'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 px-1">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-paper-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Member Login
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-forum-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-forum-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Become a Member
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
