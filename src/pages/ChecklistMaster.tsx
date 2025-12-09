import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Download, 
  Filter, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  FileSpreadsheet,
  Users,
  Calendar,
  Tag,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { address } from '../../utils/ipAddress';
import { formatDate } from '../utils/dateFormat';

interface ChecklistMasterItem {
  _id: string;
  templateName: string;
  category: string;
  frequency: string;
  assignedTo: {
    _id: string;
    username: string;
    email: string;
    department: string;
  } | null;
  assignedBy: {
    _id: string;
    username: string;
    email: string;
  } | null;
  dueDate: string;
  status: string;
  progressPercentage: number;
  completedAt: string | null;
  completedBy: {
    _id: string;
    username: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  completedItemsCount: number;
}

type SortField = 'templateName' | 'category' | 'frequency' | 'assignedTo' | 'dueDate' | 'status' | 'progressPercentage' | 'createdAt';
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const ChecklistMaster: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [checklists, setChecklists] = useState<ChecklistMasterItem[]>([]);
  const [filteredChecklists, setFilteredChecklists] = useState<ChecklistMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'dueDate', direction: 'desc' });
  
  // Filter states
  const [filters, setFilters] = useState({
    assignedTo: '',
    frequency: '',
    category: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [uniqueValues, setUniqueValues] = useState({
    assignedTo: new Set<string>(),
    frequency: new Set<string>(),
    category: new Set<string>(),
    status: new Set<string>()
  });

  useEffect(() => {
    fetchChecklists();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [checklists, searchTerm, filters, sortConfig]);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${address}/api/checklists/master`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      setChecklists(data);

      // Extract unique values for filters
      const assignedToSet = new Set<string>();
      const frequencySet = new Set<string>();
      const categorySet = new Set<string>();
      const statusSet = new Set<string>();

      data.forEach((item: ChecklistMasterItem) => {
        if (item.assignedTo?.username) {
          assignedToSet.add(item.assignedTo.username);
        }
        if (item.frequency) {
          frequencySet.add(item.frequency);
        }
        if (item.category) {
          categorySet.add(item.category);
        }
        if (item.status) {
          statusSet.add(item.status);
        }
      });

      setUniqueValues({
        assignedTo: assignedToSet,
        frequency: frequencySet,
        category: categorySet,
        status: statusSet
      });
    } catch (error: any) {
      console.error('Error fetching checklists:', error);
      if (error.response?.status === 403) {
        alert('Access denied. Only Admin, Super Admin, and PC can access this view.');
      } else {
        alert('Failed to fetch checklists. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...checklists];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.templateName.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        item.assignedTo?.username.toLowerCase().includes(searchLower) ||
        item.assignedBy?.username.toLowerCase().includes(searchLower) ||
        item.frequency.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    if (filters.assignedTo) {
      filtered = filtered.filter(item => item.assignedTo?.username === filters.assignedTo);
    }
    if (filters.frequency) {
      filtered = filtered.filter(item => item.frequency === filters.frequency);
    }
    if (filters.category) {
      filtered = filtered.filter(item => item.category === filters.category);
    }
    if (filters.status) {
      filtered = filtered.filter(item => item.status === filters.status);
    }
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.dueDate);
        return itemDate >= fromDate;
      });
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.dueDate);
        return itemDate <= toDate;
      });
    }

    // Apply sorting
    if (sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.field) {
          case 'templateName':
            aValue = a.templateName.toLowerCase();
            bValue = b.templateName.toLowerCase();
            break;
          case 'category':
            aValue = a.category.toLowerCase();
            bValue = b.category.toLowerCase();
            break;
          case 'frequency':
            aValue = a.frequency.toLowerCase();
            bValue = b.frequency.toLowerCase();
            break;
          case 'assignedTo':
            aValue = a.assignedTo?.username || '';
            bValue = b.assignedTo?.username || '';
            break;
          case 'dueDate':
            aValue = new Date(a.dueDate).getTime();
            bValue = new Date(b.dueDate).getTime();
            break;
          case 'status':
            aValue = a.status.toLowerCase();
            bValue = b.status.toLowerCase();
            break;
          case 'progressPercentage':
            aValue = a.progressPercentage;
            bValue = b.progressPercentage;
            break;
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          default:
            return 0;
        }

        if (sortConfig.direction === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    setFilteredChecklists(filtered);
  };

  const handleSort = (field: SortField) => {
    setSortConfig(prev => {
      if (prev.field === field) {
        // Cycle through: asc -> desc -> null -> asc
        if (prev.direction === 'asc') {
          return { field, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { field, direction: null };
        } else {
          return { field, direction: 'asc' };
        }
      } else {
        return { field, direction: 'asc' };
      }
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field || !sortConfig.direction) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = filteredChecklists.map(item => ({
        'Template Name': item.templateName,
        'Category': item.category,
        'Frequency': item.frequency,
        'Assigned To': item.assignedTo?.username || 'N/A',
        'Assigned To Email': item.assignedTo?.email || 'N/A',
        'Assigned To Department': item.assignedTo?.department || 'N/A',
        'Assigned By': item.assignedBy?.username || 'N/A',
        'Due Date': formatDate(item.dueDate),
        'Status': item.status,
        'Progress %': item.progressPercentage,
        'Items Count': item.itemsCount,
        'Completed Items': item.completedItemsCount,
        'Completed At': item.completedAt ? formatDate(item.completedAt) : 'N/A',
        'Completed By': item.completedBy?.username || 'N/A',
        'Created At': formatDate(item.createdAt),
        'Updated At': formatDate(item.updatedAt)
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const colWidths = [
        { wch: 30 }, // Template Name
        { wch: 15 }, // Category
        { wch: 12 }, // Frequency
        { wch: 20 }, // Assigned To
        { wch: 25 }, // Assigned To Email
        { wch: 15 }, // Assigned To Department
        { wch: 20 }, // Assigned By
        { wch: 12 }, // Due Date
        { wch: 12 }, // Status
        { wch: 12 }, // Progress %
        { wch: 12 }, // Items Count
        { wch: 15 }, // Completed Items
        { wch: 18 }, // Completed At
        { wch: 18 }, // Completed By
        { wch: 18 }, // Created At
        { wch: 18 }  // Updated At
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Checklist Master');

      // Generate filename with current date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Checklist_Master_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  const resetFilters = () => {
    setFilters({
      assignedTo: '',
      frequency: '',
      category: '',
      status: '',
      dateFrom: '',
      dateTo: ''
    });
    setSearchTerm('');
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    if (status === 'completed') {
      return (
        <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1`}>
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    } else {
      return (
        <span className={`${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1`}>
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[--color-background] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--color-primary]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[--color-background] p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[--color-text] flex items-center gap-2">
                <FileSpreadsheet className="text-[--color-primary]" />
                Checklist Master
              </h1>
              <p className="text-[--color-textSecondary] mt-1">
                View and manage all checklists with advanced filtering and sorting
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchChecklists}
                className="px-4 py-2 bg-[--color-primary] text-white rounded-lg hover:bg-[--color-primaryHover] flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleExportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </button>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="flex gap-4 items-center mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search checklists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                showFilters
                  ? 'bg-[--color-primary] text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-[--color-text] hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            {(filters.assignedTo || filters.frequency || filters.category || filters.status || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-[--color-text] rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    <Users className="w-4 h-4 inline mr-1" />
                    Assigned To
                  </label>
                  <select
                    value={filters.assignedTo}
                    onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  >
                    <option value="">All Users</option>
                    {Array.from(uniqueValues.assignedTo).sort().map(username => (
                      <option key={username} value={username}>{username}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Frequency
                  </label>
                  <select
                    value={filters.frequency}
                    onChange={(e) => setFilters({ ...filters, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  >
                    <option value="">All Frequencies</option>
                    {Array.from(uniqueValues.frequency).sort().map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  >
                    <option value="">All Categories</option>
                    {Array.from(uniqueValues.category).sort().map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  >
                    <option value="">All Statuses</option>
                    {Array.from(uniqueValues.status).sort().map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--color-text] mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-[--color-textSecondary] mb-4">
            Showing {filteredChecklists.length} of {checklists.length} checklists
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('templateName')}
                  >
                    <div className="flex items-center gap-2">
                      Template Name
                      {getSortIcon('templateName')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-2">
                      Category
                      {getSortIcon('category')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('frequency')}
                  >
                    <div className="flex items-center gap-2">
                      Frequency
                      {getSortIcon('frequency')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('assignedTo')}
                  >
                    <div className="flex items-center gap-2">
                      Assigned To
                      {getSortIcon('assignedTo')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('dueDate')}
                  >
                    <div className="flex items-center gap-2">
                      Due Date
                      {getSortIcon('dueDate')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {getSortIcon('status')}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('progressPercentage')}
                  >
                    <div className="flex items-center gap-2">
                      Progress
                      {getSortIcon('progressPercentage')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Completed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredChecklists.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[--color-textSecondary]">
                      No checklists found
                    </td>
                  </tr>
                ) : (
                  filteredChecklists.map((item) => (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[--color-text]">
                        {item.templateName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        {item.frequency}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        <div>
                          <div className="font-medium">{item.assignedTo?.username || 'N/A'}</div>
                          {item.assignedTo?.department && (
                            <div className="text-xs text-[--color-textSecondary]">{item.assignedTo.department}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-[--color-primary] h-2 rounded-full"
                              style={{ width: `${item.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">
                            {item.progressPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        {item.completedItemsCount} / {item.itemsCount}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[--color-text]">
                        {item.completedBy?.username || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChecklistMaster;

