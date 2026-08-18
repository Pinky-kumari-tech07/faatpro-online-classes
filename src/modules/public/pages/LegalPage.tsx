import { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
      {updated && <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>}
      <div className="prose prose-sm max-w-none mt-8 text-foreground/90 space-y-4">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="May 2026">
      <ul className="list-disc pl-5 space-y-2">
        <li>Users must provide accurate information when creating an account.</li>
        <li>Students agree to follow course rules and not misuse content.</li>
        <li>Instructors agree to upload original or properly licensed content only.</li>
        <li>Instructors are responsible for the accuracy and quality of their course material.</li>
        <li>Users may not share login access with anyone else.</li>
        <li>The platform may suspend or terminate accounts for policy violations.</li>
      </ul>
    </LegalPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="May 2026">
      <ul className="list-disc pl-5 space-y-2">
        <li>FAATPRO stores profile, course, progress, quiz, assignment, and certificate data.</li>
        <li>Email may be used for account, learning, and notification purposes.</li>
        <li>Data is scoped to the workspace you belong to.</li>
        <li>Users can request account or data review according to our policy.</li>
      </ul>
    </LegalPage>
  );
}

export function CodeOfConductPage() {
  return (
    <LegalPage title="Code of Conduct" updated="May 2026">
      <ul className="list-disc pl-5 space-y-2">
        <li>Respect instructors and fellow learners at all times.</li>
        <li>No harassment, hate speech, spam, plagiarism, or cheating.</li>
        <li>No unauthorized sharing or redistribution of paid course content.</li>
        <li>Instructors must provide professional, safe, and truthful learning material.</li>
      </ul>
    </LegalPage>
  );
}