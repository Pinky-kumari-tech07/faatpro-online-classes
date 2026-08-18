import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import LoginPage from "./pages/auth/Login";
import RegisterPage from "./pages/auth/Register";
import RegisterStudentPage from "./pages/auth/RegisterStudent";
import RegisterInstructorPage from "./pages/auth/RegisterInstructor";
import ForgotPasswordPage from "./pages/auth/ForgotPassword";
import ResetPasswordPage from "./pages/auth/ResetPassword";
import AuthCallbackPage from "./pages/auth/Callback";
import { clearPostLoginRedirect, getStoredPostLoginRedirect } from "@/lib/authRedirect";
import { AuthProvider } from "./shared/hooks/useAuth";
import { WorkspaceProvider, useWorkspace } from "./shared/hooks/useWorkspace";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleGuard from "./routes/RoleGuard";
import AppShell from "./shared/layouts/AppShell";
import DashboardContainer from "./modules/dashboard/DashboardContainer";
import LiveClassesPage from "./modules/live-classes/LiveClassesPage";
import CertificatesPage from "./modules/certificates/CertificatesPage";
import ReportsPage from "./modules/reports/ReportsPage";
import InstitutionAnalyticsPage from "./modules/reports/InstitutionAnalyticsPage";
import LoginActivityPage from "./modules/reports/LoginActivityPage";
import SettingsRouter from "./modules/settings/SettingsRouter";
import MyInstructorVerificationPage from "./modules/instructor/InstructorVerificationPage";
import VerifyCertificate from "./pages/VerifyCertificate";
import CoursesPage from "./modules/courses/CoursesPage";
import CourseDetailPage from "./modules/courses/CourseDetailPage";
import CourseBuilderPage from "./modules/courses/builder/CourseBuilderPage";
import CourseDeletionRequestsPage from "./modules/courses/CourseDeletionRequestsPage";
import CourseTransferReportPage from "./modules/instructors/CourseTransferReportPage";
import LessonsPage from "./modules/lessons/LessonsPage";
import StudentsPage from "./modules/students/StudentsPage";
import AssignmentsPage from "./modules/assignments/AssignmentsPage";
import QuizzesPage from "./modules/quizzes/QuizzesPage";
import AttendanceDashboardPage from "./modules/attendance/AttendanceDashboardPage";
import AttendanceMarkPage from "./modules/attendance/AttendanceMarkPage";
import AttendanceHistoryPage from "./modules/attendance/AttendanceHistoryPage";
import AttendanceReportsPage from "./modules/attendance/AttendanceReportsPage";
import AttendanceSettingsPage from "./modules/attendance/AttendanceSettingsPage";
import StudentAttendancePage from "./modules/attendance/StudentAttendancePage";
import AnnouncementsPage from "./modules/announcements/AnnouncementsPage";
import MessagesPage from "./modules/messages/MessagesPage";
import StudentSupportPage from "./modules/support/StudentSupportPage";
import AdminSupportTicketsPage from "./modules/support/AdminSupportTicketsPage";
import {
  DiscussionsPage, PaymentsPage, AnalyticsPage,
  ActivityLogsPage,
} from "./modules/extras/RemainingPages";
import { RolesPage, PermissionMatrixPage } from "./modules/rbac/RolesPermissionsPage";
import IntegrationsPage from "./modules/integrations/IntegrationsPage";
import CategoriesPage from "./modules/categories/CategoriesPage";
import InvoicesPage from "./modules/finance/InvoicesPage";
import GstSettingsPage from "./modules/finance/GstSettingsPage";
import GstReportsPage from "./modules/finance/GstReportsPage";
import PublicLayout from "./shared/layouts/PublicLayout";
import HomePage from "./modules/public/pages/HomePage";
import PublicCoursesPage from "./modules/public/pages/CoursesPage";
import PublicCourseDetailPage from "./modules/public/pages/CourseDetailPage";
import PublicBundleDetailPage from "./modules/public/pages/PublicBundleDetailPage";
import InstructorsPage from "./modules/public/pages/InstructorsPage";
import InstructorProfilePage from "./modules/public/pages/InstructorProfilePage";
import AboutPage from "./modules/public/pages/AboutPage";
import ContactPage from "./modules/public/pages/ContactPage";
import CertificateVerifyPage from "./modules/public/pages/CertificateVerifyPage";
import LiveClassesPublicPage from "./modules/public/pages/LiveClassesPublicPage";
import SitePagePublic from "./modules/public/pages/SitePagePublic";
import SitePagesAdminPage from "./modules/admin/cms/SitePagesAdminPage";
import LessonPreviewPage from "./pages/LessonPreview";
import CheckoutPage from "./pages/CheckoutPage";
import LearnRedirect from "./pages/LearnRedirect";
import DeviceLoginControlPage from "./modules/security/DeviceLoginControlPage";
import VideoSecurityPage from "./modules/security/VideoSecurityPage";
import ContentProtectionPage from "./modules/security/ContentProtectionPage";
import NoticesAdminPage from "./modules/notices/NoticesAdminPage";
import InstructorVerificationPage from "./modules/admin/InstructorVerificationPage";
import PaymentRequestsPage from "./modules/admin/PaymentRequestsPage";
import InstitutionManagementPage from "./modules/admin/InstitutionManagementPage";
import BatchManagementPage from "./modules/batches/BatchManagementPage";
import BatchDetailPage from "./modules/batches/BatchDetailPage";
import InstructorRevenuePage from "./modules/revenue/InstructorRevenuePage";
import RevenueModelsPage from "./modules/finance/revenue/RevenueModelsPage";
import SettlementRequestsPage from "./modules/finance/revenue/SettlementRequestsPage";
import AdminEarningsPage from "./modules/finance/revenue/AdminEarningsPage";
import RevenueReportsPage from "./modules/finance/revenue/RevenueReportsPage";
import BundlesPage from "./modules/bundles/BundlesPage";
import BundleBuilderPage from "./modules/bundles/BundleBuilderPage";
import BundleDetailPage from "./modules/bundles/BundleDetailPage";
import StudentBundlesPage from "./modules/bundles/StudentBundlesPage";
import BundleLearnPage from "./modules/bundles/BundleLearnPage";
import BundleReportsPage from "./modules/bundles/BundleReportsPage";
import BatchReportsPage from "./modules/reports/BatchReportsPage";
import BatchReportDetailPage from "./modules/reports/BatchReportDetailPage";
import ContentProtection from "./shared/components/ContentProtection";
import { ContentProtectionProvider } from "./shared/hooks/useContentProtection";
import { CartProvider } from "./modules/commerce/useCart";
import CartPage from "./modules/commerce/CartPage";
import AdminCouponsPage from "./modules/commerce/AdminCouponsPage";
import OrdersPage from "./modules/commerce/OrdersPage";

const queryClient = new QueryClient();

function AuthRootRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/auth/login${search}`} replace />;
}

function LoginAliasRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/auth/login${search}`} replace />;
}

function RegisterAliasRedirect({ role }: { role?: "student" | "instructor" }) {
  const { search } = useLocation();
  const path = role ? `/auth/register/${role}` : "/auth/register";
  return <Navigate to={`${path}${search}`} replace />;
}

function AppIndexRedirect() {
  const { primaryRole, isLoading } = useWorkspace();
  // If the user was sent through auth from a public page (e.g. paid course
  // checkout) and the OAuth round trip landed here instead of /auth/callback,
  // consume the pending destination before role-based routing.
  const pending = getStoredPostLoginRedirect();
  if (pending && !pending.startsWith("/app")) {
    clearPostLoginRedirect();
    return <Navigate to={pending} replace />;
  }
  if (isLoading) return <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  return <Navigate to={primaryRole === "staff" ? "/app/courses" : "/app/dashboard"} replace />;
}

function DashboardRoute() {
  const { primaryRole, isLoading } = useWorkspace();
  if (isLoading) return <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (primaryRole === "staff") return <Navigate to="/app/courses" replace />;
  return <DashboardContainer />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppErrorBoundary>
            <AuthProvider>
            <WorkspaceProvider>
              <ContentProtectionProvider>
              <CartProvider>
              <ContentProtection />
              <ScrollToTop />
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/courses" element={<PublicCoursesPage />} />
                <Route path="/courses/:slug" element={<PublicCourseDetailPage />} />
                <Route path="/bundles/:slug" element={<PublicBundleDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/instructors" element={<InstructorsPage />} />
                <Route path="/instructors/:id" element={<InstructorProfilePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/certificate/verify" element={<CertificateVerifyPage />} />
                <Route path="/certificate/verify/:code" element={<CertificateVerifyPage />} />
                <Route path="/verify/:code" element={<CertificateVerifyPage />} />
                <Route path="/live-classes" element={<LiveClassesPublicPage />} />
                <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
                <Route path="/terms" element={<Navigate to="/terms-and-conditions" replace />} />
                <Route path="/privacy-policy" element={<SitePagePublic slug="privacy-policy" />} />
                <Route path="/terms-and-conditions" element={<SitePagePublic slug="terms-and-conditions" />} />
                <Route path="/return-refund-policy" element={<SitePagePublic slug="return-refund-policy" />} />
                <Route path="/code-of-conduct" element={<SitePagePublic slug="code-of-conduct" />} />
              </Route>
              <Route path="/login" element={<LoginAliasRedirect />} />
              <Route path="/auth" element={<AuthRootRedirect />} />
              <Route path="/register" element={<RegisterAliasRedirect />} />
              <Route path="/register/student" element={<RegisterAliasRedirect role="student" />} />
              <Route path="/register/instructor" element={<RegisterAliasRedirect role="instructor" />} />
              <Route path="/lessons/:lessonId/preview" element={<LessonPreviewPage />} />
              <Route path="/courses/:courseId/lessons/:lessonId/preview" element={<LessonPreviewPage />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/register" element={<RegisterPage />} />
              <Route path="/auth/register/student" element={<RegisterStudentPage />} />
              <Route path="/auth/register/instructor" element={<RegisterInstructorPage />} />
              <Route path="/auth/forgot" element={<ForgotPasswordPage />} />
              <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/verify-certificate/:code" element={<VerifyCertificate />} />
              <Route path="/checkout/:paymentId" element={<CheckoutPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/learn/:courseId" element={<LearnRedirect />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/app" element={<AppShell />}>
                  <Route index element={<AppIndexRedirect />} />
                  {/* Dashboard: staff is silently redirected to /app/courses instead of a 403. */}
                  <Route path="dashboard" element={<DashboardRoute />} />
                  {/* Student-accessible */}
                  <Route path="courses" element={<CoursesPage />} />
                  <Route element={<RoleGuard allow={["instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="courses/new" element={<CourseBuilderPage />} />
                    <Route path="courses/:id/edit" element={<CourseBuilderPage />} />
                  </Route>
                  <Route path="courses/:id" element={<CourseDetailPage />} />
                  <Route element={<RoleGuard allow={["organization_admin", "super_admin"]} />}>
                    <Route path="courses-deletion-requests" element={<CourseDeletionRequestsPage />} />
                  </Route>
                  <Route path="live-classes" element={<LiveClassesPage />} />
                  <Route element={<RoleGuard allow={["student", "parent", "instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="settings" element={<SettingsRouter />} />
                  </Route>
                  <Route path="support" element={<StudentSupportPage />} />
                  {/* Invoices visible to students (their own) and admin/staff (workspace-wide) */}
                  <Route element={<RoleGuard allow={["student", "parent", "instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="invoices" element={<InvoicesPage />} />
                  </Route>
                  {/* Bundles — student access */}
                  <Route path="bundles/me" element={<StudentBundlesPage />} />
                  <Route path="bundles/learn/:id" element={<BundleLearnPage />} />
                  <Route element={<RoleGuard allow={["student", "parent", "instructor", "staff", "organization_admin", "super_admin"]} />}>
                    <Route path="certificates" element={<CertificatesPage />} />
                    <Route path="announcements" element={<AnnouncementsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                  </Route>
                  {/* Learning activities */}
                  <Route element={<RoleGuard allow={["student", "instructor", "staff", "organization_admin", "super_admin"]} />}>
                    <Route path="students" element={<StudentsPage />} />
                    <Route path="attendance" element={<AttendanceDashboardPage />} />
                    <Route path="attendance/mark" element={<AttendanceMarkPage />} />
                    <Route path="attendance/history" element={<AttendanceHistoryPage />} />
                    <Route path="attendance/reports" element={<AttendanceReportsPage />} />
                    <Route path="attendance/settings" element={<AttendanceSettingsPage />} />
                    <Route path="my-attendance" element={<StudentAttendancePage />} />
                    <Route path="discussions" element={<DiscussionsPage />} />
                  </Route>
                  {/* Course content management — admin + instructor only (staff cannot edit) */}
                  <Route element={<RoleGuard allow={["student", "instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="lessons" element={<LessonsPage />} />
                    <Route path="assignments" element={<AssignmentsPage />} />
                    <Route path="quizzes" element={<QuizzesPage />} />
                  </Route>
                  <Route element={<RoleGuard allow={["instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="revenue" element={<InstructorRevenuePage />} />
                  </Route>
                  <Route element={<RoleGuard allow={["instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="instructor/verification" element={<MyInstructorVerificationPage />} />
                  </Route>
                  <Route element={<RoleGuard allow={["organization_admin", "super_admin", "staff"]} />}>
                    <Route path="batches" element={<BatchManagementPage />} />
                    <Route path="batches/:id" element={<BatchDetailPage />} />
                  </Route>
                  {/* Admin + Staff shared */}
                  <Route element={<RoleGuard allow={["organization_admin", "super_admin"]} />}>
                    <Route path="categories" element={<CategoriesPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="reports/institutions" element={<InstitutionAnalyticsPage />} />
                    <Route path="reports/login-activity" element={<LoginActivityPage />} />
                    <Route path="reports/bundles" element={<BundleReportsPage />} />
                    <Route path="reports/batches" element={<BatchReportsPage />} />
                    <Route path="reports/batches/:id" element={<BatchReportDetailPage />} />
                    <Route path="institutions" element={<InstitutionManagementPage />} />
                    <Route path="cms" element={<SitePagesAdminPage />} />
                  </Route>
                  {/* Staff-allowed operational settings pages */}
                  <Route element={<RoleGuard allow={["organization_admin", "super_admin", "staff"]} />}>
                    <Route path="notices" element={<NoticesAdminPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="support-tickets" element={<AdminSupportTicketsPage />} />
                  </Route>
                  {/* Admin only — Staff blocked (403) */}
                  <Route element={<RoleGuard allow={["organization_admin", "super_admin"]} />}>
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="integrations" element={<IntegrationsPage />} />
                    <Route path="roles" element={<RolesPage />} />
                    <Route path="roles/permissions" element={<PermissionMatrixPage />} />
                    <Route path="activity-logs" element={<ActivityLogsPage />} />
                    <Route path="finance/business-settings" element={<GstSettingsPage />} />
                    <Route path="finance/gst-reports" element={<GstReportsPage />} />
                    <Route path="finance/revenue/models" element={<RevenueModelsPage />} />
                    <Route path="finance/revenue/earnings" element={<AdminEarningsPage />} />
                    <Route path="finance/revenue/settlements" element={<SettlementRequestsPage />} />
                    <Route path="finance/revenue/history" element={<SettlementRequestsPage historyOnly />} />
                    <Route path="finance/revenue/reports" element={<RevenueReportsPage />} />
                    <Route path="security" element={<DeviceLoginControlPage />} />
                    <Route path="security/video" element={<VideoSecurityPage />} />
                    <Route path="security/content-protection" element={<ContentProtectionPage />} />
                    <Route path="instructor-verification" element={<InstructorVerificationPage />} />
                    <Route path="instructors/transfer-report" element={<CourseTransferReportPage />} />
                    <Route path="payment-requests" element={<PaymentRequestsPage />} />
                    <Route path="marketing/coupons" element={<AdminCouponsPage />} />
                  </Route>
                  {/* Orders visible to students (their own) and admin/staff (all in workspace) */}
                  <Route path="orders" element={<OrdersPage />} />
                  <Route element={<RoleGuard allow={["instructor", "organization_admin", "super_admin"]} />}>
                    <Route path="bundles" element={<BundlesPage />} />
                    <Route path="bundles/new" element={<BundleBuilderPage />} />
                    <Route path="bundles/:id" element={<BundleDetailPage />} />
                    <Route path="bundles/:id/edit" element={<BundleBuilderPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
              </CartProvider>
              </ContentProtectionProvider>
            </WorkspaceProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
  </QueryClientProvider>
);

export default App;
