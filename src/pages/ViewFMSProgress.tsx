
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckSquare, Clock, AlertCircle, Upload, RotateCcw, Printer, ArrowRight, Users, X, FileText } from 'lucide-react';
import axios from 'axios';
import { address } from '../../utils/ipAddress';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateFormat';

interface Project {
  _id: string;
  projectId: string;
  projectName: string;
  startDate: string;
  status: string;
  fmsId: { fmsName: string };
  tasks: any[];
  createdBy: { username: string };
}

interface MultiLevelTask {
  _id: string;
  title: string;
  description: string;
  assignedBy: { username: string; email: string };
  assignedTo: { username: string; email: string };
  forwardedBy?: { username: string; email: string };
  forwardedAt?: string;
  forwardingHistory: Array<{
    from: { username: string };
    to: { username: string };
    forwardedAt: string;
    remarks: string;
  }>;
  status: string;
  priority: string;
  dueDate: string;
  requiresChecklist: boolean;
  checklistItems: Array<{ id: string; text: string; completed: boolean }>;
  checklistProgress: number;
  createdAt: string;
}

type TaskFilter = 'all' | 'pending' | 'in-progress' | 'completed' | 'overdue';
const VALID_FILTERS: TaskFilter[] = ['all', 'pending', 'in-progress', 'completed', 'overdue'];

const normalizeTasks = (tasks: any[] | undefined | null): any[] => {
  return Array.isArray(tasks) ? tasks : [];
};

const ViewFMSProgress: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initialFilterParam = params.get('view');
  const initialFilter = VALID_FILTERS.includes((initialFilterParam as TaskFilter) || 'all')
    ? (initialFilterParam as TaskFilter)
    : 'all';
  const [activeTab, setActiveTab] = useState<'fms' | 'multilevel'>('fms');
  const [projects, setProjects] = useState<Project[]>([]);
  const [multiLevelTasks, setMultiLevelTasks] = useState<MultiLevelTask[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMultiLevelTask, setSelectedMultiLevelTask] = useState<MultiLevelTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskStatus, setTaskStatus] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [taskPlannedDate, setTaskPlannedDate] = useState('');
  const [forwardTo, setForwardTo] = useState('');
  const [forwardDate, setForwardDate] = useState('');
  const [forwardRemarks, setForwardRemarks] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [showMultiLevelActionModal, setShowMultiLevelActionModal] = useState(false);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [completingTask, setCompletingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(initialFilter);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassigningTask, setReassigningTask] = useState<{projectId: string, taskIndex: number} | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [displayMode, setDisplayMode] = useState<'name' | 'designation' | 'both'>('name');

  // Fetch display configuration
  useEffect(() => {
    const fetchDisplayConfig = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${address}/api/designations/fms-display-config`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setDisplayMode(response.data.config.displayMode);
        }
      } catch (error) {
        console.error('Error fetching display config:', error);
      }
    };
    fetchDisplayConfig();
  }, []);

  // Format user display based on display mode
  const formatUserDisplay = useCallback((user: any): string => {
    if (!user || typeof user !== 'object') {
      return 'Unknown';
    }

    const username = user.username || user.name || user.email || '';
    const designation = user.designation || '';

    if (displayMode === 'name') {
      return username || 'Unknown';
    } else if (displayMode === 'designation') {
      return designation || username || 'Unknown';
    } else { // both
      if (designation) {
        return `${username} - ${designation}`;
      }
      return username || 'Unknown';
    }
  }, [displayMode]);

  useEffect(() => {
    const view = new URLSearchParams(location.search).get('view');
    if (view && VALID_FILTERS.includes(view as TaskFilter)) {
      setTaskFilter(view as TaskFilter);
    }
  }, [location.search]);

  useEffect(() => {
    fetchProjects();
    fetchMultiLevelTasks();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    const refreshedProject = projects.find(project => project.projectId === selectedProject.projectId);
    if (refreshedProject && refreshedProject !== selectedProject) {
      setSelectedProject(refreshedProject);
    }
  }, [projects, selectedProject?.projectId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${address}/api/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      // Super admin should see all projects
      const isSuperAdmin = user?.role === 'superadmin';
      const userId = isSuperAdmin ? 'all' : user?.id;
      const response = await axios.get(`${address}/api/projects?userId=${userId}&role=${user?.role}`);
      if (response.data.success) {
        setProjects(response.data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMultiLevelTasks = async () => {
    try {
      // Super admin should see all multi-level tasks
      const isSuperAdmin = user?.role === 'superadmin';
      const userId = isSuperAdmin ? 'all' : user?.id;
      const response = await axios.get(`${address}/api/tasks/multi-level?userId=${userId}&role=${user?.role}`);
      setMultiLevelTasks(response.data);
    } catch (error) {
      console.error('Error fetching multi-level tasks:', error);
    }
  };

  const handleForwardTask = async () => {
    if (!selectedMultiLevelTask) return;

    // Validation
    if (!forwardTo) {
      alert('Please select a user to forward this task to');
      return;
    }
    if (!forwardDate) {
      alert('Please select a due date for the forwarded task');
      return;
    }
    if (!forwardRemarks.trim()) {
      alert('Please provide remarks for forwarding');
      return;
    }

    setForwarding(true);
    try {
      const response = await axios.post(
        `${address}/api/tasks/${selectedMultiLevelTask._id}/forward`,
        {
          forwardTo,
          remarks: forwardRemarks,
          dueDate: forwardDate
        }
      );

      if (response.data) {
        alert('Task forwarded successfully!');
        setShowForwardModal(false);
        setForwardTo('');
        setForwardDate('');
        setForwardRemarks('');
        setSelectedMultiLevelTask(null);
        fetchMultiLevelTasks();
      }
    } catch (error: any) {
      console.error('Error forwarding task:', error);
      alert(error.response?.data?.message || 'Failed to forward task');
    } finally {
      setForwarding(false);
    }
  };

  const handleCompleteMultiLevelTask = async () => {
    if (!selectedMultiLevelTask) return;

    if (!completionRemarks.trim()) {
      alert('Please provide remarks before closing this task.');
      return;
    }

    setCompletingTask(true);
    try {
      const response = await axios.post(
        `${address}/api/tasks/${selectedMultiLevelTask._id}/complete`,
        {
          completionRemarks: completionRemarks.trim(),
          completedBy: user?.id
        }
      );

      if (response.data) {
        alert('Task marked as completed!');
        setShowMultiLevelActionModal(false);
        setCompletionRemarks('');
        setSelectedMultiLevelTask(null);
        fetchMultiLevelTasks();
      }
    } catch (error: any) {
      console.error('Error completing multi-level task:', error);
      alert(error.response?.data?.message || 'Failed to complete task');
    } finally {
      setCompletingTask(false);
    }
  };

  const handleReassignTask = async () => {
    if (!reassigningTask || !reassignTo || !reassignReason.trim()) {
      alert('Please select a new assignee and provide a reason');
      return;
    }

    setReassigning(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${address}/api/projects/${reassigningTask.projectId}/tasks/${reassigningTask.taskIndex}/reassign`,
        {
          reassignedTo: reassignTo,
          reason: reassignReason.trim()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      alert('Task reassigned successfully!');
      setShowReassignModal(false);
      setReassigningTask(null);
      setReassignTo('');
      setReassignReason('');
      
      // Refresh projects
      fetchProjects();
      if (selectedProject) {
        const refreshedProject = projects.find(p => p.projectId === selectedProject.projectId);
        if (refreshedProject) {
          setSelectedProject(refreshedProject);
        }
      }
    } catch (error: any) {
      console.error('Error reassigning task:', error);
      alert(error.response?.data?.message || 'Failed to reassign task');
    } finally {
      setReassigning(false);
    }
  };

  const handleTaskUpdate = async () => {
    if (!selectedTask || !selectedProject) return;

    // Validation: If task requires checklist, ensure all items are completed
    if (selectedTask.requiresChecklist && selectedTask.checklistItems) {
      const allCompleted = selectedTask.checklistItems.every((item: any) => item.completed);
      if (!allCompleted && taskStatus === 'Done') {
        alert('Please complete all checklist items before marking task as Done');
        return;
      }
    }

    const normalizedWhenType = selectedTask.whenType?.toLowerCase();
    const needsPlannedDate =
      normalizedWhenType === 'ask-on-completion' &&
      (
        selectedTask.status === 'Awaiting Date' ||
        taskStatus === 'Done' ||
        !selectedTask.plannedDueDate
      );

    if (needsPlannedDate && !taskPlannedDate) {
      alert('Please select a planned date before proceeding.');
      return;
    }

    if (taskStatus === 'Done' && selectedTask.requireAttachments && selectedTask.mandatoryAttachments) {
      const existingAttachments = Array.isArray(selectedTask.attachments) ? selectedTask.attachments.length : 0;
      if (existingAttachments + files.length === 0) {
        alert('Attachments are mandatory for this step. Please upload at least one file.');
        return;
      }
    }

    try {
      let uploadedFiles: any[] = [];
      
      // Upload files first if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const uploadResponse = await axios.post(`${address}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadResponse.data.files) {
          uploadedFiles = uploadResponse.data.files.map((f: any) => ({
            filename: f.filename,
            originalName: f.originalName,
            path: f.path,
            size: f.size,
            uploadedBy: user?.id,
            uploadedAt: new Date()
          }));
        }
      }

      const response = await axios.put(
        `${address}/api/projects/${selectedProject.projectId}/tasks/${selectedTask.index}`,
        {
          status: taskStatus,
          completedBy: user?.id,
          notes: taskNotes,
          attachments: uploadedFiles,
          checklistItems: selectedTask.checklistItems,
          plannedDueDate: taskPlannedDate || undefined
        }
      );

      if (response.data.success) {
        alert('Task updated successfully!');
        const wasCompleting = taskStatus === 'Done';
        const currentTaskIndex = selectedTask?.index;
        const currentProjectId = selectedProject?.projectId;
        
        await fetchProjects();
        
        // If we just completed a step, check if the next step needs a date
        if (wasCompleting && currentTaskIndex !== undefined && currentProjectId && selectedProject?.fmsId) {
          const fmsSteps = selectedProject.fmsId.steps || [];
          const nextStepIndex = currentTaskIndex + 1;
          
          // Check if next step has ask-on-completion
          if (nextStepIndex < fmsSteps.length) {
            const nextStep = fmsSteps[nextStepIndex];
            if (nextStep.whenType === 'ask-on-completion') {
              // Refetch to get updated project with next task in 'Awaiting Date' status
              const projectResponse = await axios.get(`${address}/api/projects?userId=${user?.id}&role=${user?.role}`);
              if (projectResponse.data.success) {
                const updatedProjects = projectResponse.data.projects;
                const updatedProject = updatedProjects.find((p: Project) => p.projectId === currentProjectId);
                if (updatedProject && nextStepIndex < updatedProject.tasks.length) {
                  const nextTask = updatedProject.tasks[nextStepIndex];
                  if (nextTask.status === 'Awaiting Date') {
                    // Automatically open the next task for date input
                    setTimeout(() => {
                      setSelectedProject(updatedProject);
                      setSelectedTask({ ...nextTask, index: nextStepIndex });
                      setTaskStatus('Awaiting Date');
                      setTaskPlannedDate('');
                      setTaskNotes('');
                      setFiles([]);
                    }, 500);
                    return; // Don't clear the selected task
                  }
                }
              }
            }
          }
        }
        
        // Clear selection if not opening next task
        setSelectedTask(null);
        setTaskStatus('');
        setTaskNotes('');
        setFiles([]);
        setTaskPlannedDate('');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Awaiting Date': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const calculateProgress = (tasks: any[]) => {
    const list = normalizeTasks(tasks);
    const completed = list.filter(t => t?.status === 'Done').length;
    return list.length > 0 ? Math.round((completed / list.length) * 100) : 0;
  };

  // Add a helper function to check if a step can be updated
  const canUpdateStep = (currentIndex: number, tasks: any[]): boolean => {
    // First step can always be updated
    if (currentIndex === 0) return true;
    
    // For other steps, check if previous step is 'Done'
    const previousStep = tasks[currentIndex - 1];
    return previousStep && previousStep.status === 'Done';
  };

  const matchesFilter = (task: any, filter: TaskFilter) => {
    if (!task) return false;
    const status = (task.status || '').toLowerCase();
    const plannedDate = task.plannedDueDate ? new Date(task.plannedDueDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = plannedDate && plannedDate < today && status !== 'done';

    const isPendingStatus = ['pending', 'not started', 'awaiting date'].includes(status);
    const hasValidDueDate = Boolean(plannedDate);
    const isPastOrToday = plannedDate ? plannedDate <= today : false;

    switch (filter) {
      case 'pending':
        if (status === 'awaiting date') {
          return hasValidDueDate ? isPastOrToday : false;
        }
        return isPendingStatus && hasValidDueDate && isPastOrToday;
      case 'in-progress':
        return status === 'in progress';
      case 'completed':
        return status === 'done';
      case 'overdue':
        return isOverdue;
      default:
        return true;
    }
  };

  const filteredProjects = useMemo(() => {
    if (taskFilter === 'all') return projects;
    return projects.filter(project => {
      const tasks = normalizeTasks(project.tasks);
      return tasks.some(task => matchesFilter(task, taskFilter));
    });
  }, [projects, taskFilter]);

  useEffect(() => {
    if (!selectedProject && filteredProjects.length > 0) {
      setSelectedProject(filteredProjects[0]);
    }
  }, [filteredProjects, selectedProject]);

  useEffect(() => {
    if (selectedProject && taskFilter !== 'all') {
      const stillValid = normalizeTasks(selectedProject.tasks).some(task => matchesFilter(task, taskFilter));
      if (!stillValid) {
        setSelectedProject(null);
      }
    }
  }, [selectedProject, taskFilter]);

  const fmsStats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    let totalTasks = 0;

    projects.forEach(project => {
      const tasks = normalizeTasks(project.tasks);
      tasks.forEach(task => {
        totalTasks++;
        const status = (task.status || '').toLowerCase();
        const isOverdue = task.plannedDueDate && new Date(task.plannedDueDate) < new Date() && status !== 'done';
        if (isOverdue) overdue++;
        if (status === 'done') completed++;
        else if (status === 'in progress') inProgress++;
        else pending++;
      });
    });

    return {
      totalProjects: projects.length,
      totalTasks,
      pending,
      inProgress,
      completed,
      overdue
    };
  }, [projects]);

  // Get updatable pending steps - show all pending steps with due dates that can be updated
  const updatablePendingSteps = useMemo(() => {
    if (!user) return [];
    const items: Array<{
      projectId: string;
      projectName: string;
      project: Project;
      task: any;
      taskIndex: number;
      isOverdue: boolean;
      fmsName: string;
    }> = [];

    projects.forEach(project => {
      const tasks = normalizeTasks(project.tasks);
      tasks.forEach((task, index) => {
        // Check if user is assigned to this task
        // Handle both array (backward compatibility) and single who
        const whoArray = Array.isArray(task.who) ? task.who : (task.who ? [task.who] : []);
        const assignedToUser = whoArray.some((w: any) => {
          const userId = typeof w === 'object' && w !== null ? (w._id || w) : w;
          return userId?.toString() === user.id?.toString();
        });
        if (!assignedToUser) return;
        
        // Check if task is done - skip completed tasks
        if (task.status === 'Done') return;
        
        // Check if task is pending (Pending, Not Started, Awaiting Date, or In Progress)
        const status = (task.status || '').toLowerCase();
        const isPendingStatus = ['pending', 'not started', 'awaiting date', 'in progress'].includes(status);
        if (!isPendingStatus) return;
        
        // Check if task has a due date - this is required to show in dashboard
        if (!task.plannedDueDate) return;
        
        // Check if this step can be updated (Update button would be shown)
        // This means previous step is done OR it's the first step
        if (!canUpdateStep(index, tasks)) return;
        
        // Calculate if overdue (for sorting purposes)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.plannedDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today;
        
        items.push({
          projectId: project.projectId,
          projectName: project.projectName,
          project,
          task,
          taskIndex: index,
          isOverdue,
          fmsName: project.fmsId?.fmsName || 'Unknown FMS'
        });
      });
    });

    return items.sort((a, b) => {
      // Overdue items first
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      // Then by due date (earliest first)
      const aDate = new Date(a.task.plannedDueDate || 0).getTime();
      const bDate = new Date(b.task.plannedDueDate || 0).getTime();
      return aDate - bDate;
    });
  }, [projects, user]);

  const visibleTasks = useMemo(() => {
    if (!selectedProject) return [];
    return normalizeTasks(selectedProject.tasks)
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => taskFilter === 'all' || matchesFilter(task, taskFilter));
  }, [selectedProject, taskFilter]);

  const filterOptions = useMemo(() => ([
    {
      value: 'all' as TaskFilter,
      label: 'All Steps',
      description: 'Every step in your projects',
      count: fmsStats.totalTasks,
      gradient: 'from-slate-600 to-slate-800',
      icon: <RotateCcw size={18} />,
    },
    {
      value: 'pending' as TaskFilter,
      label: 'Pending',
      description: 'Not started or awaiting date',
      count: fmsStats.pending,
      gradient: 'from-amber-500 to-orange-500',
      icon: <Clock size={18} />,
    },
    {
      value: 'in-progress' as TaskFilter,
      label: 'In Progress',
      description: 'Actively being worked on',
      count: fmsStats.inProgress,
      gradient: 'from-indigo-500 to-blue-600',
      icon: <Users size={18} />,
    },
    {
      value: 'completed' as TaskFilter,
      label: 'Completed',
      description: 'Finished steps',
      count: fmsStats.completed,
      gradient: 'from-emerald-500 to-teal-500',
      icon: <CheckSquare size={18} />,
    },
    {
      value: 'overdue' as TaskFilter,
      label: 'Overdue',
      description: 'Past due date, needs attention',
      count: fmsStats.overdue,
      gradient: 'from-rose-500 to-red-600',
      icon: <AlertCircle size={18} />,
    },
  ]), [fmsStats]);

  const handleFilterChange = (value: TaskFilter) => {
    setTaskFilter(value);
    const searchParams = new URLSearchParams(location.search);
    if (value === 'all') {
      searchParams.delete('view');
    } else {
      searchParams.set('view', value);
    }
    navigate({ pathname: location.pathname, search: searchParams.toString() }, { replace: true });
  };

  const normalizedSelectedWhenType = selectedTask?.whenType?.toLowerCase();
  const shouldShowPlannedDateInput =
    !!selectedTask &&
    normalizedSelectedWhenType === 'ask-on-completion' &&
    (
      selectedTask.status === 'Awaiting Date' ||
      !selectedTask.plannedDueDate ||
      taskStatus === 'Done'
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-text)]">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--color-primary)10' }}>
              <RotateCcw size={20} style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Task Progress Management</h1>
              <p className="text-[var(--color-textSecondary)] text-xs mt-0.5">Track FMS projects and multi-level tasks</p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 flex items-center gap-2 print:hidden"
          >
            <Printer size={18} />
            Print
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Projects', value: fmsStats.totalProjects, accent: 'from-blue-500 to-indigo-600' },
            { label: 'Pending Steps', value: fmsStats.pending, accent: 'from-yellow-500 to-amber-500' },
            { label: 'In Progress', value: fmsStats.inProgress, accent: 'from-purple-500 to-fuchsia-500' },
            { label: 'Overdue', value: fmsStats.overdue, accent: 'from-red-500 to-rose-500' },
          ].map(card => (
            <div key={card.label} className={`p-3 rounded-xl text-white bg-gradient-to-br ${card.accent} shadow-lg`}>
              <p className="text-xs uppercase tracking-wide opacity-80">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {filterOptions.map(option => {
            const active = taskFilter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleFilterChange(option.value)}
                className={`relative w-full rounded-xl border transition-all p-3 text-left overflow-hidden group ${
                  active
                    ? `bg-gradient-to-br ${option.gradient} text-white border-transparent shadow-xl`
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/60 hover:shadow-lg'
                }`}
              >
                {!active && (
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[var(--color-background)]/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                )}
                <div className="relative flex items-start justify-between gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  }`}>
                    {option.icon}
                  </div>
                  <span className={`text-sm font-bold ${active ? 'text-white' : 'text-[var(--color-text)]'}`}>
                    {option.count}
                  </span>
                </div>
                <div className="relative mt-3">
                  <p className={`text-base font-semibold ${active ? 'text-white' : 'text-[var(--color-text)]'}`}>
                    {option.label}
                  </p>
                  <p className={`text-xs mt-1 leading-snug ${active ? 'text-white/80' : 'text-[var(--color-textSecondary)]'}`}>
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Updatable Pending Steps Overview */}
        {updatablePendingSteps.length > 0 && (
          <div className="mb-6 p-5 rounded-2xl border-2 border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
                  <div className="w-2 h-8 bg-[var(--color-primary)] rounded-full"></div>
                  Updatable Pending Steps
                </h2>
                <p className="text-sm text-[var(--color-textSecondary)] mt-1">
                  Steps ready for update - Click any card to view details and update
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold text-lg shadow-lg">
                  {updatablePendingSteps.length}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {updatablePendingSteps.map((item, idx) => (
                <div
                  key={`${item.projectId}-${item.taskIndex}`}
                  onClick={() => {
                    setSelectedProject(item.project);
                    setSelectedTask({ ...item.task, index: item.taskIndex });
                    setTaskStatus(item.task.status === 'Awaiting Date' ? 'Pending' : item.task.status);
                    setTaskPlannedDate(item.task.plannedDueDate ? new Date(item.task.plannedDueDate).toISOString().split('T')[0] : '');
                  }}
                  className={`group cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-xl ${
                    item.isOverdue
                      ? 'border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                        item.isOverdue ? 'bg-red-500' : 'bg-[var(--color-primary)]'
                      }`}>
                        {item.task.stepNo}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                          {item.task.what}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[var(--color-textSecondary)]">Project:</span>
                      <span className="text-[var(--color-text)] truncate">{item.projectName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-[var(--color-textSecondary)]">FMS:</span>
                      <span className="text-[var(--color-text)] truncate">{item.fmsName}</span>
                    </div>
                    {item.task.plannedDueDate && (
                      <div className={`flex items-center gap-2 text-xs ${
                        item.isOverdue ? 'text-red-600 font-semibold' : 'text-[var(--color-textSecondary)]'
                      }`}>
                        <Clock size={14} />
                        <span>Due: {formatDate(item.task.plannedDueDate)}</span>
                        {item.isOverdue && <span className="ml-1">⚠️</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.isOverdue
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : item.task.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {item.isOverdue ? 'Overdue' : item.task.status}
                    </span>
                    <button className="px-3 py-1 rounded-lg bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1">
                      Update
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {updatablePendingSteps.length > 12 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-[var(--color-textSecondary)]">
                  Showing all {updatablePendingSteps.length} updatable steps
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-[var(--color-border)]">
          <button
            onClick={() => {
              setActiveTab('fms');
              setSelectedProject(null);
              setSelectedMultiLevelTask(null);
            }}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'fms'
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                : 'text-[var(--color-textSecondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={18} />
              FMS Projects
              {projects.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-primary)] text-white">
                  {projects.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('multilevel');
              setSelectedProject(null);
              setSelectedMultiLevelTask(null);
            }}
            className={`px-6 py-3 font-semibold transition-all relative ${
              activeTab === 'multilevel'
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                : 'text-[var(--color-textSecondary)] hover:text-[var(--color-text)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users size={18} />
              Multi Level Tasks
              {multiLevelTasks.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-accent)] text-white">
                  {multiLevelTasks.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* FMS Projects Tab Content */}
        {activeTab === 'fms' && (
          <>
            {filteredProjects.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4" style={{ backgroundColor: 'var(--color-primary)10' }}>
                  <RotateCcw size={40} style={{ color: 'var(--color-primary)' }} />
                </div>
                <p className="text-[var(--color-textSecondary)] text-lg font-medium">No projects match this filter</p>
                <p className="text-[var(--color-textSecondary)] text-sm">Try selecting a different view above</p>
              </div>
            ) : (
              <div className="space-y-8">
            {/* Projects Grid */}
            <div>
              <h2 className="text-2xl font-bold text-[var(--color-text)] mb-6 flex items-center">
                <span className="w-1 h-8 bg-[var(--color-primary)] rounded-full mr-3"></span>
                Your Projects
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
                {filteredProjects.map((project) => {
                  const progress = calculateProgress(project.tasks);
                  const isSelected = selectedProject?._id === project._id;
                  
                  return (
                    <div
                      key={project._id}
                      onClick={() => setSelectedProject(project)}
                      className={`cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-xl ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-xl ring-2 ring-[var(--color-primary)]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/50'
                      }`}
                    >
                      <div className="h-1 bg-gradient-to-r" style={{ 
                        width: `${progress}%`,
                        backgroundColor: progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444'
                      }} />
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-[var(--color-text)] line-clamp-2 text-base">{project.projectName}</h3>
                          {isSelected && (
                            <span className="ml-2 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-[var(--color-primary)] text-white">
                              Active
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-[var(--color-textSecondary)] mb-2 font-mono truncate">{project.projectId}</p>
                        
                        <div className="mb-3 p-2 rounded-lg bg-[var(--color-background)] text-xs text-[var(--color-textSecondary)] truncate">
                          📋 {project.fmsId?.fmsName || 'No FMS'}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--color-textSecondary)]">Progress</span>
                            <span className="text-sm font-bold" style={{ color: progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444' }}>{progress}%</span>
                          </div>
                          <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500 rounded-full"
                              style={{ 
                                width: `${progress}%`,
                                backgroundColor: progress >= 80 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444'
                              }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex justify-between text-xs text-[var(--color-textSecondary)]">
                          <span className="font-medium">{project.tasks.filter(t => t.status === 'Done').length}/{project.tasks.length}</span>
                          <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Details */}
            <div className="lg:col-span-2">
              {selectedProject ? (
                <div className="space-y-6">
                  {/* Project Header Card */}
                  <div className="p-6 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-[var(--color-text)] mb-2">
                          {selectedProject.projectName}
                        </h2>
                        <div className="flex items-center space-x-3 text-sm text-[var(--color-textSecondary)]">
                          <span className="flex items-center"><Clock size={14} className="mr-1" /> Started: {formatDate(selectedProject.startDate)}</span>
                          <span>•</span>
                          <span className="flex items-center">Started By: <strong className="ml-1 text-[var(--color-text)]">{selectedProject.createdBy?.username || 'Unknown'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-2">
                            Status: 
                            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--color-primary)10', color: 'var(--color-primary)' }}>
                              {selectedProject.status}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {selectedProject.totalScore > 0 && (
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="p-4 rounded-xl bg-white/50 dark:bg-[var(--color-background)]/50 border border-[var(--color-border)]/50 hover:shadow-md transition-all">
                          <p className="text-xs text-[var(--color-textSecondary)] mb-2 font-medium uppercase tracking-wider">Performance Score</p>
                          <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{selectedProject.totalScore}%</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/50 dark:bg-[var(--color-background)]/50 border border-[var(--color-border)]/50 hover:shadow-md transition-all">
                          <p className="text-xs text-[var(--color-textSecondary)] mb-2 font-medium uppercase tracking-wider">On-Time Tasks</p>
                          <p className="text-2xl font-bold text-green-600">{selectedProject.tasksOnTime || 0}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/50 dark:bg-[var(--color-background)]/50 border border-[var(--color-border)]/50 hover:shadow-md transition-all">
                          <p className="text-xs text-[var(--color-textSecondary)] mb-2 font-medium uppercase tracking-wider">Late Tasks</p>
                          <p className="text-2xl font-bold text-red-600">{selectedProject.tasksLate || 0}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tasks Section */}
                  <div>
                    <h3 className="text-xl font-bold text-[var(--color-text)] mb-4 flex items-center">
                      <span className="w-1 h-6 bg-[var(--color-primary)] rounded-full mr-3"></span>
                      Steps & Tasks
                    </h3>
                    <div className="space-y-4">
                      {visibleTasks.length === 0 && (
                        <div className="p-6 text-center rounded-2xl border border-dashed border-[var(--color-border)] text-[var(--color-textSecondary)]">
                          No tasks found for the “{taskFilter.replace('-', ' ')}” filter in this project.
                        </div>
                      )}
                      {visibleTasks.map(({ task, index }) => (
                        <div
                          key={index}
                          className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:shadow-lg hover:border-[var(--color-primary)]/50 transition-all duration-300"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                                  {task.stepNo}
                                </span>
                                <h4 className="text-lg font-bold text-[var(--color-text)]">
                                  {task.what}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                                  {task.status}
                                </span>
                              </div>
                              <p className="text-sm text-[var(--color-textSecondary)] mb-3 ml-11">{task.how}</p>
                              <div className="flex items-center space-x-4 text-sm text-[var(--color-textSecondary)] ml-11">
                                <span className="flex items-center gap-1">👤 {(() => {
                                  // Handle both array (backward compatibility) and single who
                                  const whoArray = Array.isArray(task.who) ? task.who : (task.who ? [task.who] : []);
                                  return whoArray.filter((w: any) => w).map((w: any) => formatUserDisplay(w)).join(', ');
                                })()}</span>
                                {task.plannedDueDate && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock size={14} /> Due: {formatDate(task.plannedDueDate)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {task.status !== 'Done' && 
                              (() => {
                                // Handle both array (backward compatibility) and single who
                                const whoArray = Array.isArray(task.who) ? task.who : (task.who ? [task.who] : []);
                                return whoArray.some((w: any) => {
                                  const userId = typeof w === 'object' && w !== null ? (w._id || w) : w;
                                  return userId?.toString() === user?.id?.toString();
                                });
                              })() && 
                              canUpdateStep(index, selectedProject.tasks) && (
                                <div className="flex gap-2 ml-4 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setSelectedTask({ ...task, index });
                                      setTaskStatus(task.status === 'Awaiting Date' ? 'Pending' : task.status);
                                      setTaskPlannedDate(task.plannedDueDate ? new Date(task.plannedDueDate).toISOString().split('T')[0] : '');
                                    }}
                                    className="px-4 py-2 rounded-lg text-white font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                  >
                                    Update
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReassigningTask({ projectId: selectedProject.projectId, taskIndex: index });
                                      setReassignTo('');
                                      setReassignReason('');
                                      setShowReassignModal(true);
                                    }}
                                    className="px-4 py-2 rounded-lg text-white font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm"
                                    style={{ backgroundColor: 'var(--color-accent)' }}
                                  >
                                    Reassign
                                  </button>
                                </div>
                              )}
                            {task.status !== 'Done' && 
                              (() => {
                                // Handle both array (backward compatibility) and single who
                                const whoArray = Array.isArray(task.who) ? task.who : (task.who ? [task.who] : []);
                                return whoArray.some((w: any) => {
                                  const userId = typeof w === 'object' && w !== null ? (w._id || w) : w;
                                  return userId?.toString() === user?.id?.toString();
                                });
                              })() && 
                              !canUpdateStep(index, selectedProject.tasks) && (
                                <div className="px-4 py-2 text-sm text-[var(--color-warning)] bg-[var(--color-warning)]/10 rounded-lg ml-4 flex-shrink-0">
                                  ⚠️ Complete previous step first
                                </div>
                              )}
                          </div>

                          {task.requiresChecklist && task.checklistItems.length > 0 && (
                            <div className="mt-4 p-4 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]/50">
                              <p className="text-sm font-bold text-[var(--color-text)] mb-3">✓ Checklist</p>
                              <div className="space-y-2">
                                {task.checklistItems.map((item: any, idx: number) => (
                                  <div key={idx} className="flex items-center space-x-2 text-sm">
                                    {item.completed ? (
                                      <CheckSquare size={16} className="text-green-600" />
                                    ) : (
                                      <div className="w-4 h-4 border-2 border-[var(--color-border)] rounded" />
                                    )}
                                    <span className={item.completed ? 'line-through text-[var(--color-textSecondary)]' : 'text-[var(--color-text)]'}>
                                      {item.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {task.actualCompletedOn && (
                            <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-sm text-green-700 dark:text-green-400 flex items-center">
                              <CheckSquare size={16} className="mr-2" />
                              Completed on {formatDate(task.actualCompletedOn)} by {formatUserDisplay(task.completedBy)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: 'var(--color-primary)10' }}>
                    <AlertCircle size={32} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <p className="text-[var(--color-text)] font-medium">Select a project to view details</p>
                  <p className="text-[var(--color-textSecondary)] text-sm">Click a project card above to see full details</p>
                </div>
              )}
            </div>
          </div>
            )}
          </>
        )}

        {/* Multi Level Tasks Tab Content */}
        {activeTab === 'multilevel' && (
          <div className="space-y-6">
            {multiLevelTasks.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4" style={{ backgroundColor: 'var(--color-accent)10' }}>
                  <Users size={40} style={{ color: 'var(--color-accent)' }} />
                </div>
                <p className="text-[var(--color-textSecondary)] text-lg font-medium">No multi-level tasks found</p>
                <p className="text-[var(--color-textSecondary)] text-sm">Multi-level tasks will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {multiLevelTasks.map((task) => {
                  const normalizedTaskStatus = (task.status || '').toLowerCase();
                  const isOverdue =
                    task.dueDate
                      ? new Date(task.dueDate) < new Date() && normalizedTaskStatus !== 'completed'
                      : false;
                  const assignedToId =
                    typeof task.assignedTo === 'string'
                      ? task.assignedTo
                      : (task.assignedTo as any)?._id;
                  const isMyTask = assignedToId?.toString() === user?.id;
                  const canManageTask = isMyTask || ['admin', 'superadmin', 'manager'].includes(user?.role || '');
                  
                  return (
                    <div
                      key={task._id}
                      className={`p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-lg ${
                        isMyTask
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                      }`}
                      onClick={() => setSelectedMultiLevelTask(task)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">
                            {task.title}
                          </h3>
                          <p className="text-sm text-[var(--color-textSecondary)] line-clamp-2">
                            {task.description}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            task.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'in-progress'
                              ? 'bg-blue-100 text-blue-800'
                              : isOverdue
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {task.status === 'completed' ? 'Completed' : isOverdue ? 'Overdue' : task.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-[var(--color-textSecondary)]">
                          <Clock size={14} />
                          <span>Due: {formatDate(task.dueDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-textSecondary)]">
                          <Users size={14} />
                          <span>Assigned to: <strong className="text-[var(--color-text)]">{task.assignedTo.username}</strong></span>
                          {task.forwardedBy && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                              (forwarded by {task.forwardedBy.username})
                            </span>
                          )}
                        </div>
                        {task.forwardedAt && (
                          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                            <ArrowRight size={12} />
                            <span>Forwarded on: {formatDate(task.forwardedAt)}</span>
                          </div>
                        )}
                        {task.requiresChecklist && (
                          <div className="flex items-center gap-2 text-[var(--color-textSecondary)]">
                            <CheckSquare size={14} />
                            <span>Checklist: {task.checklistProgress}% complete</span>
                          </div>
                        )}
                      </div>

                      {task.forwardingHistory.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                          <p className="text-xs font-semibold text-[var(--color-text)] mb-2">
                            Forwarding History
                          </p>
                          <div className="flex items-center gap-1 text-xs text-[var(--color-textSecondary)]">
                            {task.forwardingHistory.slice(-3).map((h, idx) => (
                              <React.Fragment key={idx}>
                                {h.from.username}
                                <ArrowRight size={12} />
                              </React.Fragment>
                            ))}
                            {task.assignedTo.username}
                          </div>
                        </div>
                      )}

                      {canManageTask && normalizedTaskStatus !== 'completed' && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMultiLevelTask(task);
                              setCompletionRemarks('');
                              setShowMultiLevelActionModal(true);
                            }}
                            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 text-sm font-medium flex-1"
                          >
                            Update Task
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Multi Level Task Action Modal */}
        {showMultiLevelActionModal && selectedMultiLevelTask && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-surface)] rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">
                Finish Task: {selectedMultiLevelTask.title}
              </h3>
              <p className="text-sm text-[var(--color-textSecondary)] mb-4">
                Would you like to completely close this task or assign it to another team member for further work?
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Completion Remarks <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={completionRemarks}
                    onChange={(e) => setCompletionRemarks(e.target.value)}
                    rows={4}
                    placeholder="Add important updates or outcomes before closing the task"
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowMultiLevelActionModal(false);
                    setForwardTo('');
                    setForwardDate('');
                    setForwardRemarks('');
                    setShowForwardModal(true);
                  }}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-background)] text-sm font-medium"
                >
                  Assign to New Assignee
                </button>
                <button
                  onClick={handleCompleteMultiLevelTask}
                  disabled={completingTask}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {completingTask ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Closing Task...
                    </>
                  ) : (
                    'Close Task'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowMultiLevelActionModal(false);
                    setCompletionRemarks('');
                    setSelectedMultiLevelTask(null);
                  }}
                  className="px-4 py-2 text-[var(--color-textSecondary)] text-sm font-medium hover:text-[var(--color-text)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forward Task Modal */}
        {showForwardModal && selectedMultiLevelTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-surface)] rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <ArrowRight size={24} style={{ color: 'var(--color-primary)' }} />
                Forward Multi-Level Task
              </h3>
              <p className="text-sm text-[var(--color-textSecondary)] mb-4">{selectedMultiLevelTask.title}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Forward To (New Assignee) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                  >
                    <option value="">Select user...</option>
                    {users
                      .filter((u: any) => u._id !== user?.id && u._id !== selectedMultiLevelTask.assignedTo._id)
                      .map((u: any) => (
                        <option key={u._id} value={u._id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    New Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={forwardDate}
                    onChange={(e) => setForwardDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                  />
                  <p className="text-xs text-[var(--color-textSecondary)] mt-1">
                    Select the due date for the forwarded task
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Forwarding Remarks <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={forwardRemarks}
                    onChange={(e) => setForwardRemarks(e.target.value)}
                    rows={4}
                    placeholder="Explain why you're forwarding this task..."
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowForwardModal(false);
                    setForwardTo('');
                    setForwardDate('');
                    setForwardRemarks('');
                    setSelectedMultiLevelTask(null);
                  }}
                  disabled={forwarding}
                  className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-background)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForwardTask}
                  disabled={forwarding}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {forwarding ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Forwarding...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      Forward Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedTask && selectedProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[95vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] p-6 text-white">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl backdrop-blur-sm">
                        {selectedTask.stepNo}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold mb-1">{selectedTask.what}</h3>
                        <p className="text-sm text-white/80">{selectedProject.projectName}</p>
                      </div>
                    </div>
                    {selectedTask.how && (
                      <p className="text-sm text-white/90 mt-2 ml-16">{selectedTask.how}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTask(null);
                      setTaskStatus('');
                      setTaskNotes('');
                      setFiles([]);
                      setTaskPlannedDate('');
                    }}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Task Info Bar */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span className="text-sm">
                      {(() => {
                        // Handle both array (backward compatibility) and single who
                        const whoArray = Array.isArray(selectedTask.who) 
                          ? selectedTask.who 
                          : (selectedTask.who ? [selectedTask.who] : []);
                        return whoArray
                          .filter((w: any) => w)
                          .map((w: any) => {
                            if (typeof w === 'object' && w !== null) {
                              return w.username || w.name || w.email || 'Unknown';
                            }
                            return typeof w === 'string' ? w : 'Unknown';
                          })
                          .join(', ') || 'Unassigned';
                      })()}
                    </span>
                  </div>
                  {selectedTask.plannedDueDate && (
                    <>
                      <span className="text-white/40">•</span>
                      <div className="flex items-center gap-2">
                        <Clock size={16} />
                        <span className="text-sm">Due: {formatDate(selectedTask.plannedDueDate)}</span>
                      </div>
                    </>
                  )}
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedTask.status === 'Done' ? 'bg-green-500/30 text-white' :
                    selectedTask.status === 'In Progress' ? 'bg-blue-500/30 text-white' :
                    'bg-yellow-500/30 text-white'
                  }`}>
                    {selectedTask.status}
                  </span>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-5">
                  {/* Checklist Section */}
                  {selectedTask.requiresChecklist && selectedTask.checklistItems?.length > 0 && (
                    <div className="p-4 rounded-xl border-2 border-[var(--color-primary)]/20 bg-[var(--color-background)]">
                      <label className="block text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                        <CheckSquare size={18} className="text-[var(--color-primary)]" />
                        Checklist (Required) *
                      </label>
                      <div className="space-y-3">
                        {selectedTask.checklistItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={(e) => {
                                const updatedItems = [...selectedTask.checklistItems];
                                updatedItems[idx].completed = e.target.checked;
                                setSelectedTask({
                                  ...selectedTask,
                                  checklistItems: updatedItems
                                });
                              }}
                              className="w-5 h-5 mt-0.5 rounded border-2 border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                            <span className={`text-sm flex-1 ${item.completed ? 'line-through text-[var(--color-textSecondary)]' : 'text-[var(--color-text)] font-medium'}`}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Section */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                      <RotateCcw size={16} className="text-[var(--color-primary)]" />
                      Status
                    </label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] font-medium focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>

                  {/* Planned Date Section */}
                  {shouldShowPlannedDateInput && (
                    <div>
                      <label className="block text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                        <Clock size={16} className="text-[var(--color-primary)]" />
                        Planned Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={taskPlannedDate}
                        onChange={(e) => setTaskPlannedDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] font-medium focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <p className="text-xs text-[var(--color-textSecondary)] mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Select the target date for this step. Sundays will automatically shift to Monday.
                      </p>
                    </div>
                  )}

                  {/* Notes Section */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-[var(--color-primary)]" />
                      Notes
                    </label>
                    <textarea
                      value={taskNotes}
                      onChange={(e) => setTaskNotes(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] resize-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all"
                      rows={4}
                      placeholder="Add your notes, updates, or remarks here..."
                    />
                  </div>

                  {/* Attachments Section */}
                  <div>
                    <label className="block text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                      <Upload size={16} className="text-[var(--color-primary)]" />
                      Attachments (Max 3 files, 2MB each)
                    </label>
                    {selectedTask.requireAttachments && (
                      <div className={`mb-3 p-3 rounded-lg border-2 ${
                        selectedTask.mandatoryAttachments 
                          ? 'border-red-300 bg-red-50 dark:bg-red-900/20' 
                          : 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20'
                      }`}>
                        <p className={`text-xs font-medium flex items-center gap-2 ${
                          selectedTask.mandatoryAttachments ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'
                        }`}>
                          <AlertCircle size={14} />
                          {selectedTask.mandatoryAttachments
                            ? 'Attachments are required to complete this step.'
                            : 'Attachments are recommended for this step.'}
                        </p>
                      </div>
                    )}
                    <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-primary)] transition-colors">
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx"
                        onChange={(e) => {
                          const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
                          if (selectedFiles.length > 3) {
                            alert('Maximum 3 files allowed');
                            return;
                          }
                          const oversized = selectedFiles.find(f => f.size > 2 * 1024 * 1024);
                          if (oversized) {
                            alert('Each file must be under 2MB');
                            return;
                          }
                          setFiles(selectedFiles);
                        }}
                        className="w-full text-sm text-[var(--color-textSecondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90 cursor-pointer"
                      />
                      {files.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20">
                          <p className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-2">
                            <Upload size={14} />
                            {files.length} file(s) selected
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-[var(--color-border)] p-6 bg-[var(--color-background)] flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskStatus('');
                    setTaskNotes('');
                    setFiles([]);
                    setTaskPlannedDate('');
                  }}
                  className="px-6 py-3 border-2 border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-surface)] font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTaskUpdate}
                  className="px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white rounded-xl hover:opacity-90 font-semibold shadow-lg transition-all flex items-center gap-2"
                >
                  <CheckSquare size={18} />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reassignment Modal */}
        {showReassignModal && reassigningTask && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-surface)] rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                <Users size={24} style={{ color: 'var(--color-accent)' }} />
                Reassign Task
              </h3>
              {selectedProject.tasks[reassigningTask.taskIndex] && (
                <>
                  <p className="text-sm text-[var(--color-textSecondary)] mb-4">
                    Step {selectedProject.tasks[reassigningTask.taskIndex].stepNo}: {selectedProject.tasks[reassigningTask.taskIndex].what}
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        Reassign to *
                      </label>
                      <select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                      >
                        <option value="">Select a user</option>
                        {users.filter(u => u._id !== user?.id && u.isActive).map((u: any) => (
                          <option key={u._id} value={u._id}>
                            {u.username} {u.email ? `(${u.email})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        Reason for Reassignment *
                      </label>
                      <textarea
                        value={reassignReason}
                        onChange={(e) => setReassignReason(e.target.value)}
                        placeholder="Explain why you're reassigning this task..."
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
                    <button
                      onClick={() => {
                        setShowReassignModal(false);
                        setReassigningTask(null);
                        setReassignTo('');
                        setReassignReason('');
                      }}
                      className="px-6 py-2 border-2 border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-surface)] font-semibold transition-all"
                      disabled={reassigning}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReassignTask}
                      disabled={reassigning || !reassignTo || !reassignReason.trim()}
                      className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-xl hover:opacity-90 font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reassigning ? 'Reassigning...' : 'Reassign Task'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewFMSProgress;
