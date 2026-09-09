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

// Tableaux de navigation constants (hors composant : identité stable pour useMemo)
// Navigation de base pour tous les employes - Thème cuivre unifié
const baseNavigation = [
    { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-[#b87333]', bg: 'bg-[#f5e8d9]' },
    { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#e5c8a8]' },
    { name: 'Conges', href: '/leaves', icon: SunIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' },
    { name: 'Depenses', href: '/expenses', icon: DollarSignIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'Coffre-fort', href: '/vault', icon: LockIcon, color: 'text-[#6d4620]', bg: 'bg-[#e5c8a8]' },
    { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#f5e8d9]' },
    { name: 'Checklists', href: '/checklists', icon: CheckCircleIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' },
];

// Navigation complete admin - Thème cuivre unifié
const adminNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-[#b87333]', bg: 'bg-[#f5e8d9]' },
    { name: 'Planning', href: '/planning', icon: BriefcaseIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#e5c8a8]' },
    { name: 'Agenda', href: '/agenda', icon: CalendarIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' },
    { name: 'Conges', href: '/leaves', icon: SunIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'Depenses', href: '/expenses', icon: DollarSignIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#f5e8d9]' },
    { name: 'Utilisateurs', href: '/users', icon: UsersIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'Coffre-fort', href: '/vault', icon: FolderIcon, color: 'text-[#6d4620]', bg: 'bg-[#e5c8a8]' },
    { name: 'Mes Documents', href: '/documents', icon: FileTextIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' },
    { name: 'Archives', href: '/archives', icon: ArchiveIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'Checklists', href: '/checklist-templates', icon: CheckCircleIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#f5e8d9]' },
    { name: 'Contrats', href: '/contracts', icon: FileTextIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' },
    { name: 'IR Douche', href: '/ir-docs', icon: FolderIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' },
];

// Pages additionnelles basees sur les permissions - Thème cuivre unifié
const permissionBasedPages = [
    {
        permission: 'view_reports',
        page: { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon, color: 'text-[#b87333]', bg: 'bg-[#f5e8d9]' }
    },
    {
        permission: 'manage_clients',
        page: { name: 'Clients', href: '/clients', icon: UsersIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#e5c8a8]' }
    },
    {
        permission: 'view_contracts',
        page: { name: 'Contrats', href: '/contracts', icon: FileTextIcon, color: 'text-[#d4a574]', bg: 'bg-[#f5e8d9]' }
    },
    {
        permission: 'view_invoices',
        page: { name: 'Factures', href: '/invoices', icon: FileTextIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' }
    },
    {
        permission: 'access_catalog',
        page: { name: 'Catalogue', href: '/catalog', icon: FolderIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#f5e8d9]' }
    },
    {
        permission: 'access_admin_vault',
        page: { name: 'Coffre Admin', href: '/admin-vault', icon: LockIcon, color: 'text-[#6d4620]', bg: 'bg-[#e5c8a8]' }
    },
    {
        permission: 'view_all_interventions',
        page: { name: 'Archives', href: '/archives', icon: ArchiveIcon, color: 'text-[#b87333]', bg: 'bg-[#f5e8d9]' }
    },
    {
        permission: 'manage_checklist_templates',
        page: { name: 'Modeles Checklist', href: '/checklist-templates', icon: CheckCircleIcon, color: 'text-[#d4a574]', bg: 'bg-[#e5c8a8]' }
    },
    {
        permission: 'approve_expenses',
        page: { name: 'Valider Depenses', href: '/admin-expenses', icon: DollarSignIcon, color: 'text-[#8b5a2b]', bg: 'bg-[#f5e8d9]' }
    },
    {
        permission: 'approve_leave_requests',
        page: { name: 'Valider Conges', href: '/admin-leaves', icon: SunIcon, color: 'text-[#b87333]', bg: 'bg-[#e5c8a8]' }
    },
];

const MobileMenu = () => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { hasPermission, isAdmin } = usePermissions();

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
