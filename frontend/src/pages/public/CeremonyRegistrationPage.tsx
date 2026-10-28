import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, ArrowLeft } from 'lucide-react';
import {
  CeremonyRegistrationFields,
  CeremonyRegistrationNotices,
  CeremonyRegistrationSubmit,
  CeremonyRegistrationSuccess,
  useCeremonyRegistration,
} from '../../components/awards/CeremonyRegistrationForm';
import { CEREMONY_PAGE_PATH } from '../../domain/ceremonyRegistration';

export default function CeremonyRegistrationPage() {
  const registration = useCeremonyRegistration();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Register for the Ceremony · IFSMHP';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    if (registration.submitted) document.getElementById('ceremony-registration-success')?.focus();
  }, [registration.submitted]);

  return (
    <section className="bg-paper" aria-labelledby="ceremony-register-heading">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link to={CEREMONY_PAGE_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Second International Awards Ceremony
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            Awards ceremony
          </span>
        </div>
        <h1 id="ceremony-register-heading" className="mt-6 font-display text-3xl font-semibold tracking-tight text-forum-900 sm:text-4xl">
          Register for the Ceremony
        </h1>
        <div className="mt-8 rounded-2xl border border-paper-border bg-paper-raised p-5 shadow-sm sm:p-8">
          {registration.submitted ? (
            <CeremonyRegistrationSuccess />
          ) : (
            <form noValidate onSubmit={(event) => { void registration.submit(event); }}>
              <CeremonyRegistrationNotices />
              {registration.formError && (
                <p role="alert" className="mt-4 rounded-lg border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm text-danger-600">
                  {registration.formError}
                </p>
              )}
              <CeremonyRegistrationFields registration={registration} />
              <div className="mt-6">
                <CeremonyRegistrationSubmit submitting={registration.submitting} />
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
