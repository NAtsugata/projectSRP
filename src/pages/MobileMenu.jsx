import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import {
    BriefcaseIcon,
    CalendarIcon,
    FolderIcon,
    UsersIcon,
    LogOutIcon,
    LayoutDashboardIcon,
    ArchiveIcon,
    SunIcon,
    LockIcon,
    FileTextIcon,
    CheckCircleIcon,
    DollarSignIcon,
    ChevronLeftIcon
} from '../components/SharedUI';
import { authService } from '../lib/supabase';

const MobileMenu = () => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { hasPermission, isAdmin } = usePermissions();

    // Navigation de base pour tous les employes
    const baseNavigation = [
        { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-indigo-500', bg: 'bg-indigo-50' },
        { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-purple-500', bg: 'bg-purple-50' },
        { name: 'Conges', href: '/leaves', icon: SunIcon, color: 'text-orange-500', bg: 'bg-orange-50' },
        { name: 'Depenses', href: '/expenses', icon: DollarSignIcon, color: 'text-green-500', bg: 'bg-green-50' },
        { name: 'Coffre-fort', href: '/vault', icon: LockIcon, color: 'text-gray-600', bg: 'bg-gray-100' },
        { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-teal-500', bg: 'bg-teal-50' },
        { name: 'Checklists', href: '/checklists', icon: CheckCircleIcon, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
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
        { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    ];

    // Pages additionnelles basees sur les permissions
    const permissionBasedPages = [
        {
            permission: 'view_reports',
            page: { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-blue-500', bg: 'bg-blue-50' }
        },
        {
            permission: 'manage_clients',
            page: { name: 'Clients', href: '/clients', icon: UsersIcon, color: 'text-pink-500', bg: 'bg-pink-50' }
        },
        {
            permission: 'view_contracts',
            page: { name: 'Contrats', href: '/contracts', icon: FileTextIcon, color: 'text-violet-500', bg: 'bg-violet-50' }
        },
        {
            permission: 'view_invoices',
            page: { name: 'Factures', href: '/invoices', icon: FileTextIcon, color: 'text-amber-500', bg: 'bg-amber-50' }
        },
        {
            permission: 'access_catalog',
            page: { name: 'Catalogue', href: '/catalog', icon: FolderIcon, color: 'text-rose-500', bg: 'bg-rose-50' }
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

    const handleLogout = async () => {
        await authService.signOut();
        navigate('/login');
    };

    return (
        <div className="p-4 pb-24 min-h-screen bg-gray-50">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-200">
                    <ChevronLeftIcon />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Menu</h1>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {navigation.map((item) => (
                    <button
                        key={item.name}
                        onClick={() => navigate(item.href)}
                        className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-transform"
                    >
                        <div className={`p-3 rounded-full mb-3 ${item.bg} ${item.color}`}>
                            <item.icon size={28} />
                        </div>
                        <span className="font-medium text-gray-700 text-sm">{item.name}</span>
                    </button>
                ))}
            </div>

            <div className="mt-8">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl font-semibold active:scale-95 transition-transform"
                >
                    <LogOutIcon />
                    Deconnexion
                </button>
            </div>
        </div>
    );
};

export default MobileMenu;
