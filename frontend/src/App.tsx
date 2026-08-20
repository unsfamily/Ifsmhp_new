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
        <Route path="members" element={<AdminHomePage />} />
        <Route path="projects" element={<AdminHomePage />} />
        <Route path="publications" element={<AdminHomePage />} />
        <Route path="support" element={<AdminHomePage />} />
        <Route path="messages" element={<AdminHomePage />} />
        <Route path="reports" element={<AdminHomePage />} />
        <Route path="awards" element={<AdminHomePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
