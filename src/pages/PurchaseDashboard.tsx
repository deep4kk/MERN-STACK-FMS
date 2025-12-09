import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Package, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  TrendingUp, 
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Store,
  Zap,
  Users,
  Printer
} from 'lucide-react';

interface IndentRecord {
  id: number;
  timestamp: string;
  storeName: string;
  itemName: string;
  qty: number;
  issuedTo: string;
  purpose: string;
  indentNumber: string;
  unit: string;
  nature: string;
  projectName: string;
  requiredInStore: string;
  partiallyIssued: string;
  qtyIssued: number;
  pending: number;
  status: string;
}

interface StoreStats {
  name: string;
  total: number;
  pending: number;
  issued: number;
}

interface DashboardMetrics {
  totalIndents: number;
  approved: number;
  pending: number;
  fullyIssued: number;
  partiallyIssued: number;
  urgentCount: number;
  normalCount: number;
}

interface DashboardData {
  success: boolean;
  metrics: DashboardMetrics;
  storeStats: StoreStats[];
  recentIndents: IndentRecord[];
  allIndents: IndentRecord[];
  cached?: boolean;
  cacheAge?: number;
}

interface ChecklistItem {
  templateId: string;
  name: string;
  category: string;
  frequency: string;
  itemCount: number;
  totalOccurrences: number;
  pendingOccurrences: number;
  completedOccurrences: number;
  status: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface PersonChecklist {
  userId: string;
  username: string;
  email: string;
  checklists: ChecklistItem[];
  totalChecklists: number;
  totalPending: number;
  totalCompleted: number;
}

interface ChecklistsByPersonData {
  success: boolean;
  data: PersonChecklist[];
  summary: {
    totalPersons: number;
    totalChecklists: number;
    totalPending: number;
    totalCompleted: number;
  };
}

const PurchaseDashboard: React.FC = () => {
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  
  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [natureFilter, setNatureFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllIndents, setShowAllIndents] = useState(false);
  const itemsPerPage = 10;

  // Checklist data
  const [checklistData, setChecklistData] = useState<ChecklistsByPersonData | null>(null);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [showChecklistSection, setShowChecklistSection] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      let response;
      if (forceRefresh) {
        response = await axios.post('/api/purchase/refresh');
        if (response.data.data) {
          setDashboardData(response.data.data);
        } else {
          setDashboardData(response.data);
        }
      } else {
        response = await axios.get('/api/purchase/dashboard');
        setDashboardData(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch checklist data
  const fetchChecklistData = async () => {
    try {
      setLoadingChecklists(true);
      const response = await axios.get('/api/purchase/checklists-by-person');
      setChecklistData(response.data);
    } catch (err: any) {
      console.error('Error fetching checklist data:', err);
      setError(err.response?.data?.message || 'Failed to load checklist data.');
    } finally {
      setLoadingChecklists(false);
    }
  };

  useEffect(() => {
    if (showChecklistSection && !checklistData) {
      fetchChecklistData();
    }
  }, [showChecklistSection]);

  // Print checklist report
  const handlePrintChecklists = () => {
    window.print();
  };

  // Filter indents
  const getFilteredIndents = () => {
    if (!dashboardData?.allIndents) return [];
    
    let filtered = dashboardData.allIndents;
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(indent => 
        indent.indentNumber.toLowerCase().includes(search) ||
        indent.itemName.toLowerCase().includes(search) ||
        indent.issuedTo.toLowerCase().includes(search) ||
        indent.projectName.toLowerCase().includes(search) ||
        indent.storeName.toLowerCase().includes(search)
      );
    }
    
    if (statusFilter) {
      filtered = filtered.filter(indent => indent.status === statusFilter);
    }
    
    if (storeFilter) {
      filtered = filtered.filter(indent => indent.storeName === storeFilter);
    }
    
    if (natureFilter) {
      filtered = filtered.filter(indent => indent.nature.toLowerCase() === natureFilter.toLowerCase());
    }
    
    return filtered;
  };

  const filteredIndents = getFilteredIndents();
  const totalPages = Math.ceil(filteredIndents.length / itemsPerPage);
  const paginatedIndents = filteredIndents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique stores for filter
  const uniqueStores = dashboardData?.allIndents 
    ? [...new Set(dashboardData.allIndents.map(i => i.storeName).filter(Boolean))]
    : [];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fully issued': 
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'partially issued': 
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
      case 'pending': 
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      default: 
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
    }
  };

  const getNatureColor = (nature: string) => {
    return nature.toLowerCase() === 'urgent'
      ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      : 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'fortnightly': 'Fortnightly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'yearly': 'Yearly'
    };
    return labels[frequency] || frequency;
  };

  const getFrequencyColor = (frequency: string) => {
    const colors: { [key: string]: string } = {
      'daily': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'weekly': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'fortnightly': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'monthly': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'quarterly': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'yearly': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    };
    return colors[frequency] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  // Use theme to determine dark mode class
  const isDarkMode = theme === 'dark';

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <p className="text-[var(--color-textSecondary)]">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {
    totalIndents: 0,
    approved: 0,
    pending: 0,
    fullyIssued: 0,
    partiallyIssued: 0,
    urgentCount: 0,
    normalCount: 0
  };

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .checklist-print-container,
          .checklist-print-container * {
            visibility: visible;
          }
          
          .checklist-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          .person-checklist-section {
            margin-bottom: 1rem;
            page-break-inside: avoid;
          }
          
          .person-checklist-section table {
            font-size: 10px;
            border-collapse: collapse;
          }
          
          .person-checklist-section th,
          .person-checklist-section td {
            padding: 4px 6px;
            border: 1px solid #000;
          }
          
          .person-checklist-section th {
            background-color: #f0f0f0 !important;
            font-weight: bold;
            color: #000 !important;
          }
          
          .person-checklist-section td {
            color: #000 !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          /* Ensure tables don't break across pages */
          table {
            page-break-inside: avoid;
          }
          
          /* Compact spacing for print */
          .checklist-print-container .person-checklist-section {
            margin-bottom: 0.8rem;
          }
          
          .checklist-print-container .person-checklist-section > div:first-child {
            padding: 0.5rem;
            margin-bottom: 0.5rem;
          }
        }
      `}</style>
      
      <div className={`min-h-screen bg-[var(--color-background)] p-6 ${isDarkMode ? 'dark' : ''}`}>
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Package size={32} className="text-[var(--color-primary)]" />
              <h1 className="text-3xl font-bold text-[var(--color-text)]">Purchase Dashboard</h1>
            </div>
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <p className="text-[var(--color-textSecondary)] text-sm">
            Indent tracking and management from Google Sheets
            {dashboardData?.cached && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                (Cached data - {dashboardData.cacheAge}s ago)
              </span>
            )}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-center gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
            <div>
              <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
              <button 
                onClick={() => fetchDashboardData()} 
                className="text-red-600 dark:text-red-400 underline text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Metrics Grid - Indents Only */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Indents */}
          <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileText className="text-purple-600 dark:text-purple-400" size={24} />
              </div>
              <TrendingUp className="text-green-500" size={20} />
            </div>
            <h3 className="text-3xl font-bold text-[var(--color-text)] mb-1">{metrics.totalIndents}</h3>
            <p className="text-sm text-[var(--color-textSecondary)]">Total Indents</p>
          </div>

          {/* Approved Indents */}
          <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="text-green-600 dark:text-green-400" size={24} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[var(--color-text)] mb-1">{metrics.approved}</h3>
            <p className="text-sm text-[var(--color-textSecondary)]">Approved (Fully/Partial)</p>
          </div>

          {/* Pending Indents */}
          <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="text-yellow-600 dark:text-yellow-400" size={24} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[var(--color-text)] mb-1">{metrics.pending}</h3>
            <p className="text-sm text-[var(--color-textSecondary)]">Pending Indents</p>
          </div>

          {/* Urgent Indents */}
          <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Zap className="text-red-600 dark:text-red-400" size={24} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[var(--color-text)] mb-1">{metrics.urgentCount}</h3>
            <p className="text-sm text-[var(--color-textSecondary)]">Urgent Indents</p>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Fully Issued */}
          <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-text)]">{metrics.fullyIssued}</h3>
                <p className="text-xs text-[var(--color-textSecondary)]">Fully Issued</p>
              </div>
            </div>
          </div>

          {/* Partially Issued */}
          <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <AlertCircle className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-text)]">{metrics.partiallyIssued}</h3>
                <p className="text-xs text-[var(--color-textSecondary)]">Partially Issued</p>
              </div>
            </div>
          </div>

          {/* Normal Indents */}
          <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)] shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900/30">
                <Package className="text-gray-600 dark:text-gray-400" size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-text)]">{metrics.normalCount}</h3>
                <p className="text-xs text-[var(--color-textSecondary)]">Normal Priority</p>
              </div>
            </div>
          </div>
        </div>

        {/* Store Stats */}
        {dashboardData?.storeStats && dashboardData.storeStats.length > 0 && (
          <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg mb-8">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
              <Store size={20} />
              Indents by Store
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {dashboardData.storeStats.map((store) => (
                <div 
                  key={store.name}
                  className="p-4 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]"
                >
                  <h4 className="font-medium text-[var(--color-text)] text-sm truncate" title={store.name}>
                    {store.name}
                  </h4>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-[var(--color-textSecondary)]">Total: {store.total}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400">Issued: {store.issued}</span>
                    <span className="text-yellow-600 dark:text-yellow-400">Pending: {store.pending}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklists by Person Section */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users size={24} className="text-[var(--color-primary)]" />
              <h2 className="text-xl font-bold text-[var(--color-text)]">Checklists by Person</h2>
            </div>
            <div className="flex items-center gap-3">
              {showChecklistSection && (
                <button
                  onClick={handlePrintChecklists}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors print:hidden"
                >
                  <Printer size={18} />
                  Print Report
                </button>
              )}
              <button
                onClick={() => {
                  setShowChecklistSection(!showChecklistSection);
                  if (!showChecklistSection && !checklistData) {
                    fetchChecklistData();
                  }
                }}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity print:hidden"
              >
                {showChecklistSection ? 'Hide' : 'Show'} Checklists
              </button>
            </div>
          </div>

          {showChecklistSection && (
            <>
              {loadingChecklists ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mx-auto mb-2" />
                  <p className="text-[var(--color-textSecondary)]">Loading checklist data...</p>
                </div>
              ) : checklistData && checklistData.data.length > 0 ? (
                <>
                  {/* Summary Cards - Hidden in Print */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print:hidden">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Total Persons</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {checklistData.summary.totalPersons}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">Total Checklists</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
                        {checklistData.summary.totalChecklists}
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Pending</p>
                      <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
                        {checklistData.summary.totalPending}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-600 dark:text-green-400 mb-1">Completed</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                        {checklistData.summary.totalCompleted}
                      </p>
                    </div>
                  </div>

                  {/* Print Header - Only visible in print */}
                  <div className="hidden print:block mb-4 pb-4 border-b-2 border-gray-300">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Checklist Assignment Report</h1>
                    <p className="text-sm text-gray-600">
                      Generated on {new Date().toLocaleDateString('en-IN', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Checklists by Person - Print Optimized */}
                  <div className="checklist-print-container space-y-6">
                    {checklistData.data.map((person) => (
                      <div 
                        key={person.userId} 
                        className="person-checklist-section break-inside-avoid"
                        style={{ pageBreakInside: 'avoid' }}
                      >
                        {/* Person Header */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg mb-3 border-l-4 border-blue-500 print:bg-gray-50 print:border-l-4 print:border-gray-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white print:text-gray-900">
                                {person.username}
                              </h3>
                              {person.email && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                                  {person.email}
                                </p>
                              )}
                            </div>
                            <div className="text-right print:hidden">
                              <div className="flex gap-2 text-xs">
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                  {person.totalChecklists} Checklists
                                </span>
                                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                                  {person.totalPending} Pending
                                </span>
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                                  {person.totalCompleted} Completed
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Checklists Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-100 dark:bg-gray-800 print:bg-gray-200">
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  #
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Checklist Name
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Category
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Frequency
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Items
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Total
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Pending
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center font-semibold text-gray-900 dark:text-white print:text-gray-900 print:bg-gray-200">
                                  Completed
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {person.checklists.map((checklist, index) => (
                                <tr 
                                  key={checklist.templateId}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 print:hover:bg-transparent"
                                >
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300 print:text-gray-900">
                                    {index + 1}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 font-medium text-gray-900 dark:text-white print:text-gray-900">
                                    {checklist.name}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300 print:text-gray-900">
                                    {checklist.category}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getFrequencyColor(checklist.frequency)} print:bg-gray-100 print:text-gray-900 print:border print:border-gray-300`}>
                                      {getFrequencyLabel(checklist.frequency)}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center text-gray-700 dark:text-gray-300 print:text-gray-900">
                                    {checklist.itemCount}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center text-gray-700 dark:text-gray-300 print:text-gray-900">
                                    {checklist.totalOccurrences}
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center">
                                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold print:text-gray-900">
                                      {checklist.pendingOccurrences}
                                    </span>
                                  </td>
                                  <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-center">
                                    <span className="text-green-600 dark:text-green-400 font-semibold print:text-gray-900">
                                      {checklist.completedOccurrences}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-[var(--color-textSecondary)]">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No checklist data available</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Indents Table */}
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-[var(--color-text)]">
              {showAllIndents ? 'All Indents' : 'Recent Indents'}
            </h2>
            <div className="flex flex-wrap gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-textSecondary)]" size={16} />
                <input
                  type="text"
                  placeholder="Search indents..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-4 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Partially Issued">Partially Issued</option>
                <option value="Fully Issued">Fully Issued</option>
              </select>
              
              {/* Store Filter */}
              <select
                value={storeFilter}
                onChange={(e) => {
                  setStoreFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">All Stores</option>
                {uniqueStores.map(store => (
                  <option key={store} value={store}>{store}</option>
                ))}
              </select>
              
              {/* Nature Filter */}
              <select
                value={natureFilter}
                onChange={(e) => {
                  setNatureFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>
              
              {/* Toggle View */}
              <button
                onClick={() => setShowAllIndents(!showAllIndents)}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
              >
                {showAllIndents ? 'Show Recent' : 'Show All'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Indent #</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Store</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Item</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Qty</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Issued To</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Project</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Required Date</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Nature</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Status</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[var(--color-text)]">Pending</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIndents.length > 0 ? (
                  paginatedIndents.map((indent) => (
                    <tr 
                      key={indent.id} 
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-background)] transition-colors"
                    >
                      <td className="py-3 px-2 text-sm font-medium text-[var(--color-primary)]">
                        {indent.indentNumber}
                      </td>
                      <td className="py-3 px-2 text-sm text-[var(--color-text)]">{indent.storeName}</td>
                      <td className="py-3 px-2 text-sm text-[var(--color-textSecondary)] max-w-[200px] truncate" title={indent.itemName}>
                        {indent.itemName}
                      </td>
                      <td className="py-3 px-2 text-sm text-[var(--color-text)]">
                        {indent.qty} {indent.unit}
                      </td>
                      <td className="py-3 px-2 text-sm text-[var(--color-textSecondary)]">{indent.issuedTo || '-'}</td>
                      <td className="py-3 px-2 text-sm text-[var(--color-textSecondary)] max-w-[150px] truncate" title={indent.projectName}>
                        {indent.projectName || '-'}
                      </td>
                      <td className="py-3 px-2 text-sm text-[var(--color-textSecondary)]">
                        {formatDate(indent.requiredInStore)}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getNatureColor(indent.nature)}`}>
                          {indent.nature}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(indent.status)}`}>
                          {indent.status}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-sm font-medium text-[var(--color-text)]">
                        {indent.pending > 0 ? (
                          <span className="text-yellow-600 dark:text-yellow-400">{indent.pending}</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[var(--color-textSecondary)]">
                      {searchTerm || statusFilter || storeFilter || natureFilter
                        ? 'No indents match your filters'
                        : 'No indents found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredIndents.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-textSecondary)]">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredIndents.length)} of {filteredIndents.length} indents
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-background)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-2 text-sm text-[var(--color-text)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-background)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default PurchaseDashboard;
