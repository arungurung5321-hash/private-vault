import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './lib/api';
import { ToastProvider } from './hooks/useToast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Share from './pages/Share';
import ShareView from './pages/ShareView';
import './styles/global.css';

function RequireAuth({ children }) {
  return Auth.loggedIn() ? children : <Navigate to="/login" replace />;
}
function RequireGuest({ children }) {
  return Auth.loggedIn() ? <Navigate to="/" replace /> : children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login"        element={<RequireGuest><Login /></RequireGuest>} />
          <Route path="/register"     element={<RequireGuest><Register /></RequireGuest>} />
          <Route path="/share/:code"  element={<Share />} />
          <Route path="/share/view"   element={<ShareView />} />
          <Route path="/"             element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
