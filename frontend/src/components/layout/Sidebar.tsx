'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Monitor,
  Image,
  List,
  Settings,
  LogOut,
  Building2,
  UserCog,
  FileText,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  staffRoles?: string[];
}

interface SidebarProps {
  user: {
    role: string;
    staffRole?: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const sidebarItems: SidebarItem[] = [
    // Super Admin only
    {
      label: 'Dashboard',
      href: '/super-admin/dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN'],
    },
    {
      label: 'Manage Clients',
      href: '/super-admin/clients',
      icon: Building2,
      roles: ['SUPER_ADMIN'],
    },
    {
      label: 'Global Analytics',
      href: '/super-admin/analytics',
      icon: BarChart3,
      roles: ['SUPER_ADMIN'],
    },

    // Client Admin
    {
      label: 'Dashboard',
      href: '/client/dashboard',
      icon: LayoutDashboard,
      roles: ['CLIENT_ADMIN'],
    },
    {
      label: 'User Admins',
      href: '/client/users',
      icon: UserCog,
      roles: ['CLIENT_ADMIN'],
    },
    {
      label: 'Displays',
      href: '/client/displays',
      icon: Monitor,
      roles: ['CLIENT_ADMIN'],
    },
    {
      label: 'Analytics',
      href: '/client/analytics',
      icon: BarChart3,
      roles: ['CLIENT_ADMIN'],
    },

    // User Admin
    {
      label: 'Dashboard',
      href: '/user/dashboard',
      icon: LayoutDashboard,
      roles: ['USER_ADMIN'],
    },
    {
      label: 'Displays',
      href: '/user/displays',
      icon: Monitor,
      roles: ['USER_ADMIN', 'STAFF'],
      staffRoles: ['DISPLAY_MANAGER', 'BROADCAST_MANAGER'],
    },
    {
      label: 'Media Library',
      href: '/user/media',
      icon: Image,
      roles: ['USER_ADMIN', 'STAFF'],
      staffRoles: ['BROADCAST_MANAGER', 'CONTENT_MANAGER'],
    },
    {
      label: 'Playlists',
      href: '/user/playlists',
      icon: List,
      roles: ['USER_ADMIN', 'STAFF'],
      staffRoles: ['BROADCAST_MANAGER'],
    },
    {
      label: 'Layouts',
      href: '/user/layouts',
      icon: FileText,
      roles: ['USER_ADMIN', 'STAFF'],
      staffRoles: ['BROADCAST_MANAGER'],
    },
    {
      label: 'Schedules',
      href: '/user/schedules',
      icon: Calendar,
      roles: ['USER_ADMIN', 'STAFF'],
      staffRoles: ['BROADCAST_MANAGER'],
    },
    {
      label: 'Users',
      href: '/user/staff',
      icon: Users,
      roles: ['USER_ADMIN'],
    },

    // Staff - CMS Viewer (read-only)
    {
      label: 'Dashboard',
      href: '/staff/dashboard',
      icon: LayoutDashboard,
      roles: ['STAFF'],
      staffRoles: ['CMS_VIEWER'],
    },
    {
      label: 'View Displays',
      href: '/staff/displays',
      icon: Monitor,
      roles: ['STAFF'],
      staffRoles: ['CMS_VIEWER'],
    },
    {
      label: 'View Media',
      href: '/staff/media',
      icon: Image,
      roles: ['STAFF'],
      staffRoles: ['CMS_VIEWER'],
    },

    // Staff - POP Manager
    {
      label: 'Proof of Play',
      href: '/staff/proof-of-play',
      icon: BarChart3,
      roles: ['STAFF'],
      staffRoles: ['POP_MANAGER'],
    },
  ];

  // Filter items based on user role
  const visibleItems = sidebarItems.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (user.role === 'STAFF' && item.staffRoles) {
      return item.staffRoles.includes(user.staffRole || '');
    }
    return true;
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <aside className="flex w-64 flex-col bg-white shadow-lg border-r border-gray-200 h-screen">
      <div className="flex h-20 items-center justify-center border-b border-gray-200 px-4 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="/signomart-full-logo.png" 
            alt="Signomart" 
            className="h-12 w-12 object-contain"
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0">
              <span className="text-2xl font-bold text-gray-700" style={{ fontFamily: 'Arial, sans-serif', letterSpacing: '-0.5px' }}>SIGNOX</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-12 bg-gray-700"></div>
              <span className="text-[10px] text-gray-600 italic whitespace-nowrap">Digital Signage</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 bg-gray-50 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'signomart-primary shadow-sm'
                  : 'text-gray-700 hover:bg-yellow-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
        <div className="mb-2 px-3 text-xs font-medium signomart-text-muted truncate">
          {user.role === 'STAFF' && user.staffRole
            ? `${user.role} - ${user.staffRole}`
            : user.role}
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50 hover:text-gray-900 mb-2 transition-colors"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">Profile Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">Logout</span>
        </button>
      </div>
    </aside>
  );
}
