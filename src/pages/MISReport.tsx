import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import {
  Calendar, Users, CheckSquare, Settings, HelpCircle, ListTodo,
  GripVertical, X, Filter, Download, RefreshCw, TrendingUp, TrendingDown,
  BarChart3, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { address } from '../../utils/ipAddress';

// Widget Types
type WidgetType = 'tasks-overview' | 'tasks-by-person' | 'tasks-by-type' | 'tasks-by-status' |
  'fms-overview' | 'fms-by-person' | 'fms-step-breakdown' |
  'checklist-overview' | 'checklist-by-person' |
  'help-tickets-overview' | 'help-tickets-by-person';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large';
}

interface MISReportData {
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  tasks: {
    total: number;
    oneOff: number;
    cyclic: number;
    byPerson: Array<{
      userId: string;
      username: string;
      email: string;
      total: number;
      oneOff: number;
      cyclic: number;
      pending: number;
      'in-progress': number;
      completed: number;
      overdue: number;
    }>;
    byStatus: {
      pending: number;
      'in-progress': number;
      completed: number;
      overdue: number;
    };
    byType: {
      'one-time': number;
      daily: number;
      weekly: number;
      monthly: number;
      quarterly: number;
      yearly: number;
    };
  };
  fms: {
    total: number;
    inProgress: number;
    completed: number;
    byPerson: Array<{
      userId: string;
      username: string;
      email: string;
      total: number;
      inProgress: number;
      completed: number;
      pendingSteps: number[];
    }>;
    stepStatusBreakdown: Record<string, number>;
  };
  checklists: {
    total: number;
    done: number;
    notDone: number;
    byPerson: Array<{
      userId: string;
      username: string;
      email: string;
      total: number;
      done: number;
      notDone: number;
    }>;
  };
  helpTickets: {
    total: number;
    open: number;
    'in-progress': number;
    closed: number;
    byPerson: Array<{
      userId: string;
      username: string;
      email: string;
      total: number;
      open: number;
      'in-progress': number;
      closed: number;
    }>;
  };
  users: Array<{
    _id: string;
    username: string;
    email: string;
  }>;
}

// Available Widgets Configuration
const AVAILABLE_WIDGETS: Widget[] = [
  { id: 'tasks-overview', type: 'tasks-overview', title: 'Tasks Overview', size: 'medium' },
  { id: 'tasks-by-person', type: 'tasks-by-person', title: 'Tasks by Person', size: 'large' },
  { id: 'tasks-by-type', type: 'tasks-by-type', title: 'Tasks by Type', size: 'medium' },
  { id: 'tasks-by-status', type: 'tasks-by-status', title: 'Tasks by Status', size: 'medium' },
  { id: 'fms-overview', type: 'fms-overview', title: 'FMS Overview', size: 'medium' },
  { id: 'fms-by-person', type: 'fms-by-person', title: 'FMS by Person', size: 'large' },
  { id: 'fms-step-breakdown', type: 'fms-step-breakdown', title: 'FMS Step Breakdown', size: 'medium' },
  { id: 'checklist-overview', type: 'checklist-overview', title: 'Checklist Overview', size: 'medium' },
  { id: 'checklist-by-person', type: 'checklist-by-person', title: 'Checklist by Person', size: 'large' },
  { id: 'help-tickets-overview', type: 'help-tickets-overview', title: 'Help Tickets Overview', size: 'medium' },
  { id: 'help-tickets-by-person', type: 'help-tickets-by-person', title: 'Help Tickets by Person', size: 'large' },
];

// Sortable Widget Item
interface SortableWidgetProps {
  widget: Widget;
  data: MISReportData | null;
  onRemove: (id: string) => void;
}

const SortableWidget: React.FC<SortableWidgetProps> = ({ widget, data, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getColSpan = () => {
    if (widget.size === 'small') return 'md:col-span-1 lg:col-span-1';
    if (widget.size === 'medium') return 'md:col-span-2 lg:col-span-2';
    return 'md:col-span-2 lg:col-span-3 xl:col-span-4';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 col-span-1 ${getColSpan()}`}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          {widget.title}
        </h3>
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Drag to reorder"
          >
            <GripVertical size={18} />
          </button>
          <button
            onClick={() => onRemove(widget.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Remove widget"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <WidgetContent widget={widget} data={data} />
    </div>
  );
};

// Widget Content Renderer
const WidgetContent: React.FC<{ widget: Widget; data: MISReportData | null }> = ({ widget, data }) => {
  if (!data) {
    return <div className="text-gray-500 text-center py-8">No data available</div>;
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  switch (widget.type) {
    case 'tasks-overview':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{data.tasks.total}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Tasks</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{data.tasks.oneOff}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">One-Off</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/20 p-5 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{data.tasks.cyclic}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Cyclic</div>
            </div>
          </div>
        </div>
      );

    case 'tasks-by-person':
      const tasksByPersonData = data.tasks.byPerson
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(person => ({
          name: person.username,
          total: person.total,
          oneOff: person.oneOff,
          cyclic: person.cyclic,
          completed: person.completed,
          pending: person.pending
        }));

      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tasksByPersonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total" />
            <Bar dataKey="completed" fill="#10b981" name="Completed" />
            <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'tasks-by-type':
      const tasksByTypeData = Object.entries(data.tasks.byType)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => ({ name: type, value: count }));

      return (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={tasksByTypeData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {tasksByTypeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'tasks-by-status':
      const tasksByStatusData = Object.entries(data.tasks.byStatus)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({ name: status, value: count }));

      return (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={tasksByStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {tasksByStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'fms-overview':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{data.fms.total}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total FMS</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 p-5 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-sm">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">{data.fms.inProgress}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">In Progress</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{data.fms.completed}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed</div>
            </div>
          </div>
        </div>
      );

    case 'fms-by-person':
      const fmsByPersonData = data.fms.byPerson
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(person => ({
          name: person.username,
          total: person.total,
          inProgress: person.inProgress,
          completed: person.completed
        }));

      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fmsByPersonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total" />
            <Bar dataKey="inProgress" fill="#f59e0b" name="In Progress" />
            <Bar dataKey="completed" fill="#10b981" name="Completed" />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'fms-step-breakdown':
      const stepBreakdownData = Object.entries(data.fms.stepStatusBreakdown)
        .map(([step, count]) => ({ step: `Step ${step}`, count }))
        .sort((a, b) => parseInt(a.step.replace('Step ', '')) - parseInt(b.step.replace('Step ', '')));

      return (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={stepBreakdownData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="step" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'checklist-overview':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{data.checklists.total}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{data.checklists.done}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Done</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 p-5 rounded-lg border border-red-200 dark:border-red-800 shadow-sm">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">{data.checklists.notDone}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Not Done</div>
            </div>
          </div>
        </div>
      );

    case 'checklist-by-person':
      const checklistByPersonData = data.checklists.byPerson
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(person => ({
          name: person.username,
          total: person.total,
          done: person.done,
          notDone: person.notDone
        }));

      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={checklistByPersonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total" />
            <Bar dataKey="done" fill="#10b981" name="Done" />
            <Bar dataKey="notDone" fill="#ef4444" name="Not Done" />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'help-tickets-overview':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{data.helpTickets.total}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-900/20 p-5 rounded-lg border border-yellow-200 dark:border-yellow-800 shadow-sm">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">{data.helpTickets.open}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Open</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 p-5 rounded-lg border border-orange-200 dark:border-orange-800 shadow-sm">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">{data.helpTickets['in-progress']}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">In Progress</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/20 p-5 rounded-lg border border-green-200 dark:border-green-800 shadow-sm">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{data.helpTickets.closed}</div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Closed</div>
            </div>
          </div>
        </div>
      );

    case 'help-tickets-by-person':
      const helpTicketsByPersonData = data.helpTickets.byPerson
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(person => ({
          name: person.username,
          total: person.total,
          open: person.open,
          'in-progress': person['in-progress'],
          closed: person.closed
        }));

      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={helpTicketsByPersonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total" />
            <Bar dataKey="open" fill="#f59e0b" name="Open" />
            <Bar dataKey="in-progress" fill="#f97316" name="In Progress" />
            <Bar dataKey="closed" fill="#10b981" name="Closed" />
          </BarChart>
        </ResponsiveContainer>
      );

    default:
      return <div>Unknown widget type</div>;
  }
};

const MISReport: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [reportData, setReportData] = useState<MISReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWidgets, setActiveWidgets] = useState<Widget[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved widget configuration from localStorage
  useEffect(() => {
    const savedWidgets = localStorage.getItem('mis-report-widgets');
    if (savedWidgets) {
      try {
        const widgets = JSON.parse(savedWidgets);
        setActiveWidgets(widgets);
      } catch (e) {
        console.error('Error loading saved widgets:', e);
      }
    }
  }, []);

  // Save widget configuration to localStorage
  useEffect(() => {
    if (activeWidgets.length > 0) {
      localStorage.setItem('mis-report-widgets', JSON.stringify(activeWidgets));
    }
  }, [activeWidgets]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const year = getYear(selectedMonth);
      const month = getMonth(selectedMonth) + 1;

      const response = await axios.get(`${address}/api/mis-report/data`, {
        params: { year, month },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setReportData(response.data);
      } else {
        setError('Failed to fetch report data');
      }
    } catch (err: any) {
      console.error('Error fetching MIS report:', err);
      setError(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchReportData();
    }
  }, [selectedMonth, user, fetchReportData]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setActiveWidgets((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addWidget = (widget: Widget) => {
    if (!activeWidgets.find(w => w.id === widget.id)) {
      setActiveWidgets([...activeWidgets, widget]);
    }
    setShowWidgetSelector(false);
  };

  const removeWidget = (id: string) => {
    setActiveWidgets(activeWidgets.filter(w => w.id !== id));
  };

  const getAvailableWidgets = () => {
    return AVAILABLE_WIDGETS.filter(w => !activeWidgets.find(aw => aw.id === w.id));
  };

  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-gray-600">This section is only available to Super Admins.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                MIS Report
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Management Information System - Monthly Reports
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="text-gray-500" size={20} />
                <input
                  type="month"
                  value={format(selectedMonth, 'yyyy-MM')}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number);
                    setSelectedMonth(new Date(year, month - 1));
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                />
              </div>
              <button
                onClick={fetchReportData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={() => setShowWidgetSelector(!showWidgetSelector)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <BarChart3 size={18} />
                Add Widget
              </button>
            </div>
          </div>

          {reportData && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Period: {format(new Date(reportData.period.startDate), 'MMMM yyyy')}
            </div>
          )}
        </div>

        {/* Widget Selector */}
        {showWidgetSelector && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Available Widgets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getAvailableWidgets().map(widget => (
                <button
                  key={widget.id}
                  onClick={() => addWidget(widget)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                >
                  <div className="font-medium text-gray-800 dark:text-gray-200">{widget.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {widget.size === 'small' ? 'Small' : widget.size === 'medium' ? 'Medium' : 'Large'} widget
                  </div>
                </button>
              ))}
            </div>
            {getAvailableWidgets().length === 0 && (
              <p className="text-gray-500 text-center py-4">All widgets are already added</p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report data...</p>
          </div>
        )}

        {/* Widgets Grid */}
        {!loading && activeWidgets.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={activeWidgets.map(w => w.id)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
                {activeWidgets.map(widget => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    data={reportData}
                    onRemove={removeWidget}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Empty State */}
        {!loading && activeWidgets.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
            <BarChart3 size={64} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
              No Widgets Added
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click "Add Widget" to start building your MIS report dashboard
            </p>
            <button
              onClick={() => setShowWidgetSelector(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Add Your First Widget
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MISReport;

