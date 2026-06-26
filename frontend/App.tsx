import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Register from './pages/Register';
import DirectAgentRegister from './pages/DirectAgentRegister';
import Dashboard from './pages/dashboard/Dashboard';
import VerifyDetail from './pages/VerifyDetail';
import UserTransactions from './pages/admin/UserTransactions';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/direct-agent" element={<DirectAgentRegister />} />

          {/* Secure Protected Hubs */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/verify/:userId"
            element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'agent', 'direct_agent']}>
                <VerifyDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users/:userId/transactions"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserTransactions />
              </ProtectedRoute>
            }
          />

          {/* Wildcard Auto Redirection */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
