import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { address } from '../../utils/ipAddress';
import { useCachedApi } from '../hooks/useCachedApi';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutDashboard,
  CheckSquare,
  RefreshCw,
  Archive,
  UserPlus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  User,
  Users,
  AlertCircle,
  UserCheck,
  Shield,
  Award,
  Package,
  ClipboardList,
  HelpCircle,
  BarChart2,
  MessageSquare,
  Calendar,
  ListTodo,
  Star,
  X,
  GripVertical,
  RotateCcw,
  Save,
  FileText
} from 'lucide-react';

// Modern AMG Logo Component with Glassmorphism
const AMGLogo = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <div className="flex items-center gap-3">
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-sm opacity-40"></div>
      <img
        src="/assets/AMG LOGO.webp"
        alt="AMG Logo"
        className="relative h-10 w-10 object-contain rounded-xl p-1.5 bg-white shadow-lg"
      />
    </div>
    {!isCollapsed && (
      <div className="flex flex-col">
        <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Ashok Malhotra
        </span>
        <span className="text-xs text-gray-500 font-medium">Group</span>
      </div>
    )}
  </div>
);

// Enhanced Tooltip Component
interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  show: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, show }) => (
  <div className="relative group">
    {children}
    {show && (
      <div className="absolute left-full ml-3 top-1/2 transform -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
        <div className="px-3 py-2 text-xs font-medium rounded-lg shadow-xl whitespace-nowrap bg-gray-900 text-white border border-gray-700">
          {content}
          <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
        </div>
      </div>
    )}
  </div>
);

// Sortable Section Component
interface SortableSectionProps {
  section: string;
  items: any[];
  isCollapsed: boolean;
  counts: any;
  onClose: () => void;
}

const SortableSection: React.FC<SortableSectionProps> = ({
  section,
  items,
  isCollapsed,
  counts,
  onClose,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isCollapsed ? '' : 'mb-6'}`}
    >
      <div className="flex items-center gap-2 mb-2 group/section">
        {!isCollapsed && (
          <>
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover/section:opacity-100"
              aria-label="Drag to reorder"
            >
              <GripVertical size={14} />
            </button>
            <h3 className="px-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 flex-1">
              {section}
            </h3>
          </>
        )}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <Tooltip key={item.path} content={item.label} show={isCollapsed}>
            <NavLink
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex items-center justify-center ${
                      isCollapsed ? 'w-6 h-6' : 'w-5 h-5'
                    } transition-transform duration-200 ${
                      !isActive && 'group-hover:scale-110'
                    }`}
                  >
                    <item.icon
                      size={isCollapsed ? 20 : 18}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </span>
                  {!isCollapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [counts, setCounts] = useState({
    pendingTasks: 0,
    masterTasks: 0,
    myTasks: 0,
    objections: 0,
    myObjections: 0,
    assignedByMe: 0,
    helpTickets: 0,
    complaintsInbox: 0,
  });

  const menuItems = [
    // FMS Section
    { section: 'FMS', icon: Settings, label: 'FMS Templates', path: '/fms-templates', permission: 'canAssignTasks', highlight: true },
    { section: 'FMS', icon: Settings, label: 'Start Project', path: '/start-project', permission: 'canAssignTasks', highlight: true },
    { section: 'FMS', icon: Settings, label: 'FMS Progress', path: '/fms-progress', highlight: true },
    { section: 'FMS', icon: BarChart2, label: 'FMS Dashboard', path: '/fms-dashboard', permission: 'canAssignTasks', highlight: true },
    { section: 'FMS', icon: Settings, label: 'Manage FMS Categories', path: '/fms-categories', requireAdmin: true, highlight: true },

    // Checklists Section
    { section: 'Checklists', icon: ListTodo, label: 'Pending Checklists', path: '/pending-checklists', highlight: true },
    { section: 'Checklists', icon: Calendar, label: 'Checklist Calendar', path: '/checklist-calendar', highlight: true },
    { section: 'Checklists', icon: Users, label: 'Person Dashboard', path: '/checklist-person-dashboard', highlight: true },
    { section: 'Checklists', icon: Settings, label: 'Manage Checklist Categories', path: '/checklist-categories', requireAdmin: true, highlight: true },

    // Tasks Section
    { section: 'Tasks', icon: Star, label: 'My Tasks', path: '/admin-tasks', countKey: 'myTasks', highlight: true, requireAdmin: true },
    { section: 'Tasks', icon: CheckSquare, label: 'Pending Tasks', path: '/pending-tasks', permission: 'canViewTasks', countKey: 'pendingTasks', highlight: true },
    { section: 'Tasks', icon: Archive, label: 'Master Tasks', path: '/master-tasks', permission: 'canViewTasks', countKey: 'masterTasks', highlight: true },

    // Assign Task Section
    { section: 'Assign Task', icon: UserPlus, label: 'Assign Task', path: '/assign-task', permission: 'canAssignTasks', highlight: true },
    { section: 'Assign Task', icon: UserCheck, label: 'Assigned By Me', path: '/assigned-by-me', permission: 'canAssignTasks', countKey: 'assignedByMe', highlight: true },

    // Management Section
    { section: 'Management', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { section: 'Management', icon: Zap, label: 'Performance', path: '/performance' },
    { section: 'Management', icon: Settings, label: 'Admin Panel', path: '/admin', permission: 'canManageUsers' },

    // Workflow Section
    { section: 'Workflow', icon: AlertCircle, label: 'Objections Hub', path: '/objections', countKey: 'myObjections' },
    { section: 'Workflow', icon: AlertCircle, label: 'Objection Approvals', path: '/objection-approvals', countKey: 'objections' },
    { section: 'Workflow', icon: MessageSquare, label: 'Complaints', path: '/complaints', permission: 'canRaiseComplaints', countKey: 'complaintsInbox' },
    { section: 'Workflow', icon: AlertCircle, label: 'Complaints Dashboard', path: '/complaints-dashboard', permission: 'canViewAllComplaints' },
    { section: 'Workflow', icon: HelpCircle, label: 'Help Tickets', path: '/help-tickets', countKey: 'helpTickets' },
    { section: 'Workflow', icon: HelpCircle, label: 'Manage Tickets', path: '/admin-help-tickets', permission: 'canViewAllComplaints' },
    { section: 'Workflow', icon: Package, label: 'New Stationery Request', path: '/stationery-request' },
    { section: 'Workflow', icon: ClipboardList, label: 'My Stationery Requests', path: '/my-stationery-requests' },

    // Analytics Section
    { section: 'Analytics', icon: BarChart2, label: 'Purchase Dashboard', path: '/purchase-dashboard', requireAdmin: true },
    { section: 'Analytics', icon: BarChart2, label: 'Sales Dashboard', path: '/sales-dashboard', requireAdmin: true },

    // Admin Section
    { section: 'Admin', icon: Shield, label: 'Super Admin Management', path: '/super-admin-management', requireSuperAdmin: true, highlight: true },
    { section: 'Admin', icon: Shield, label: 'Audit Logs', path: '/audit-logs', requireSuperAdmin: true },
    { section: 'Admin', icon: Award, label: 'Score Logs', path: '/score-logs', requireSuperAdmin: true },
    { section: 'Admin', icon: FileText, label: 'MIS Report', path: '/mis-report', requireSuperAdmin: true, highlight: true },
  ];

  // Get default section order from menu items
  const getDefaultSectionOrder = useCallback(() => {
    const sections = new Set(menuItems.map(item => item.section));
    return Array.from(sections);
  }, []);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) return;

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${address}/api/users/me/sidebar-preferences`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const savedOrder = response.data.sectionOrder;
        if (savedOrder && savedOrder.length > 0) {
          setSectionOrder(savedOrder);
        } else {
          setSectionOrder(getDefaultSectionOrder());
        }
      } catch (error) {
        console.error('Failed to load sidebar preferences:', error);
        setSectionOrder(getDefaultSectionOrder());
      }
    };

    loadPreferences();
  }, [user?.id, getDefaultSectionOrder]);

  // Save preferences to backend
  const savePreferences = useCallback(async (order: string[]) => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${address}/api/users/me/sidebar-preferences`,
        { sectionOrder: order },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error('Failed to save sidebar preferences:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user?.id]);

  // Reset to default order
  const resetToDefault = useCallback(async () => {
    if (!user?.id) return;

    setIsResetting(true);
    const defaultOrder = getDefaultSectionOrder();
    setSectionOrder(defaultOrder);

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${address}/api/users/me/sidebar-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Failed to reset sidebar preferences:', error);
    } finally {
      setIsResetting(false);
    }
  }, [user?.id, getDefaultSectionOrder]);

  // Build API URLs with memoization
  const countsUrl = useMemo(() => {
    if (!user?.id) return null;
    const countsParams = new URLSearchParams();
    countsParams.append('userId', user.id);
    countsParams.append('assignedById', user.id);
    if (user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'manager') {
      countsParams.append('isAdmin', 'true');
    }
    return `${address}/api/dashboard/counts-optimized?${countsParams}`;
  }, [user?.id, user?.role]);

  const objectionsUrl = useMemo(
    () => (user?.id ? `${address}/api/objections/pending/${user.id}` : null),
    [user?.id]
  );

  const helpTicketsUrl = useMemo(
    () =>
      user?.id
        ? `${address}/api/help-tickets?userId=${user.id}&role=${user?.role}`
        : null,
    [user?.id, user?.role]
  );

  const myObjectionsUrl = useMemo(
    () => (user?.id ? `${address}/api/objections/my/${user.id}` : null),
    [user?.id]
  );

  const complaintsUrl = useMemo(
    () => `${address}/api/complaints?scope=assigned`,
    []
  );

  // Use cached API hooks
  const { data: countsData, refetch: refetchCounts } = useCachedApi<any>(
    countsUrl,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
    { 
      ttl: 1 * 60 * 1000, 
      staleWhileRevalidate: true,
      onError: (error: any) => {
        // Silently handle 401 errors to prevent UI breaking
        if (error?.response?.status !== 401) {
          console.error('Error fetching task counts:', error);
        }
      }
    } // 1 minute cache
  );

  const { data: objectionsData } = useCachedApi<any>(
    objectionsUrl,
    {},
    { ttl: 1 * 60 * 1000, staleWhileRevalidate: true }
  );

  const { data: helpTicketsData } = useCachedApi<any>(
    helpTicketsUrl,
    {},
    { ttl: 1 * 60 * 1000, staleWhileRevalidate: true }
  );

  const { data: myObjectionsData } = useCachedApi<any>(
    myObjectionsUrl,
    {},
    { ttl: 1 * 60 * 1000, staleWhileRevalidate: true }
  );

  const { data: complaintsData } = useCachedApi<any>(
    complaintsUrl,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    },
    { ttl: 1 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Calculate counts from cached data
  useEffect(() => {
    if (!user?.id) return;

    const objectionsCount = objectionsData
      ? (objectionsData.regularTasks?.reduce((acc: number, task: any) => {
          return (
            acc +
            (task.objections?.filter((obj: any) => obj.status === 'pending')
              .length || 0)
          );
        }, 0) || 0) +
        (objectionsData.fmsTasks?.reduce((acc: number, project: any) => {
          return (
            acc +
            (project.tasks?.reduce((taskAcc: number, task: any) => {
              return (
                taskAcc +
                (task.objections?.filter((obj: any) => obj.status === 'pending')
                  .length || 0)
              );
            }, 0) || 0)
          );
        }, 0) || 0)
      : 0;

    const helpTicketsCount = helpTicketsData ? helpTicketsData.length : 0;
    const myObjections = myObjectionsData
      ? (myObjectionsData.regular?.length || 0) +
        (myObjectionsData.fms?.length || 0)
      : 0;
    const complaintsInbox = complaintsData
      ? Array.isArray(complaintsData) ? complaintsData.length : 0
      : 0;

    setCounts({
      pendingTasks: countsData?.pendingTasks || 0,
      masterTasks: countsData?.totalTasks || 0,
      myTasks: countsData?.totalTasks || 0,
      assignedByMe: countsData?.assignedByMe?.total || 0,
      objections: objectionsCount,
      myObjections,
      helpTickets: helpTicketsCount,
      complaintsInbox,
    });
  }, [
    countsData,
    objectionsData,
    helpTicketsData,
    myObjectionsData,
    complaintsData,
    user?.id,
  ]);

  // Listen for task updates and refresh counts
  useEffect(() => {
    const handleTaskUpdate = () => {
      refetchCounts(true); // Force refresh on task updates
    };

    window.addEventListener('taskDeleted', handleTaskUpdate);
    window.addEventListener('taskUpdated', handleTaskUpdate);

    return () => {
      window.removeEventListener('taskDeleted', handleTaskUpdate);
      window.removeEventListener('taskUpdated', handleTaskUpdate);
    };
  }, [refetchCounts]);

  const filteredMenuItems = menuItems.filter((item) => {
    if (user?.role === 'superadmin') return true;
    if (item.requireSuperAdmin && user?.role !== 'superadmin') return false;
    if (
      item.requireAdmin &&
      !['admin', 'superadmin'].includes(user?.role || '')
    )
      return false;
    if (item.requireRole && user?.role !== item.requireRole) return false;
    if (item.permission) {
      const hasPermission =
        user?.permissions?.[item.permission as keyof typeof user.permissions];
      // Allow PC role to access specific permission items
      const pcAllowedPermissions = [
        'canAssignTasks',
        'canViewTasks',
        'canViewAllChecklists',
        'canViewAllTeamTasks',
      ];

      if (!hasPermission && !['admin', 'superadmin'].includes(user?.role || '')) {
        // PC role gets special access to specific permissions
        if (user?.role === 'pc' && pcAllowedPermissions.includes(item.permission)) {
          return true;
        }
        return false;
      }
    }
    return true;
  });

  const groupedMenuItems = filteredMenuItems.reduce((acc, item) => {
    const section = item.section || 'Other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  // Get ordered sections based on user preferences
  const orderedSections = useMemo(() => {
    if (sectionOrder.length === 0) {
      return Object.keys(groupedMenuItems);
    }

    // Merge saved order with any new sections
    const allSections = new Set([
      ...sectionOrder,
      ...Object.keys(groupedMenuItems),
    ]);
    return Array.from(allSections).filter((section) =>
      groupedMenuItems[section]
    );
  }, [sectionOrder, groupedMenuItems]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // Auto-save on drag end
        savePreferences(newOrder);
        return newOrder;
      });
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile overlay with blur */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300 ease-in-out transform lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          width: isCollapsed ? '4.5rem' : '18rem',
          minWidth: isCollapsed ? '4.5rem' : '18rem',
          maxWidth: isCollapsed ? '4.5rem' : '18rem',
        }}
      >
        {/* Modern Glassmorphism Background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 backdrop-blur-xl border-r border-gray-200/60 shadow-2xl"></div>

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
            <AMGLogo isCollapsed={isCollapsed} />

            {/* Desktop toggle */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-600 transition-all duration-200 hover:scale-110 shadow-sm"
              aria-label="Toggle sidebar"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Mobile close */}
            <button
              onClick={onClose}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 text-red-600 transition-all duration-200"
              aria-label="Close sidebar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Control Buttons - Only show when not collapsed */}
          {!isCollapsed && (
            <div className="px-3 py-2 border-b border-gray-200/50 bg-white/30 backdrop-blur-sm flex gap-2">
              <button
                onClick={resetToDefault}
                disabled={isResetting}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 text-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reset to default order"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
              {isSaving && (
                <div className="flex items-center justify-center px-3 py-2 text-xs text-green-600">
                  <Save size={14} className="animate-pulse" />
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            {orderedSections.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedSections}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedSections.map((section) => (
                    <SortableSection
                      key={section}
                      section={section}
                      items={groupedMenuItems[section] || []}
                      isCollapsed={isCollapsed}
                      counts={counts}
                      onClose={onClose}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              // Fallback if no sections loaded yet
              Object.entries(groupedMenuItems).map(([section, items]) => (
                <div key={section} className="mb-6">
                  {!isCollapsed && (
                    <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {section}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {items.map((item) => (
                      <Tooltip key={item.path} content={item.label} show={isCollapsed}>
                        <NavLink
                          to={item.path}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                              isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2'
                            } ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:text-gray-900'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={`flex items-center justify-center ${
                                  isCollapsed ? 'w-6 h-6' : 'w-5 h-5'
                                } transition-transform duration-200 ${
                                  !isActive && 'group-hover:scale-110'
                                }`}
                              >
                                <item.icon
                                  size={isCollapsed ? 20 : 18}
                                  strokeWidth={isActive ? 2.5 : 2}
                                />
                              </span>
                              {!isCollapsed && (
                                <span className="flex-1 truncate">{item.label}</span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))
            )}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
