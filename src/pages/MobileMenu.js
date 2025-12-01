import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
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
                    Déconnexion
                </button>
            </div>
        </div>
    );
};

export default MobileMenu;
