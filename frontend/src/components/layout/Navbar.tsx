import { usePublicSettings } from '../../context/SettingsContext';
import { useState, type CSSProperties } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X, UserPlus, LogIn, Images } from 'lucide-react';
import logoImg from '../../assets/images/logo.webp';
import { CEREMONY_INFORMATION_PATH, CEREMONY_PAGE_PATH } from '../../domain/ceremonyRegistration';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/membership', label: 'Membership' },
  { to: '/gallery', label: 'Gallery', anchor: true },
  { to: '/events', label: 'Events' },
  { to: CEREMONY_PAGE_PATH, label: 'Awards' },
  { to: CEREMONY_INFORMATION_PATH, label: 'Committe' },
  { to: '/contact', label: 'Contact' },
  { to: '/support-services', label: 'Support', featured: true },
];

const navItemClass = (isActive: boolean) =>
  `whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors xl:px-3 ${
    isActive
      ? 'bg-forum-900 text-white'
      : 'text-ink-muted hover:bg-forum-900 hover:text-white'
  }`;

function textParts(value: string) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map((part) => part.segment);
  }
  return Array.from(value);
}

function SupportGlowDot() {
  return <span className="support-nav-dot" aria-hidden="true" />;
}

function SupportNavLabel({ children }: { children: string }) {
  let letter = 0;
  return (
    <span className="support-nav-label" aria-hidden="true">
      {textParts(children).map((part, index) => {
        if (part.trim() === '') {
          return (
            <span key={`space-${index}`} className="support-nav-space">
              {part}
            </span>
          );
        }
        const order = letter;
        letter += 1;
        return (
          <span key={`${part}-${index}`} className="support-nav-letter" style={{ '--support-letter': order } as CSSProperties}>
            {part}
          </span>
        );
      })}
    </span>
  );
}

function GalleryNavLink({
  className,
  onClick,
}: {
  className: (isActive: boolean) => string;
  onClick?: () => void;
}) {
  const location = useLocation();

  const isActiveGallery =
    location.pathname === '/' && location.hash === '#gallery-section';

  return (
    <Link
      to="/#gallery-section"
      onClick={onClick}
      className={className(isActiveGallery)}
    >
      Gallery
    </Link>
  );
}

export default function Navbar() {
  const settings = usePublicSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navCls = ({ isActive }: { isActive: boolean }) => navItemClass(isActive);

  return (
    <header className="sticky top-0 z-40 border-b border-paper-border bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 lg:px-5">
        <div className="flex h-22 flex-nowrap items-center justify-between gap-3 xl:gap-4">
          <Link to="/" title={settings?.fullName || undefined} aria-label={settings?.shortName || 'Home'} className="flex shrink-0 items-center gap-2">
            <img
              src={logoImg}
              alt={`${settings?.shortName || 'IFSMHP'} Logo`}
              className="h-16 w-16 rounded-md object-contain lg:h-[4.5rem] lg:w-[4.5rem]"
            />
            <div className="leading-tight">
              <span className="hidden text-[10px] uppercase tracking-wider text-ink-subtle sm:block"></span>
            </div>
          </Link>

          <nav className="hidden flex-nowrap items-center gap-1.5 xl:gap-2 lg:flex">
            {navLinks.map((link) => {
              if (link.anchor) {
                return (
                  <GalleryNavLink
                    key={link.to}
                    className={(isActive) =>
                      `inline-flex items-center gap-1.5 ${navItemClass(isActive)}`
                    }
                  />
                );
              }
              if (link.featured) {
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    aria-label={link.label}
                    className={({ isActive }) =>
                      `support-nav-link whitespace-nowrap px-2.5 py-2 text-sm xl:px-3${isActive ? ' is-active' : ''}`
                    }
                  >
                    <SupportGlowDot />
                    <SupportNavLabel>{link.label}</SupportNavLabel>
                  </NavLink>
                );
              }
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={navCls}
                  end={link.to === '/' || link.to === CEREMONY_PAGE_PATH}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-2.5">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium text-ink-muted hover:bg-forum-900 hover:text-white transition-colors xl:px-3"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-forum-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-forum-700 transition-colors ring-1 ring-forum-600/10 xl:px-4"
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
            <nav className="mt-3 flex flex-col gap-2">
              {navLinks.map((link) => {
                if (link.anchor) {
                  return (
                    <Link
                      key={link.to}
                      to="/#gallery-section"
                      onClick={() => setMobileOpen(false)}
                      className={`inline-flex items-center gap-1.5 ${navItemClass(false)}`}
                    >
                      <Images className="h-4 w-4 text-brass-600" />
                      Gallery
                    </Link>
                  );
                }
                const isActive = link.to === '/'
                  ? location.pathname === '/'
                  : link.to === CEREMONY_PAGE_PATH
                    ? location.pathname === CEREMONY_PAGE_PATH
                    : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                if (link.featured) {
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      aria-label={link.label}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`support-nav-link self-start px-2.5 py-2 text-sm${isActive ? ' is-active' : ''}`}
                    >
                      <SupportGlowDot />
                      <SupportNavLabel>{link.label}</SupportNavLabel>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={navItemClass(isActive)}
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
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-paper-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-forum-900 hover:text-white transition-colors"
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
