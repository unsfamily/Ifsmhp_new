import type { CeremonyCommitteeMember } from '../../domain/ceremonyProgramme';
import hemachandranRavikumarPortrait from '../../assets/images/awards/hemachandran-ravikumar-portrait.webp';
import yaseenShaikhPortrait from '../../assets/images/awards/yaseen-ismail-shaikh.jpg';

const portraits: Record<NonNullable<CeremonyCommitteeMember['photoKey']>, string> = {
  'hemachandran-ravikumar': hemachandranRavikumarPortrait,
  'yaseen-shaikh': yaseenShaikhPortrait,
};

const portraitAlt: Partial<Record<NonNullable<CeremonyCommitteeMember['photoKey']>, string>> = {
  'yaseen-shaikh': 'Organising Committee Secretary, in NCC uniform',
};

function MemberCard({ member, featured = false }: { member: CeremonyCommitteeMember; featured?: boolean }) {
  const photo = member.photoKey ? portraits[member.photoKey] : undefined;
  const photoDetail = member.photoKey ? portraitAlt[member.photoKey] : undefined;
  const shortFeatured = featured && !(member.summary && member.summary.length);
  return (
    <article className={`overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm ${featured ? (shortFeatured ? 'lg:grid lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]' : 'lg:grid lg:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]') : 'p-5'}`}>
      {photo && (
        <figure className={featured
          ? `relative overflow-hidden bg-forum-950 ${shortFeatured ? 'aspect-[3/4] min-h-[24rem] sm:min-h-[28rem] lg:min-h-0 lg:aspect-auto lg:h-full' : 'min-h-[18rem] lg:min-h-full'}`
          : 'mb-4 overflow-hidden rounded-xl'}
        >
          <img
            src={photo}
            alt={photoDetail ? `${member.name}, ${photoDetail}` : `${member.name}, ${member.role}`}
            className={featured
              ? (shortFeatured
                ? 'absolute inset-0 h-full w-full object-cover object-[center_12%]'
                : 'absolute inset-0 h-full w-full object-cover object-top')
              : 'aspect-square w-full object-cover object-top'}
          />
        </figure>
      )}
      <div className={featured ? (shortFeatured ? 'flex min-h-[24rem] flex-col justify-center p-5 sm:min-h-[28rem] sm:p-7' : 'p-5 sm:p-6') : ''}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass-700">{member.role}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">{member.name}</h3>
        {member.tagline && <p className="mt-2 text-[15px] font-medium text-forum-900">{member.tagline}</p>}
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{member.organisation}</p>
        {member.affiliation && <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{member.affiliation}</p>}
        {member.summary?.map((paragraph) => (
          <p key={paragraph.slice(0, 48)} className="mt-3 text-[15px] leading-relaxed text-ink-muted">{paragraph}</p>
        ))}
        {member.highlights && member.highlights.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {member.highlights.map((item) => (
              <div key={item.label} className="rounded-xl bg-forum-50 px-3 py-2.5 ring-1 ring-paper-border">
                <dt className="text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">{item.label}</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-forum-900 sm:text-2xl">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {member.milestones && member.milestones.length > 0 && (
          <div className="mt-6">
            <h4 className="font-display text-xl font-semibold text-forum-900">NCC milestones</h4>
            <ul className="mt-3 space-y-2.5">
              {member.milestones.map((item) => (
                <li key={item.title} className="rounded-xl border border-paper-border bg-paper-raised px-4 py-2.5">
                  <p className="font-medium text-forum-900">{item.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {member.identifiers && member.identifiers.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {member.identifiers.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <a href={item.href} className="inline-flex rounded-full bg-forum-50 px-3 py-1.5 text-[13px] font-medium text-forum-800 ring-1 ring-paper-border hover:bg-forum-100" target="_blank" rel="noopener noreferrer">
                    {item.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="inline-flex rounded-full bg-forum-50 px-3 py-1.5 text-[13px] font-medium text-forum-800 ring-1 ring-paper-border">{item.label}</span>
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
      <footer className="mt-6 border-t border-paper-border pt-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass-700">Organising committee</p>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {members.map((member) => (
            <li key={`${member.role}-${member.name}`}>
              <p className="font-display text-lg font-semibold text-forum-900">{member.name}</p>
              <p className="mt-1 text-[15px] text-ink-muted">{member.role}</p>
              <p className="text-[15px] text-ink-muted">{member.organisation}</p>
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
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-2 sm:px-6 lg:pb-8 lg:pt-2">
        <div className="max-w-3xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-brass-700">Organiser</p>
          <h2 id="organising-committee-heading" className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">Organising committee</h2>
        </div>
        {named.length > 0 && (
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {named.map((member) => (
              <li key={`${member.role}-${member.name}`}>
                <MemberCard member={member} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 space-y-6">
          {featured.map((member) => (
            <MemberCard key={`${member.role}-${member.name}`} member={member} featured />
          ))}
        </div>
      </div>
    </section>
  );
}
