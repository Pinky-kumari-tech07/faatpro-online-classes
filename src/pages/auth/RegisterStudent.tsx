import SignupLayout from "./signup/SignupLayout";
import SignupForm from "./signup/SignupForm";

export default function RegisterStudentPage() {
  return (
    <SignupLayout
      left={{
        headline: "Start learning with clarity.",
        subtext:
          "Access structured courses, live classes, assignments, quizzes, and verified certificates from one focused learning workspace.",
        bullets: ["Learn at your pace", "Track your progress", "Earn verified certificates"],
      }}
    >
      <SignupForm
        role="student"
        title="Create student account"
        subtitle="Join courses, submit assignments, and track your learning progress."
      />
    </SignupLayout>
  );
}