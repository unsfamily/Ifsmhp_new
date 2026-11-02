import organisationalTreeImage from '../../assets/images/awards/maharashtra-organisational-tree-2026-2028.jpg';
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

function RolePill({
  role,
  tone = 'gold',
}: {
  role: OrgTreeRole;
  tone?: 'gold' | 'blue' | 'ink';
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-forum-800 text-white ring-forum-900/30'
      : tone === 'ink'
        ? 'bg-forum-950 text-brass-200 ring-brass-500/30'
        : 'bg-brass-500 text-forum-950 ring-brass-700/20';

  return (
    <li className={`rounded-full px-4 py-2.5 text-center shadow-sm ring-1 ${toneClass}`}>
      <p className="text-[13px] font-semibold leading-snug sm:text-[14px]">{role.title}</p>
      {role.detail && <p className="mt-0.5 text-[11px] font-medium opacity-85 sm:text-[12px]">{role.detail}</p>}
      {role.name && <p className="mt-1 text-[12px] font-medium opacity-95">{role.name}</p>}
      {role.seats && role.seats > 1 && !role.detail?.includes(String(role.seats)) && (
        <p className="mt-0.5 text-[11px] opacity-80">{role.seats} seats</p>
      )}
    </li>
  );
}

function LayerHeading({ children }: { children: string }) {
  return <h3 className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-brass-700">{children}</h3>;
}

export default function MaharashtraOrgTree() {
  return (
    <section aria-labelledby="maharashtra-org-tree-heading" className="border-t border-paper-border bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass-700">Maharashtra State Chapter</p>
          <h2 id="maharashtra-org-tree-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Organisational tree ({MAHARASHTRA_CHAPTER_TERM})
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
            Proposed structure for IFSMHP Maharashtra: central leadership, the state executive committee,
            six divisional coordinators, district secretaries across 36 districts, and institutional volunteers.
          </p>
          <p className="mt-2 text-[13px] font-medium text-forum-800">{MAHARASHTRA_CHAPTER_MOTTO}</p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm">
          <img
            src={organisationalTreeImage}
            alt={`IFSMHP Maharashtra State Chapter organisational tree for ${MAHARASHTRA_CHAPTER_TERM}, showing leadership through institutional levels`}
            className="h-auto w-full object-contain"
          />
        </div>

        <div className="mt-10 space-y-8 rounded-2xl border border-paper-border bg-paper px-4 py-8 sm:px-6 lg:px-8">
          <div>
            <LayerHeading>Leadership</LayerHeading>
            <ol className="mx-auto mt-4 flex max-w-xl flex-col items-stretch gap-3">
              {maharashtraLeadership.map((role, index) => (
                <RolePill key={role.id} role={role} tone={index === 0 ? 'ink' : index === 1 ? 'blue' : 'gold'} />
              ))}
            </ol>
          </div>

          <div>
            <LayerHeading>State Executive Committee</LayerHeading>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {maharashtraExecutives.map((role) => (
                <RolePill key={role.id} role={role} />
              ))}
            </ul>
          </div>

          <div>
            <LayerHeading>Divisional Coordinators</LayerHeading>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {maharashtraDivisions.map((role) => (
                <RolePill key={role.id} role={role} tone="blue" />
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <LayerHeading>District and institutional layers</LayerHeading>
            <ul className="mt-4 space-y-3">
              <RolePill role={maharashtraDistrictLayer} />
              <RolePill role={maharashtraInstitutionalLayer} />
            </ul>
          </div>

          <dl className="grid gap-3 rounded-xl bg-forum-50 px-4 py-4 ring-1 ring-paper-border sm:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">State executives</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-forum-900">{maharashtraAppointmentTotals.stateExecutives}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Divisional</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-forum-900">{maharashtraAppointmentTotals.divisionalCoordinators}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">District</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-forum-900">{maharashtraAppointmentTotals.districtCoordinators}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Total proposed</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-forum-900">{maharashtraAppointmentTotals.total}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
