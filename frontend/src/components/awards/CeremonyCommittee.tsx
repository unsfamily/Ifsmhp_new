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

function Portrait({
  member,
  className,
  imgClassName,
}: {
  member: CeremonyCommitteeMember;
  className?: string;
  imgClassName?: string;
}) {
  if (!member.photoKey) return null;
  const detail = portraitAlt[member.photoKey];
  return (
    <figure className={`overflow-hidden bg-forum-950 ${className ?? ''}`}>
      <img
        src={portraits[member.photoKey]}
        alt={detail ? `${member.name}, ${detail}` : `${member.name}, ${member.role}`}
        className={imgClassName ?? 'h-full w-full object-cover object-top'}
      />
    </figure>
  );
}

function Identity({ member }: { member: CeremonyCommitteeMember }) {
  return (
    <>
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brass-700">{member.role}</p>
      <h3 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">{member.name}</h3>
      {member.tagline && <p className="mt-2 text-[15px] font-medium text-forum-900">{member.tagline}</p>}
      <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{member.organisation}</p>
      {member.affiliation && <p className="mt-1 text-[15px] leading-relaxed text-ink-muted">{member.affiliation}</p>}
    </>
  );
}

function Highlights({ items }: { items: NonNullable<CeremonyCommitteeMember['highlights']> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-forum-50 px-3 py-3 ring-1 ring-paper-border">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{item.label}</dt>
          <dd className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-forum-900 sm:text-3xl">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileBody({ member }: { member: CeremonyCommitteeMember }) {
  return (
    <>
      {member.summary?.map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="mt-4 text-[15px] leading-relaxed text-ink-muted first:mt-0">{paragraph}</p>
      ))}
      {member.milestones && member.milestones.length > 0 && (
        <div className="mt-8">
          <h4 className="font-display text-xl font-semibold text-forum-900">NCC milestones</h4>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {member.milestones.map((item) => (
              <li key={item.title} className="rounded-xl border border-paper-border bg-paper-raised px-4 py-3">
                <p className="font-medium text-forum-900">{item.title}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{item.detail}</p>
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
                <a
                  href={item.href}
                  className="inline-flex rounded-full bg-forum-50 px-3 py-1.5 text-[13px] font-medium text-forum-800 ring-1 ring-paper-border hover:bg-forum-100"
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
    </>
  );
}

/** Full bio profile: fixed portrait width, identity beside it, narrative below — avoids a skinny full-height crop. */
function ProfileCard({ member }: { member: CeremonyCommitteeMember }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm">
      <div className="lg:grid lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
        <Portrait
          member={member}
          className="relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-auto lg:min-h-[28rem]"
          imgClassName="absolute inset-0 h-full w-full object-cover object-[center_12%]"
        />
        <div className="flex flex-col justify-center gap-6 p-5 sm:p-7 lg:p-8">
          <div>
            <Identity member={member} />
          </div>
          {member.highlights && member.highlights.length > 0 && <Highlights items={member.highlights} />}
        </div>
      </div>
      {(member.summary?.length || member.milestones?.length || member.identifiers?.length) ? (
        <div className="border-t border-paper-border bg-paper-raised/40 px-5 py-6 sm:px-7 sm:py-8 lg:px-8">
          <ProfileBody member={member} />
        </div>
      ) : null}
    </article>
  );
}

/** Compact portrait card for members with a photo but no long biography. */
function PortraitCard({ member }: { member: CeremonyCommitteeMember }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-paper-border bg-paper shadow-sm lg:grid lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
      <Portrait
        member={member}
        className="relative aspect-[3/4] min-h-[24rem] sm:min-h-[28rem] lg:min-h-0 lg:h-full"
        imgClassName="absolute inset-0 h-full w-full object-cover object-[center_12%]"
      />
      <div className="flex min-h-[24rem] flex-col justify-center p-5 sm:min-h-[28rem] sm:p-7">
        <Identity member={member} />
      </div>
    </article>
  );
}

function SimpleCard({ member }: { member: CeremonyCommitteeMember }) {
  return (
    <article className="rounded-2xl border border-paper-border bg-paper p-5 shadow-sm">
      <Identity member={member} />
    </article>
  );
}

function MemberCard({ member, featured = false }: { member: CeremonyCommitteeMember; featured?: boolean }) {
  if (!featured) return <SimpleCard member={member} />;
  if (member.summary && member.summary.length) return <ProfileCard member={member} />;
  if (member.photoKey) return <PortraitCard member={member} />;
  return <SimpleCard member={member} />;
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
        <div className="mt-6 space-y-8">
          {featured.map((member) => (
            <MemberCard key={`${member.role}-${member.name}`} member={member} featured />
          ))}
        </div>
      </div>
    </section>
  );
}
