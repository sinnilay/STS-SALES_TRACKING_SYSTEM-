import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import AdminLayout from '../layouts/AdminLayout';
import SuperAdminLayout from '../layouts/SuperAdminLayout';

// Lazy loading can be added later, for now we will import pages as they are built
import SuperAdminDashboard from '../pages/superadmin/Dashboard';
import ManageCompanies from '../pages/superadmin/ManageCompanies';
import PendingTrialRequests from '../pages/superadmin/PendingTrialRequests';

import Dashboard from '../pages/admin/Dashboard';
import EmployeeList from '../pages/admin/employees/EmployeeList';
import EditEmployee from '../pages/admin/employees/EditEmployee';
import AddEmployee from '../pages/admin/employees/AddEmployee';
import AdminSettings from '../pages/admin/AdminSettings';
import DailyReport from '../pages/admin/DailyReport';
import EmployeeMeetings from '../pages/admin/EmployeeMeetings';
import StsList from '../pages/admin/sts/StsList';
import AddSts from '../pages/admin/sts/AddSts';
import StsSearch from '../pages/admin/sts/StsSearch';
import EditSts from '../pages/admin/sts/EditSts';
import SiteImagesGallery from '../pages/admin/sts/SiteImagesGallery';
import EmployeeStsRequests from '../pages/admin/sts/EmployeeStsRequests';
import GpsTracking from '../pages/admin/gps/GpsTracking';

import SalesLayout from '../layouts/SalesLayout';
import SalesDashboard from '../pages/sales/Dashboard';
import SalesStsList from '../pages/sales/SalesStsList';
import SalesProfile from '../pages/sales/Profile';
import StsReport from '../pages/sales/StsReport';
import MyDsr from '../pages/sales/MyDsr';
import CurrentMeetings from '../pages/sales/CurrentMeetings';
import PastMeetings from '../pages/sales/PastMeetings';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Super Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']} />}>
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="companies" element={<ManageCompanies />} />
          <Route path="trial-requests" element={<PendingTrialRequests />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<EmployeeList />} />
          <Route path="employees/add" element={<AddEmployee />} />
          <Route path="employees/edit/:id" element={<EditEmployee />} />
          <Route path="employees/daily-report" element={<DailyReport />} />
          <Route path="employees/meetings" element={<EmployeeMeetings />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="sts" element={<StsList />} />
          <Route path="sts/add" element={<AddSts />} />
          <Route path="sts/edit" element={<EditSts />} />
          <Route path="sts/edit/:id" element={<EditSts />} />
          <Route path="sts/search" element={<StsSearch />} />
          <Route path="sts/site-images" element={<SiteImagesGallery />} />
          <Route path="sts/requests" element={<EmployeeStsRequests />} />
          <Route path="gps" element={<GpsTracking />} />
        </Route>
      </Route>

      {/* Sales Routes */}
      <Route element={<ProtectedRoute allowedRoles={['Sales']} />}>
        <Route path="/sales" element={<SalesLayout />}>
          <Route index element={<SalesDashboard />} />
          <Route path="sts" element={<SalesStsList />} />
          <Route path="sts/add" element={<AddSts />} />
          <Route path="sts/report" element={<StsReport />} />
          <Route path="dsr" element={<MyDsr />} />
          <Route path="meetings/current" element={<CurrentMeetings />} />
          <Route path="meetings/past" element={<PastMeetings />} />
          <Route path="profile" element={<SalesProfile />} />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
