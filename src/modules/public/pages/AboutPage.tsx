import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Video, ClipboardCheck, FileText, Award, MessagesSquare,
  Search, GraduationCap, PencilRuler, CheckCircle2, TrendingUp, Sparkles,
  Briefcase, Building2, Calculator, Clock, UserCheck, LineChart, Layers,
} from "lucide-react";
import studentsImg from "@/assets/hero-students-new.png.asset.json";
import instructorImg from "@/assets/instructor-indian.png.asset.json";

const offerings = [
  { icon: BookOpen, title: "Structured Courses", desc: "Practical, organized learning content designed for progressive learning." },
  { icon: Video, title: "Live Classes", desc: "Interactive sessions that let learners engage directly with instructors." },
  { icon: ClipboardCheck, title: "Assignments & Quizzes", desc: "Activities that help learners apply and assess their understanding." },
  { icon: FileText, title: "Learning Resources", desc: "Supporting materials that complement the course content." },
  { icon: Award, title: "Certificates", desc: "Certificates for eligible learners who complete course requirements." },
  { icon: MessagesSquare, title: "Community & Discussions", desc: "Space to ask questions and take part in course discussions." },
];

const journey = [
  { icon: Search, title: "Discover", desc: "Browse the catalog and choose a course that fits your goal." },
  { icon: GraduationCap, title: "Learn", desc: "Work through structured lessons and live sessions." },
  { icon: PencilRuler, title: "Practice", desc: "Apply concepts through assignments and resources." },
  { icon: CheckCircle2, title: "Assess", desc: "Check your understanding with quizzes and reviews." },
  { icon: Sparkles, title: "Complete", desc: "Finish requirements and earn your certificate if eligible." },
  { icon: TrendingUp, title: "Grow", desc: "Keep building with new courses as your career progresses." },
];

const audiences = [
  { icon: GraduationCap, title: "Students", desc: "Build a practical foundation alongside academic study." },
  { icon: Briefcase, title: "Working Professionals", desc: "Strengthen day-to-day skills without pausing work." },
  { icon: Calculator, title: "Aspiring Finance & Accounting Professionals", desc: "Prepare for practice-oriented roles in the field." },
  { icon: Building2, title: "Entrepreneurs & Business Owners", desc: "Understand the finance and compliance side of a business." },
];

const reasons = [
  { icon: Layers, title: "Practical & Structured Learning", desc: "Courses are organised into clear modules with applied lessons." },
  { icon: Clock, title: "Learn at Your Own Pace", desc: "Return to lessons and resources whenever it suits your schedule." },
  { icon: UserCheck, title: "Instructor-Led Learning", desc: "Learn from instructors through course content and live classes." },
  { icon: ClipboardCheck, title: "Assessments & Activities", desc: "Assignments and quizzes reinforce what you have studied." },
  { icon: LineChart, title: "Progress & Completion Tracking", desc: "See how far you have come across lessons and requirements." },
];

const platform = ["Courses", "Live Classes", "Assignments", "Quizzes", "Certificates", "Discussions", "Learning Progress"];

export default function AboutPage() {
  return (
    <div>
      <Helmet>
        <title>About FAATPRO | Professional Learning & Career Development</title>
        <meta
          name="description"
          content="Learn about FAATPRO, a professional learning platform offering structured courses, live classes, assignments, assessments and certificates for learners and professionals."
        />
        <link rel="canonical" href="/about" />
        <meta property="og:title" content="About FAATPRO | Professional Learning & Career Development" />
        <meta property="og:description" content="FAATPRO is a professional learning platform for Finance, Accounts, Audit and Taxation learners." />
        <meta property="og:url" content="/about" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Who we are */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">About FAATPRO</h1>
          <p className="mt-4 text-muted-foreground">
            FAATPRO brings structured online learning into a single environment — lessons, assignments, quizzes,
            discussions, live classes and certificates all sit alongside the course you are studying.
          </p>
          <p className="mt-4 text-muted-foreground">
            The focus is practical learning rather than purely theoretical study. Every course is built so that what you
            learn can be applied to real work, and every activity exists to help you check that the learning has landed.
          </p>
        </div>
        <img
          src={studentsImg.url}
          alt="Learners working together on a professional course"
          className="w-full rounded-2xl shadow-[var(--shadow-md)] object-cover"
          loading="lazy"
        />
      </section>

      {/* Mission */}
      <section className="bg-gradient-brand text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 md:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Our Mission</h2>
          <p className="mt-5 text-base sm:text-lg opacity-90">
            To make professional education more practical, accessible and outcome-oriented — so that learners can build
            real knowledge, develop professionally, and keep growing throughout their careers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {["Practical knowledge", "Professional development", "Accessible learning", "Career growth", "Continuous learning"].map((t) => (
              <span key={t} className="rounded-full border border-primary-foreground/30 px-4 py-1.5 text-sm">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* What we offer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">What We Offer</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">Everything needed to study, practise and complete a course in one place.</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offerings.map((o) => (
            <Card key={o.title} className="p-6 border-border transition-shadow hover:shadow-[var(--shadow-md)]">
              <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary grid place-items-center">
                <o.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">{o.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{o.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Approach */}
      <section className="bg-surface-muted border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Our Approach to Learning</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl">A simple, repeatable journey from first lesson to lasting skill.</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {journey.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full p-5 border-border">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-accent-soft text-accent grid place-items-center">
                      <s.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who we serve */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Who We Serve</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {audiences.map((a) => (
            <Card key={a.title} className="p-6 border-border">
              <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary grid place-items-center">
                <a.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">{a.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{a.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Why FAATPRO + people image */}
      <section className="bg-surface-muted border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Why FAATPRO</h2>
            <ul className="mt-8 space-y-5">
              {reasons.map((r) => (
                <li key={r.title} className="flex gap-4">
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-background border border-border text-primary grid place-items-center">
                    <r.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <img
            src={instructorImg.url}
            alt="A FAATPRO instructor teaching a live online class"
            className="w-full rounded-2xl shadow-[var(--shadow-md)] object-cover"
            loading="lazy"
          />
        </div>
      </section>

      {/* Platform experience */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">The Learning Experience</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">
          Each course on FAATPRO can bring together the following, depending on how the instructor has designed it:
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          {platform.map((p) => (
            <span key={p} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium">{p}</span>
          ))}
        </div>
      </section>

    </div>
  );
}