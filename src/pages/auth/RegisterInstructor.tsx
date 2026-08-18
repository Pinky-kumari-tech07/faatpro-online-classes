import SignupLayout from "./signup/SignupLayout";
import SignupForm from "./signup/SignupForm";

export default function RegisterInstructorPage() {
  return (
    <SignupLayout
      left={{
        headline: "Teach with better structure.",
        subtext:
          "Create courses, host live sessions, review submissions, and monitor student outcomes from one calm workspace.",
        bullets: ["Build organized courses", "Grade assignments and quizzes", "Track learner outcomes"],
      }}
    >
      <SignupForm
        role="instructor"
        title="Create instructor account"
        subtitle="Start building courses, lessons, quizzes, and live learning experiences."
      />
    </SignupLayout>
  );
}