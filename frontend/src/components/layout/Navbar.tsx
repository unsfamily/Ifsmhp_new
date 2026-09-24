import { usePublicSettings } from '../../context/SettingsContext';
import { useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, UserPlus, LogIn, Images } from 'lucide-react';
import logoImg from '../../assets/images/logo.png';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/membership', label: 'Membership' },
  { to: '/research', label: 'Research' },
  { to: '/gallery', label: 'Gallery', anchor: true },
  { to: '/support-services', label: 'Support' },
  { to: '/events', label: 'Events' },
  { to: '/contact', label: 'Contact' },
];

function GalleryNavLink({
  className,
  onClick,
}: {
  className: (isActive: boolean) => string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick();
    if (location.pathname === '/') {
      const el = document.getElementById('gallery-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', '/#gallery-section');
    } else {
      navigate('/#gallery-section');
    }
  };

  const isActiveGallery =
    location.pathname === '/' && location.hash === '#gallery-section';

  return (
    <a
      href="/#gallery-section"
      onClick={handleClick}
      className={className(isActiveGallery)}
    >
      Gallery
    </a>
  );
}

export default function Navbar() {
  const settings = usePublicSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleGalleryClick = (
    e: React.MouseEvent,
    closeMenu?: () => void
  ) => {
    e.preventDefault();
    if (closeMenu) closeMenu();
    if (isHome) {
      const el = document.getElementById('gallery-section');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', '/#gallery-section');
    } else {
      window.location.href = '/#gallery-section';
    }
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-forum-50 text-forum-900'
        : 'text-ink-muted hover:bg-forum-50 hover:text-forum-900'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-paper-border bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-22 items-center justify-between">
          <Link to="/" title={settings?.fullName || undefined} aria-label={settings?.shortName || 'Home'} className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt={`${settings?.shortName || 'IFSMHP'} Logo`}
              className="h-20 w-20 rounded-md object-contain"
            />
            <div className="leading-tight">
              <span className="hidden text-[10px] uppercase tracking-wider text-ink-subtle sm:block"></span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              if (link.anchor) {
                return (
                  <GalleryNavLink
                    key={link.to}
                    className={(isActive) =>
                      `rounded-md px-3 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-forum-50 text-forum-900'
                          : 'text-ink-muted hover:bg-forum-50 hover:text-forum-900'
                      }`
                    }
                  />
                );
              }
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={navCls}
                  end={link.to === '/'}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-forum-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-forum-800 transition-colors ring-1 ring-forum-900/10"
            >
              <UserPlus className="h-4 w-4" />
              Become a Member
            </Link>
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-900 lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-paper-border pb-4 lg:hidden">
            <nav className="mt-3 flex flex-col gap-1">
              {navLinks.map((link) => {
                if (link.anchor) {
                  return (
                    <a
                      key={link.to}
                      href="/#gallery-section"
                      onClick={(e) =>
                        handleGalleryClick(e, () => setMobileOpen(false))
                      }
                      className="rounded-md px-3 py-2 text-sm font-medium transition-colors text-ink-muted hover:bg-forum-50 hover:text-forum-900 inline-flex items-center gap-1.5"
                    >
                      <Images className="h-4 w-4 text-brass-600" />
                      Gallery
                    </a>
                  );
                }
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-forum-50 text-forum-900'
                        : 'text-ink-muted hover:bg-forum-50 hover:text-forum-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 flex flex-col gap-2 px-1">
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-paper-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Member Login
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-forum-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-forum-800 transition-colors"
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
