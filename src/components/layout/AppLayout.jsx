import React, { useState, useMemo } from 'react';
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
    ChevronDownIcon,
    BuildingIcon,
    SettingsIcon
} from '../SharedUI';
import NotificationCenter, { NotificationBadge } from '../NotificationCenter';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import './AppLayout.css';

const AppLayout = ({ profile, handleLogout, lastNotification }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { hasPermission, isAdmin } = usePermissions();

    // Navigation de base pour les employes
    const baseNavigation = [
        { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
        { name: 'Conges', href: '/leaves', icon: SunIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
        { name: 'Depenses', href: '/expenses', icon: DollarSignIcon, color: 'text-green-500', bg: 'bg-green-50' },
        { name: 'Coffre-fort', href: '/vault', icon: LockIcon, color: 'text-gray-600', bg: 'bg-gray-100' },
        { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-teal-500', bg: 'bg-teal-50' },
        { name: 'Checklists', href: '/checklists', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { name: 'PDF / CERFA', href: '/cerfa', icon: FileTextIcon, color: 'text-red-500', bg: 'bg-red-50' },
    ];

    // Navigation complete admin
    const adminNavigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
        { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
        { name: 'Conges', href: '/leaves', icon: SunIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
        { name: 'Depenses', href: '/expenses', icon: DollarSignIcon, color: 'text-green-500', bg: 'bg-green-50' },
        { name: 'Utilisateurs', href: '/users', icon: UsersIcon, color: 'text-pink-500', bg: 'bg-pink-50' },
        { name: 'Coffre-fort', href: '/vault', icon: FolderIcon, color: 'text-gray-600', bg: 'bg-gray-100' },
        { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-teal-500', bg: 'bg-teal-50' },
        { name: 'Archives', href: '/archives', icon: ArchiveIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { name: 'Checklists', href: '/checklist-templates', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { name: 'Contrats', href: '/contracts', icon: FileTextIcon, color: 'text-violet-500', bg: 'bg-violet-50' },
        { name: 'Clients', href: '/clients', icon: UsersIcon, color: 'text-rose-500', bg: 'bg-rose-50' },
        { name: 'Facturation', href: '/invoices', icon: DollarSignIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { name: 'Catalogue', href: '/catalog', icon: FolderIcon, color: 'text-blue-500', bg: 'bg-blue-50' },
        { name: 'Export Comptable', href: '/monthly-export', icon: DollarSignIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
        { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
        { name: 'PDF / CERFA', href: '/cerfa', icon: FileTextIcon, color: 'text-red-500', bg: 'bg-red-50' },
        { name: 'Organisations', href: '/organizations', icon: BuildingIcon, color: 'text-sky-500', bg: 'bg-sky-50' },
        { name: 'Parametres', href: '/settings', icon: SettingsIcon, color: 'text-slate-500', bg: 'bg-slate-50' },
        { name: 'Config Entreprise', href: '/company-settings', icon: BuildingIcon, color: 'text-[#b87333]', bg: 'bg-[#f5e8d9]' },
    ];

    // Pages additionnelles basees sur les permissions
    const permissionBasedPages = [
        {
            permission: 'view_reports',
            page: { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-blue-500', bg: 'bg-blue-50' }
        },
        {
            permission: 'manage_clients',
            page: { name: 'Clients', href: '/clients', icon: UsersIcon, color: 'text-rose-500', bg: 'bg-rose-50' }
        },
        {
            permission: 'view_contracts',
            page: { name: 'Contrats', href: '/contracts', icon: FileTextIcon, color: 'text-violet-500', bg: 'bg-violet-50' }
        },
        {
            permission: 'view_invoices',
            page: { name: 'Factures', href: '/invoices', icon: DollarSignIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' }
        },
        {
            permission: 'access_catalog',
            page: { name: 'Catalogue', href: '/catalog', icon: FolderIcon, color: 'text-blue-500', bg: 'bg-blue-50' }
        },
        {
            permission: 'access_admin_vault',
            page: { name: 'Coffre Admin', href: '/admin-vault', icon: LockIcon, color: 'text-red-500', bg: 'bg-red-50' }
        },
        {
            permission: 'view_all_interventions',
            page: { name: 'Archives', href: '/archives', icon: ArchiveIcon, color: 'text-yellow-600', bg: 'bg-yellow-50' }
        },
        {
            permission: 'manage_checklist_templates',
            page: { name: 'Modeles Checklist', href: '/checklist-templates', icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-100' }
        },
        {
            permission: 'approve_expenses',
            page: { name: 'Valider Depenses', href: '/admin-expenses', icon: DollarSignIcon, color: 'text-green-600', bg: 'bg-green-100' }
        },
        {
            permission: 'approve_leave_requests',
            page: { name: 'Valider Conges', href: '/admin-leaves', icon: SunIcon, color: 'text-orange-600', bg: 'bg-orange-100' }
        },
    ];

    // Construire la navigation finale
    const navigation = useMemo(() => {
        if (isAdmin) {
            return adminNavigation;
        }

        // Commencer avec la nav de base
        const nav = [...baseNavigation];

        // Ajouter les pages basees sur les permissions
        permissionBasedPages.forEach(({ permission, page }) => {
            if (hasPermission(permission)) {
                // Eviter les doublons
                if (!nav.some(n => n.href === page.href)) {
                    nav.push(page);
                }
            }
        });

        return nav;
    }, [isAdmin, hasPermission]);

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
                        item.isExternal ? (
                            <a
                                key={item.name}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="nav-link"
                            >
                                <item.icon className="nav-icon" />
                                {item.name}
                            </a>
                        ) : (
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
                        )
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-button">
                        <LogOutIcon className="nav-icon" />
                        Deconnexion
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
                            item.isExternal ? (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="menu-grid-item"
                                    onClick={() => setShowMobileMenu(false)}
                                >
                                    <div className={`menu-icon-wrapper ${item.bg} ${item.color}`}>
                                        <item.icon size={24} />
                                    </div>
                                    <span className="menu-item-label">{item.name}</span>
                                </a>
                            ) : (
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
                            )
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
