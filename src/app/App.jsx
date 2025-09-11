import React, {useEffect, useState} from 'react';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import OperatorsPage from './pages/operators/OperatorsPage';
import TrainingHistoryPage from './pages/operators/TrainingHistoryPage';
import TasksPage from './pages/tasks/TasksPage';
import SettingsPage from './pages/settings/SettingsPage';
import RegistrationPage from './pages/auth/RegistrationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MyAccountPage from './pages/account/MyAccountPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import {PreferencesProvider} from './context/PreferencesContext';
import {AccountProvider} from './context/AccountContext';
import ListView from '../components/list/ListView';
import GuestView from '../components/guest/GuestView';
import DesktopOnly from '../components/desktop-only/DesktopOnly';
import ParticleBackground from '../components/common/ParticleBackground'

function App() {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (isMobile) return (
        <PreferencesProvider>
            <AccountProvider>
                <ParticleBackground/>
                <DesktopOnly/>
            </AccountProvider>
        </PreferencesProvider>
    );

    return (
        <PreferencesProvider>
            <AccountProvider>
                <ParticleBackground/>
                <BrowserRouter>
                    <Routes>
                        <Route element={<AuthLayout/>}>
                            <Route path="/login" element={<LoginPage/>}/>
                            <Route path="/register" element={<RegistrationPage/>}/>
                            <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
                            <Route path="/reset-password" element={<ResetPasswordPage/>}/>
                            <Route path="/verify-email" element={<VerifyEmailPage/>}/>
                        </Route>
                        <Route element={<ProtectedRoute><AppLayout/></ProtectedRoute>}>
                            <Route path="/guest" element={<GuestView/>}/>
                            <Route path="/" element={<HomePage/>}/>
                            <Route path="/operators" element={<OperatorsPage/>}/>
                            <Route path="/operators/training" element={<TrainingHistoryPage/>}/>
                            <Route path="/tasks" element={<TasksPage/>}/>
                            <Route path="/settings" element={<SettingsPage/>}/>
                            <Route path="/account" element={<MyAccountPage/>}/>
                            <Route path="/list" element={<ListView/>}/>
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace/>}/>
                    </Routes>
                </BrowserRouter>
            </AccountProvider>
        </PreferencesProvider>
    );
}

export default App;
