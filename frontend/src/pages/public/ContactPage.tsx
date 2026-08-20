import { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  User,
  FileText,
  MessageSquare,
  HelpCircle,
  Briefcase,
  Users,
  BookOpenCheck,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput } from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { useForm } from 'react-hook-form';

type InquiryType = 'Membership' | 'Research Support' | 'General' | 'Partnership' | 'Event';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  inquiryType: InquiryType;
  message: string;
}

const contacts = [
  {
    icon: Users,
    label: 'Membership Inquiries',
    email: 'membership@ifsmhp.com',
    desc: 'Questions about eligibility, the application process, or membership benefits.',
    color: 'forum',
  },
  {
    icon: FileText,
    label: 'Research Support',
    email: 'research@ifsmhp.com',
    desc: 'Support requests, grant inquiries, and publication platform questions.',
    color: 'slateteal',
  },
  {
    icon: HelpCircle,
    label: 'General Inquiries',
    email: 'info@ifsmhp.com',
    desc: 'All other questions, partnerships, and general correspondence.',
    color: 'brass',
  },
];

const inquiryTypeOptions: { value: InquiryType; label: string }[] = [
  { value: 'Membership', label: 'Membership Question' },
  { value: 'Research Support', label: 'Research Support Request' },
  { value: 'General', label: 'General Inquiry' },
  { value: 'Partnership', label: 'Partnership Proposal' },
  { value: 'Event', label: 'Event Question' },
];

const faqs = [
  {
    q: 'How long does membership application review take?',
    a: 'Most applications are reviewed within 3-5 business days. Complex cases requiring additional credential verification may take up to 10 business days. You will receive email updates at every stage.',
  },
  {
    q: 'What documents do I need for registration?',
    a: 'You will need: proof of your professional credentials (degrees, licenses, certifications), CV or resume, a professional headshot, and identification of your primary research or practice areas.',
  },
  {
    q: 'Is membership open internationally?',
    a: 'Yes. IFSMHP is a global community with members across all continents. We welcome applications from qualified scientists and mental health professionals worldwide.',
  },
  {
    q: 'How do I request research project support?',
    a: 'Once a member, you can submit project details through your dashboard and indicate which support types you need (moral, official, funding). The CRO office reviews each request within 3 business days.',
  },
  {
    q: 'Are publications on IFSMHP peer-reviewed?',
    a: 'Yes. All publications submitted go through our review workflow administered by the CRO office. Accepted papers are assigned a DOI and are citable in academic work.',
  },
];

const colorClasses = {
  forum: {
    icon: 'bg-forum-50 text-forum-700 group-hover:bg-forum-600 group-hover:text-white',
    link: 'text-forum-700 hover:text-forum-900',
  },
  slateteal: {
    icon: 'bg-slateteal-100 text-slateteal-700 group-hover:bg-slateteal-500 group-hover:text-white',
    link: 'text-slateteal-700 hover:text-slateteal-700',
  },
  brass: {
    icon: 'bg-brass-100 text-brass-700 group-hover:bg-brass-500 group-hover:text-white',
    link: 'text-brass-700 hover:text-brass-700',
  },
};

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<ContactForm>({
    defaultValues: { inquiryType: 'General' },
  });

  const onSubmit = (_data: ContactForm) => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
  };

  return (
    <>
      <section className="bg-gradient-to-br from-forum-700 to-forum-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <Mail className="h-3.5 w-3.5" />
              Contact
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Get in touch
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
              Whether you're exploring membership, seeking research support, or
              considering a partnership — our team is ready to help.
            </p>
          </div>
        </div>
      </section>

      <Section bg="paper">
        <div className="grid gap-6 sm:grid-cols-3">
          {contacts.map((c) => {
            const Icon = c.icon;
            const cls = colorClasses[c.color as keyof typeof colorClasses];
            return (
              <div
                key={c.label}
                className="group rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm hover:shadow-md transition-all"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${cls.icon}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{c.label}</h3>
                <p className="mt-1 text-sm text-ink-muted">{c.desc}</p>
                <a
                  href={`mailto:${c.email}`}
                  className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold transition-colors ${cls.link}`}
                >
                  <Mail className="h-4 w-4" />
                  {c.email}
                </a>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-xl border border-paper-border bg-paper-raised p-6 sm:p-8 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700">
                  <MapPin className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-forum-900">Office Address</h3>
                  <p className="mt-1 text-sm text-ink-muted leading-relaxed">
                    International Forum of Scientists and Mental Health Professionals
                    <br />
                    [Your Office Address Line 1]
                    <br />
                    [City, State/Province, Postal Code]
                    <br />
                    [Country]
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700">
                  <Phone className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-forum-900">Phone</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    +[Country Code] [Phone Number]
                    <br />
                    <span className="text-ink-subtle">Mon–Fri, 09:00–17:00 UTC</span>
                  </p>
                </div>
              </div>
              <div className="mt-8 hidden lg:block rounded-lg bg-forum-50 p-5">
                <h4 className="font-semibold text-forum-900 flex items-center gap-2">
                  <Briefcase className="h-4.5 w-4.5" />
                  Business Hours
                </h4>
                <dl className="mt-3 space-y-1.5 text-sm text-ink-muted">
                  {[
                    ['Monday – Friday', '09:00 – 17:00 UTC'],
                    ['Support Desk', '24/5 (member portal)'],
                    ['CRO Office', 'Mon–Fri by appointment'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt>{k}</dt>
                      <dd className="font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-xl border border-forum-100 bg-paper p-5 sm:p-6">
                <h3 className="font-display text-xl font-semibold text-forum-900">
                  Send us a message
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  We usually respond within 24-48 business hours.
                </p>

                {submitted ? (
                  <div className="mt-6 rounded-lg border border-success-600/20 bg-success-100 p-5 flex items-start gap-3">
                    <BookOpenCheck className="h-5 w-5 text-success-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-success-600">Message sent successfully</p>
                      <p className="mt-1 text-sm text-success-600/80">
                        Thank you for reaching out. A member of our team will respond to your inquiry shortly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextInput
                        label="Your Name"
                        placeholder="Jane Doe"
                        required
                        error={errors.name?.message}
                        {...register('name', { required: 'Please enter your name' })}
                      />
                      <TextInput
                        label="Email Address"
                        type="email"
                        placeholder="jane@example.com"
                        required
                        error={errors.email?.message}
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                            message: 'Enter a valid email address',
                          },
                        })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextInput
                        label="Subject"
                        placeholder="Inquiry about..."
                        required
                        error={errors.subject?.message}
                        {...register('subject', { required: 'Subject is required' })}
                      />
                      <SelectInput
                        label="Inquiry Type"
                        {...register('inquiryType')}
                      >
                        {inquiryTypeOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <TextArea
                      label="Message"
                      placeholder="Write your message here..."
                      rows={6}
                      required
                      error={errors.message?.message}
                      {...register('message', { required: 'Please enter your message' })}
                    />
                    <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                      <p className="text-xs text-ink-subtle">
                        By submitting this form, you agree to our privacy policy.
                      </p>
                      <Button type="submit" size="lg" disabled={isSubmitting}>
                        <Send className="h-4.5 w-4.5" />
                        {isSubmitting ? 'Sending...' : 'Send Message'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section bg="raised">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-forum-700">
            FAQ
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Quick answers to common questions before you reach out.
          </p>
        </div>

        <div className="mt-14 mx-auto max-w-3xl divide-y divide-paper-border rounded-xl border border-paper-border bg-paper-raised shadow-sm">
          {faqs.map((f) => (
            <details key={f.q} className="group px-6 py-5 open:bg-forum-50/40 first:rounded-t-xl last:rounded-b-xl">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="font-medium text-forum-900">{f.q}</span>
                <Badge variant="brass" className="group-open:bg-forum-600 group-open:text-white">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  FAQ
                </Badge>
              </summary>
              <p className="mt-4 leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section bg="forum">
        <div className="rounded-2xl bg-paper-raised p-8 sm:p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forum-600 text-white">
            <User className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Ready to join?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-lg text-ink-muted">
            If you're ready to become part of our global community, start your
            membership application today.
          </p>
          <div className="mt-8 flex justify-center flex-wrap gap-3">
            <Button as="link" to="/register" size="lg">
              Apply for Membership
            </Button>
            <Button as="link" to="/membership" size="lg" variant="outline">
              Learn About Benefits
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
