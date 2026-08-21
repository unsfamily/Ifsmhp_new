import { Route, Routes } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import MemberLayout from './layouts/MemberLayout';
import AdminLayout from './layouts/AdminLayout';

import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import MembershipPage from './pages/public/MembershipPage';
import ResearchPublicationsPage from './pages/public/ResearchPublicationsPage';
import SupportServicesPage from './pages/public/SupportServicesPage';
import EventsPage from './pages/public/EventsPage';
import ContactPage from './pages/public/ContactPage';
import NotFoundPage from './pages/NotFoundPage';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import DashboardHomePage from './pages/member/DashboardHomePage';
import MemberProfilePage from './pages/member/MemberProfilePage';
import MemberProjectsPage from './pages/member/MemberProjectsPage';
import UploadProjectPage from './pages/member/UploadProjectPage';
import MessagesPage from './pages/member/MessagesPage';
import DocumentExchangePage from './pages/member/DocumentExchangePage';
import MemberPublicationsPage from './pages/member/MemberPublicationsPage';
import CommunityPage from './pages/member/CommunityPage';
import SupportRequestsPage from './pages/member/SupportRequestsPage';

import AdminHomePage from './pages/admin/AdminHomePage';
import AdminMembersPage from './pages/admin/AdminMembersPage';
import AdminPendingApplicationsPage from './pages/admin/AdminPendingApplicationsPage';
import AdminMemberDetailPage from './pages/admin/AdminMemberDetailPage';
import AdminProjectsPage from './pages/admin/AdminProjectsPage';
import AdminProjectDetailPage from './pages/admin/AdminProjectDetailPage';
import AdminPublicationsPage from './pages/admin/AdminPublicationsPage';
import AdminPublicationDetailPage from './pages/admin/AdminPublicationDetailPage';
import AdminSupportPage from './pages/admin/AdminSupportPage';
import AdminSupportDetailPage from './pages/admin/AdminSupportDetailPage';
import AdminMessagesPage from './pages/admin/AdminMessagesPage';
import AdminMessagesDetailPage from './pages/admin/AdminMessagesDetailPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import AdminNewEventPage from './pages/admin/AdminNewEventPage';
import AdminEditEventPage from './pages/admin/AdminEditEventPage';
import AdminInquiriesPage from './pages/admin/AdminInquiriesPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="membership" element={<MembershipPage />} />
        <Route path="research" element={<ResearchPublicationsPage />} />
        <Route path="research/:id" element={<ResearchPublicationsPage />} />
        <Route path="support-services" element={<SupportServicesPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="contact" element={<ContactPage />} />
      </Route>

      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="forgot-password" element={<LoginPage />} />
      <Route path="reset-password" element={<LoginPage />} />

      <Route path="dashboard" element={<MemberLayout />}>
        <Route index element={<DashboardHomePage />} />
        <Route path="profile" element={<MemberProfilePage />} />
        <Route path="projects" element={<MemberProjectsPage />} />
        <Route path="projects/upload" element={<UploadProjectPage />} />
        <Route path="projects/:id" element={<MemberProjectsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="documents" element={<DocumentExchangePage />} />
        <Route path="publications" element={<MemberPublicationsPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="support" element={<SupportRequestsPage />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminHomePage />} />
        <Route path="members" element={<AdminMembersPage />} />
        <Route path="members/pending" element={<AdminPendingApplicationsPage />} />
        <Route path="members/lookup" element={<AdminMembersPage />} />
        <Route path="members/:id" element={<AdminMemberDetailPage />} />
        <Route path="projects" element={<AdminProjectsPage />} />
        <Route path="projects/:id" element={<AdminProjectDetailPage />} />
        <Route path="publications" element={<AdminPublicationsPage />} />
        <Route path="publications/:id" element={<AdminPublicationDetailPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="support/:id" element={<AdminSupportDetailPage />} />
        <Route path="messages" element={<AdminMessagesPage />} />
        <Route path="messages/:conversationId" element={<AdminMessagesDetailPage />} />
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="events/new" element={<AdminNewEventPage />} />
        <Route path="events/:id/edit" element={<AdminEditEventPage />} />
        <Route path="events/:id" element={<AdminEditEventPage />} />
        <Route path="inquiries" element={<AdminInquiriesPage />} />
        <Route path="notifications" element={<AdminAnnouncementsPage />} />
        <Route path="audit-log" element={<AdminAuditLogPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="awards" element={<AdminReportsPage />} />
        <Route path="profile" element={<AdminProfilePage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
