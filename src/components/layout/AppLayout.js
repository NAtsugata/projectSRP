import React, { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    BriefcaseIcon,
    CalendarIcon,
    FolderIcon,
    UsersIcon,
    LogOutIcon,
    MenuIcon,
    LayoutDashboardIcon,
    ArchiveIcon,
    SunIcon,
    LockIcon,
    FileTextIcon,
    CheckCircleIcon,
    DollarSignIcon,
    ChevronDownIcon
} from '../SharedUI';
import NotificationCenter, { NotificationBadge } from '../NotificationCenter';
import { useAuthStore } from '../../store/authStore';
import './AppLayout.css';

const AppLayout = ({ profile, handleLogout, lastNotification }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const isAdmin = profile?.is_admin;

    const navigation = isAdmin
        ? [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
            { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
            { name: 'Congés', href: '/leaves', icon: SunIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
            { name: 'Dépenses', href: '/expenses', icon: DollarSignIcon, color: 'text-green-500', bg: 'bg-green-50' },
            { name: 'Utilisateurs', href: '/users', icon: UsersIcon, color: 'text-pink-500', bg: 'bg-pink-50' },
            { name: 'Coffre-fort', href: '/vault', icon: FolderIcon, color: 'text-gray-600', bg: 'bg-gray-100' },
            { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-teal-500', bg: 'bg-teal-50' },
            { name: 'Archives', href: '/archives', icon: ArchiveIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { name: 'Checklists', href: '/checklist-templates', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        ]
        : [
            { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
            { name: 'Congés', href: '/leaves', icon: SunIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
            { name: 'Dépenses', href: '/expenses', icon: DollarSignIcon, color: 'text-green-500', bg: 'bg-green-50' },
            { name: 'Coffre-fort', href: '/vault', icon: LockIcon, color: 'text-gray-600', bg: 'bg-gray-100' },
            { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-teal-500', bg: 'bg-teal-50' },
            { name: 'Checklists', href: '/checklists', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        ];

    const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

    const handleMenuNavigation = (href) => {
        navigate(href);
        setShowMobileMenu(false);
    };

    return (
        <div className={`app-layout ${isDashboard ? 'dark-mode-layout' : ''}`}>
            {/* Desktop Sidebar */}
            <div className="desktop-nav">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <img src="/logo192.png" alt="SRP" className="sidebar-logo-img" />
                        <h1>Portail SRP</h1>
                    </div>
                    <p>{profile?.full_name}</p>
                </div>
                <nav className="sidebar-nav">
                    {navigation.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                `nav-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon className="nav-icon" />
                            {item.name}
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-button">
                        <LogOutIcon className="nav-icon" />
                        Déconnexion
                    </button>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="mobile-header">
                <div className="mobile-header-logo">
                    <img src="/logo192.png" alt="SRP" className="mobile-logo-img" />
                    <h1>SRP</h1>
                </div>
                <div className="mobile-header-actions">
                    <NotificationBadge
                        count={0}
                        onClick={() => setShowNotifications(true)}
                    />
                    <button onClick={handleLogout} className="btn-icon-logout">
                        <LogOutIcon />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* Mobile Bottom Nav */}
            <div className="mobile-nav">
                <div className="mobile-nav-icons">
                    {navigation.slice(0, 4).map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                `mobile-nav-button ${isActive ? 'active' : ''}`
                            }
                            onClick={() => setShowMobileMenu(false)}
                        >
                            <item.icon />
                            <span className="mobile-nav-label">{item.name}</span>
                        </NavLink>
                    ))}
                    <button
                        className={`mobile-nav-button ${showMobileMenu ? 'active' : ''}`}
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                    >
                        <MenuIcon />
                        <span className="mobile-nav-label">Menu</span>
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay (Bottom Sheet) */}
            <div className={`mobile-menu-overlay ${showMobileMenu ? 'open' : ''}`} onClick={() => setShowMobileMenu(false)}>
                <div className="mobile-menu-sheet" onClick={(e) => e.stopPropagation()}>
                    <div className="mobile-menu-header">
                        <h3>Menu</h3>
                        <button onClick={() => setShowMobileMenu(false)} className="close-menu-btn">
                            <ChevronDownIcon />
                        </button>
                    </div>
                    <div className="mobile-menu-grid">
                        {navigation.map((item) => (
                            <button
                                key={item.name}
                                onClick={() => handleMenuNavigation(item.href)}
                                className={`menu-grid-item ${location.pathname === item.href ? 'active' : ''}`}
                            >
                                <div className={`menu-icon-wrapper ${item.bg} ${item.color}`}>
                                    <item.icon size={24} />
                                </div>
                                <span className="menu-item-label">{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Centre de Notifications */}
            <NotificationCenter
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                lastNotification={lastNotification}
            />
        </div>
    );
};

export default AppLayout;
