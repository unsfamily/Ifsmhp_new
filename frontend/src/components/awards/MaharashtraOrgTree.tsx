import type { LucideIcon } from 'lucide-react';
import {
  Atom,
  Building2,
  CalendarDays,
  Castle,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  MapPin,
  Megaphone,
  Mountain,
  Sparkles,
  Trees,
  UserRound,
  Users,
  Wallet,
  Waves,
} from 'lucide-react';
import logoImg from '../../assets/images/logo.webp';
import {
  MAHARASHTRA_CHAPTER_MOTTO,
  MAHARASHTRA_CHAPTER_TERM,
  maharashtraAppointmentTotals,
  maharashtraDistrictLayer,
  maharashtraDivisions,
  maharashtraExecutives,
  maharashtraInstitutionalLayer,
  maharashtraLeadership,
  type OrgTreeRole,
} from '../../domain/maharashtraChapter';

const executiveIcons: Record<string, LucideIcon> = {
  'joint-secretary': Users,
  'research-secretary': FlaskConical,
  'membership-secretary': UserRound,
  'programme-secretary': CalendarDays,
  'academic-coordinator': GraduationCap,
  'mental-health-coordinator': HeartPulse,
  'scientific-coordinator': Atom,
  'communications-secretary': Megaphone,
  'finance-coordinator': Wallet,
  'women-youth-coordinator': Sparkles,
};

const divisionIcons: Record<string, LucideIcon> = {
  'div-konkan': Waves,
  'div-pune': Landmark,
  'div-nashik': Mountain,
  'div-sambhajinagar': Castle,
  'div-amravati': Trees,
  'div-nagpur': MapPin,
};

function LevelLabel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-center rounded-full bg-[#0c2348] px-4 py-3 text-center shadow-md ring-1 ring-[#e6c36a]/50 lg:min-h-[88px]">
      <p className="text-[12px] font-semibold uppercase leading-snug tracking-[0.08em] text-[#f6e3ad]">
        {title}
        <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-[#f6e3ad]/80">{detail}</span>
      </p>
    </div>
  );
}

function LeadershipPill({ role, tone }: { role: OrgTreeRole; tone: 'navy' | 'admiral' | 'gold' }) {
  const toneClass =
    tone === 'gold'
      ? 'bg-gradient-to-b from-[#f8e7b0] to-[#d7a84a] text-[#1c2d4a] ring-[#8a6230]/30'
      : tone === 'admiral'
        ? 'bg-gradient-to-b from-[#1a3d78] to-[#102a56] text-[#f6e3ad] ring-[#e6c36a]/40'
        : 'bg-gradient-to-b from-[#16325f] to-[#0b1c38] text-[#f6e3ad] ring-[#e6c36a]/40';

  return (
    <li className={`relative z-10 w-full max-w-xl rounded-full px-5 py-3 text-center shadow-lg ring-1 ${toneClass}`}>
      <p className="text-[15px] font-semibold leading-snug sm:text-[16px]">{role.title}</p>
      {role.detail && <p className="mt-0.5 text-[12px] font-medium opacity-85">{role.detail}</p>}
      {role.name && <p className="mt-1 text-[13px] font-semibold">{role.name}</p>}
    </li>
  );
}

function LeafCard({
  role,
  icon: Icon,
  tone,
}: {
  role: OrgTreeRole;
  icon?: LucideIcon;
  tone: 'cream' | 'sky';
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-[#9ec8e4] bg-gradient-to-b from-[#f4fbff] to-[#d9eef8] text-[#0c2348]'
      : 'border-[#e4c98a] bg-gradient-to-b from-[#fff9ea] to-[#f3dd9a] text-[#1c2d4a]';

  return (
    <li className={`flex h-full min-h-[104px] flex-col items-center justify-center rounded-2xl border px-2.5 py-3 text-center shadow-[0_8px_16px_rgba(28,45,74,0.08)] ${toneClass}`}>
      {Icon && <Icon className="mb-1.5 h-5 w-5 shrink-0 opacity-80" aria-hidden="true" />}
      <p className="text-[12px] font-semibold leading-snug sm:text-[13px]">{role.title}</p>
      {role.seats && role.seats > 1 && <p className="mt-1 text-[11px] font-medium opacity-75">{role.seats} seats</p>}
    </li>
  );
}

function WideBar({ role, icon: Icon }: { role: OrgTreeRole; icon: LucideIcon }) {
  return (
    <li className="flex items-center justify-center gap-3 rounded-full border border-[#e4c98a] bg-gradient-to-r from-[#f8e7b0] via-[#e8c56b] to-[#f8e7b0] px-5 py-3 text-center text-[#1c2d4a] shadow-md">
      <Icon className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
      <p>
        <span className="block text-[14px] font-semibold sm:text-[15px]">{role.title}</span>
        {role.detail && <span className="mt-0.5 block text-[12px] font-medium opacity-80">{role.detail}</span>}
      </p>
    </li>
  );
}

const leadershipTones = ['navy', 'admiral', 'gold'] as const;

export default function MaharashtraOrgTree() {
  const [cro, advisor, secretary] = maharashtraLeadership;

  return (
    <section aria-labelledby="maharashtra-org-tree-heading" className="border-t border-paper-border bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="relative overflow-hidden rounded-[28px] border border-[#d4b36a] bg-gradient-to-b from-[#e7f6ff] via-[#f8fbff] to-[#eef6e6] shadow-[0_18px_40px_rgba(12,35,72,0.12)]">
          <header className="relative px-4 pb-2 pt-6 sm:px-8 sm:pt-8">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <img src={logoImg} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white/80 object-contain p-1 shadow-sm ring-1 ring-[#d4b36a]/60" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0c2348] sm:text-[13px]">
                  International Forum for Scientists and Mental Health Professionals (IFSMHP)
                </p>
                <p className="mt-1 text-[13px] font-medium text-[#1d4e89]">{MAHARASHTRA_CHAPTER_MOTTO}</p>
              </div>
            </div>
            <h2 id="maharashtra-org-tree-heading" className="mx-auto mt-5 max-w-4xl rounded-full bg-gradient-to-r from-[#8a6230] via-[#f0d078] to-[#8a6230] px-4 py-2.5 text-center text-[15px] font-semibold text-[#1c2d4a] shadow-md sm:text-[18px]">
              Maharashtra State Chapter – Organisational Tree ({MAHARASHTRA_CHAPTER_TERM})
            </h2>
          </header>

          <div className="relative space-y-8 px-4 py-8 sm:px-6 lg:px-8">
            <ol className="relative mx-auto flex max-w-xl flex-col items-center gap-3 before:absolute before:bottom-8 before:left-1/2 before:top-8 before:w-1.5 before:-translate-x-1/2 before:rounded-full before:bg-gradient-to-b before:from-[#3d8c3a] before:via-[#8b5a2b] before:to-[#c6a15b]">
              {cro && <LeadershipPill role={cro} tone={leadershipTones[0]} />}
              {advisor && <LeadershipPill role={advisor} tone={leadershipTones[1]} />}
              {secretary && <LeadershipPill role={secretary} tone={leadershipTones[2]} />}
            </ol>

            <div className="grid items-start gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <LevelLabel title="State Executive Committee" detail={`${maharashtraAppointmentTotals.stateExecutives} positions`} />
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {maharashtraExecutives.map((role) => (
                  <LeafCard key={role.id} role={role} icon={executiveIcons[role.id]} tone="cream" />
                ))}
              </ul>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <LevelLabel title="Divisional level" detail={`${maharashtraAppointmentTotals.divisionalCoordinators} coordinators`} />
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {maharashtraDivisions.map((role) => (
                  <LeafCard key={role.id} role={role} icon={divisionIcons[role.id]} tone="sky" />
                ))}
              </ul>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <LevelLabel title="District level" detail={`${maharashtraAppointmentTotals.districtCoordinators} districts`} />
              <ul>
                <WideBar role={maharashtraDistrictLayer} icon={MapPin} />
              </ul>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <LevelLabel title="Institutional level" detail="Members and volunteers" />
              <ul>
                <WideBar role={maharashtraInstitutionalLayer} icon={Building2} />
              </ul>
            </div>
          </div>

          <footer className="relative flex flex-col gap-3 bg-[#0c2348] px-4 py-4 text-[#f6e3ad] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]">Total proposed appointments</p>
            <p className="text-[13px] font-medium">State executives: <span className="font-display text-lg font-semibold tabular-nums">{maharashtraAppointmentTotals.stateExecutives}</span></p>
            <p className="text-[13px] font-medium">Divisional coordinators: <span className="font-display text-lg font-semibold tabular-nums">{maharashtraAppointmentTotals.divisionalCoordinators}</span></p>
            <p className="text-[13px] font-medium">District coordinators: <span className="font-display text-lg font-semibold tabular-nums">{maharashtraAppointmentTotals.districtCoordinators}</span></p>
            <p className="rounded-full bg-gradient-to-r from-[#f8e7b0] to-[#d7a84a] px-4 py-2 text-[14px] font-semibold text-[#1c2d4a]">
              Total: {maharashtraAppointmentTotals.total}
            </p>
          </footer>
        </div>
      </div>
    </section>
  );
}
