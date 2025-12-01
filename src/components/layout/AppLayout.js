import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
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
    DollarSignIcon
} from '../SharedUI';
import './AppLayout.css';

const AppLayout = ({ profile, handleLogout }) => {
    const location = useLocation();
    const isAdmin = profile?.is_admin;

    const navigation = isAdmin
        ? [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
            { name: 'Planning', href: '/planning', icon: BriefcaseIcon },
            { name: 'Agenda', href: '/agenda', icon: CalendarIcon },
            { name: 'Congés', href: '/leaves', icon: SunIcon },
            { name: 'Dépenses', href: '/expenses', icon: DollarSignIcon },
            { name: 'Utilisateurs', href: '/users', icon: UsersIcon },
            { name: 'Coffre-fort', href: '/vault', icon: FolderIcon },
            { name: 'Mes Documents', href: '/documents', icon: FileTextIcon },
            { name: 'Archives', href: '/archives', icon: ArchiveIcon },
            { name: 'Checklists', href: '/checklist-templates', icon: CheckCircleIcon },
            { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon },
        ]
        : [
            { name: 'Planning', href: '/planning', icon: BriefcaseIcon },
            { name: 'Agenda', href: '/agenda', icon: CalendarIcon },
            { name: 'Congés', href: '/leaves', icon: SunIcon },
            { name: 'Dépenses', href: '/expenses', icon: DollarSignIcon },
            { name: 'Coffre-fort', href: '/vault', icon: LockIcon },
            { name: 'Mes Documents', href: '/documents', icon: FileTextIcon },
            { name: 'Checklists', href: '/checklists', icon: CheckCircleIcon },
            { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon },
        ];

    const isDashboard = location.pathname === '/dashboard' || location.pathname === '/';

    return (
        <div className={`app-layout ${isDashboard ? 'dark-mode-layout' : ''}`}>
            {/* Desktop Sidebar */}
            <div className="desktop-nav">
                <div className="sidebar-header">
                    <h1>Portail SRP</h1>
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
                <h1>Portail SRP</h1>
                <button onClick={handleLogout} className="btn-icon-logout">
                    <LogOutIcon />
                </button>
            </div>

            {/* Main Content */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* Mobile Bottom Nav */}
            <div className="mobile-nav">
                <div className="mobile-nav-icons">
                    {navigation.slice(0, 5).map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                `mobile-nav-button ${isActive ? 'active' : ''}`
                            }
                        >
                            <item.icon />
                            <span className="mobile-nav-label">{item.name}</span>
                        </NavLink>
                    ))}
                    {navigation.length > 5 && (
                        <NavLink
                            to="/menu"
                            className={({ isActive }) =>
                                `mobile-nav-button ${isActive ? 'active' : ''}`
                            }
                        >
                            <MenuIcon />
                            <span className="mobile-nav-label">Menu</span>
                        </NavLink>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppLayout;
