import type { CeremonyCommitteeMember } from '../../domain/ceremonyProgramme';
import yaseenShaikhPortrait from '../../assets/images/awards/yaseen-ismail-shaikh.jpg';

const portraits: Record<NonNullable<CeremonyCommitteeMember['photoKey']>, string> = {
  'yaseen-shaikh': yaseenShaikhPortrait,
};

function MemberCard({ member, featured = false }: { member: CeremonyCommitteeMember; featured?: boolean }) {
  const photo = member.photoKey ? portraits[member.photoKey] : undefined;
  return (
    <article className={`overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm ${featured ? 'lg:grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]' : 'p-6'}`}>
      {photo && (
        <figure className={featured ? 'bg-forum-950' : 'mb-5 overflow-hidden rounded-xl'}>
          <img
            src={photo}
            alt={member.photoKey === 'yaseen-shaikh'
              ? `${member.name}, Organising Committee Secretary, in NCC uniform`
              : member.name}
            className={featured ? 'h-full w-full object-cover object-top lg:min-h-[28rem]' : 'aspect-square w-full object-cover object-top'}
          />
        </figure>
      )}
      <div className={featured ? 'p-6 sm:p-8' : ''}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-700">{member.role}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">{member.name}</h3>
        {member.tagline && <p className="mt-2 text-sm font-medium text-forum-900">{member.tagline}</p>}
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{member.organisation}</p>
        {member.affiliation && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{member.affiliation}</p>}
        {member.summary?.map((paragraph) => (
          <p key={paragraph.slice(0, 48)} className="mt-4 text-sm leading-relaxed text-ink-muted">{paragraph}</p>
        ))}
        {member.highlights && member.highlights.length > 0 && (
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {member.highlights.map((item) => (
              <div key={item.label} className="rounded-xl bg-forum-50 px-3 py-3 ring-1 ring-paper-border">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{item.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-forum-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {member.milestones && member.milestones.length > 0 && (
          <div className="mt-8">
            <h4 className="font-display text-xl font-semibold text-forum-900">NCC milestones</h4>
            <ul className="mt-4 space-y-3">
              {member.milestones.map((item) => (
                <li key={item.title} className="rounded-xl border border-paper-border bg-paper-raised px-4 py-3">
                  <p className="font-medium text-forum-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {member.identifiers && member.identifiers.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {member.identifiers.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <a href={item.href} className="inline-flex rounded-full bg-forum-50 px-3 py-1.5 text-xs font-medium text-forum-800 ring-1 ring-paper-border hover:bg-forum-100" target="_blank" rel="noopener noreferrer">
                    {item.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="inline-flex rounded-full bg-forum-50 px-3 py-1.5 text-xs font-medium text-forum-800 ring-1 ring-paper-border">{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function CeremonyCommittee({ members, variant = 'full' }: { members: CeremonyCommitteeMember[]; variant?: 'full' | 'footer' }) {
  if (!members.length) return null;
  if (variant === 'footer') {
    return (
      <footer className="mt-12 border-t border-paper-border pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-700">Organising committee</p>
        <ul className="mt-4 grid gap-6 sm:grid-cols-2">
          {members.map((member) => (
            <li key={`${member.role}-${member.name}`}>
              <p className="font-display text-lg font-semibold text-forum-900">{member.name}</p>
              <p className="mt-1 text-sm text-ink-muted">{member.role}</p>
              <p className="text-sm text-ink-muted">{member.organisation}</p>
            </li>
          ))}
        </ul>
      </footer>
    );
  }

  const featured = members.filter((member) => member.photoKey || (member.summary && member.summary.length));
  const named = members.filter((member) => !featured.includes(member));

  return (
    <section aria-labelledby="organising-committee-heading" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700">Organiser</p>
          <h2 id="organising-committee-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">Organising committee</h2>
        </div>
        {named.length > 0 && (
          <ul className="mt-8 grid gap-6 md:grid-cols-2">
            {named.map((member) => (
              <li key={`${member.role}-${member.name}`}>
                <MemberCard member={member} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 space-y-8">
          {featured.map((member) => (
            <MemberCard key={`${member.role}-${member.name}`} member={member} featured />
          ))}
        </div>
      </div>
    </section>
  );
}
