import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp, Eye, Printer, Edit, X, Check, Filter, Search, Calendar, User, Clock, List } from 'lucide-react';
import axios from 'axios';
import { address } from '../../utils/ipAddress';
import { useAuth } from '../contexts/AuthContext';

interface FMSTemplate {
  _id: string;
  fmsId: string;
  fmsName: string;
  category: string;
  stepCount: number;
  createdBy: string;
  createdOn: string;
  totalTimeFormatted: string;
  status?: string;
  steps: any[];
}

interface Category {
  name: string;
  count: number;
}

const ViewAllFMS: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fmsList, setFmsList] = useState<FMSTemplate[]>([]);
  const [expandedFMS, setExpandedFMS] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingFMS, setEditingFMS] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState<FMSTemplate | null>(null);
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

  // Format assignee names based on display mode
  const formatAssignees = useCallback((who: any): string => {
    const formatSingleUser = (user: any): string => {
      if (typeof user === 'string') {
        return user;
      }
      if (typeof user !== 'object' || user === null) {
        return 'N/A';
      }

      const username = user.username || user.name || user.email || '';
      const designation = user.designation || '';

      if (displayMode === 'name') {
        return username || 'N/A';
      } else if (displayMode === 'designation') {
        return designation || username || 'N/A';
      } else { // both
        if (designation) {
          return `${username} - ${designation}`;
        }
        return username || 'N/A';
      }
    };

    if (!Array.isArray(who)) {
      return formatSingleUser(who);
    }

    const formatted = who
      .map(formatSingleUser)
      .filter(Boolean);
    return formatted.length ? formatted.join(', ') : 'N/A';
  }, [displayMode]);

  // Get step duration text
  const getStepDuration = useCallback((step: any) => {
    if (step.whenType === 'ask-on-completion') return 'Ask on completion';
    if (step.whenUnit === 'days+hours') return `${step.whenDays || 0}d ${step.whenHours || 0}h`;
    return `${step.when || 0} ${step.whenUnit || 'days'}`;
  }, []);

  useEffect(() => {
    fetchFMSTemplates();
  }, [user, selectedCategory]);

  const fetchCategories = async (currentFmsList: FMSTemplate[] = []) => {
    try {
      const response = await axios.get(`${address}/api/fms-categories/categories`);
      if (response.data.success && response.data.categories) {
        const categoryCounts = currentFmsList.reduce((acc: { [key: string]: number }, fms: FMSTemplate) => {
          const category = fms.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        const categoriesList = response.data.categories.map((cat: any) => ({
          name: cat.name,
          count: categoryCounts[cat.name] || 0
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));

        setCategories(categoriesList);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      const categoryMap = currentFmsList.reduce((acc: { [key: string]: number }, fms: FMSTemplate) => {
        const category = fms.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const categoriesList = Object.entries(categoryMap).map(([name, count]) => ({
        name,
        count: count as number
      })).sort((a, b) => a.name.localeCompare(b.name));

      setCategories(categoriesList);
    }
  };

  const fetchFMSTemplates = async () => {
    try {
      const params = {
        userId: user?.id,
        isAdmin: (user?.role === 'admin' || user?.role === 'superadmin') ? 'true' : 'false',
        category: selectedCategory !== 'all' ? selectedCategory : undefined
      };
      const response = await axios.get(`${address}/api/fms`, { params });
      if (response.data.success) {
        const fetchedFmsList = response.data.fmsList || [];
        setFmsList(fetchedFmsList);
        await fetchCategories(fetchedFmsList);
      }
    } catch (error) {
      console.error('Error fetching FMS templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async (fmsId: string, newCategory: string) => {
    if (user?.role !== 'superadmin') {
      alert('Only Super Admin can change FMS categories');
      return;
    }

    try {
      await axios.put(`${address}/api/fms-categories/${fmsId}/category`, {
        category: newCategory,
        role: user?.role
      });
      setEditingFMS(null);
      await fetchFMSTemplates();
    } catch (error: any) {
      console.error('Error updating FMS category:', error);
      alert(error.response?.data?.message || 'Failed to update category');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    if (user?.role !== 'superadmin') {
      alert('Only Super Admin can add categories');
      return;
    }

    try {
      await axios.post(`${address}/api/fms-categories/categories`, {
        name: newCategory.trim(),
        role: user?.role
      });
      setNewCategory('');
      setShowCategoryModal(false);
      await fetchFMSTemplates();
    } catch (error: any) {
      console.error('Error adding category:', error);
      alert(error.response?.data?.message || 'Failed to add category');
    }
  };

  // Filter and search FMS templates
  const filteredFMS = useMemo(() => {
    return fmsList.filter(fms => {
      const matchesCategory = selectedCategory === 'all' || fms.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        fms.fmsName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fms.fmsId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fms.createdBy.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [fmsList, selectedCategory, searchQuery]);

  // Group by category
  const groupedFMS = useMemo(() => {
    const groups: { [key: string]: FMSTemplate[] } = {};
    filteredFMS.forEach(fms => {
      const cat = fms.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(fms);
    });
    return groups;
  }, [filteredFMS]);

  // Print FMS
  const handlePrint = useCallback((fms: FMSTemplate) => {
    const printWindow = window.open('', '', 'height=600,width=1000');
    if (!printWindow) return;

    let stepsHTML = fms.steps.map((step) => `
      <div style="page-break-inside: avoid; border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Step ${step.stepNo}: ${step.what}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div><strong>Who:</strong> ${formatAssignees(step.who)}</div>
          <div><strong>How:</strong> ${step.how}</div>
          <div><strong>Duration:</strong> ${getStepDuration(step)}</div>
          <div><strong>Type:</strong> ${step.whenType === 'fixed' ? 'Fixed Duration' : step.whenType === 'dependent' ? 'Dependent' : 'Ask On Completion'}</div>
        </div>
      </div>
    `).join('');

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${fms.fmsName} - Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: white; }
          h1 { color: #2563eb; margin-bottom: 10px; }
          .header { border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 14px; }
          .info div { background: #f3f4f6; padding: 10px; border-radius: 5px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${fms.fmsName}</h1>
          <p style="margin: 5px 0; color: #666;">${fms.fmsId}</p>
        </div>
        <div class="info">
          <div><strong>Steps:</strong> ${fms.stepCount}</div>
          <div><strong>Total Time:</strong> ${fms.totalTimeFormatted}</div>
          <div><strong>Created By:</strong> ${fms.createdBy}</div>
          <div><strong>Created On:</strong> ${new Date(fms.createdOn).toLocaleDateString()}</div>
        </div>
        <h2 style="color: #333; margin-top: 30px; margin-bottom: 15px;">Steps Details</h2>
        ${stepsHTML}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  }, [formatAssignees, getStepDuration]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading FMS templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">FMS Templates</h1>
              <p className="text-gray-600">Manage and view your workflow templates</p>
            </div>
            
            <button
              onClick={() => navigate('/create-fms')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
            >
              <Plus size={20} />
              <span>Create New FMS</span>
            </button>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by name, ID, or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="sm:w-64">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="all">All Categories ({fmsList.length})</option>
                  {categories.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Manage Categories (Admin) */}
              {user?.role === 'superadmin' && (
                <button
                  onClick={() => setShowCategoryModal(true)}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <Filter size={18} />
                  <span>Manage</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {filteredFMS.length} of {fmsList.length} templates
        </div>

        {/* FMS List */}
        {filteredFMS.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <List size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try adjusting your filters or search terms' 
                : 'Get started by creating your first FMS template'}
            </p>
            <button
              onClick={() => navigate('/create-fms')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Create New Template
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedFMS).map(([categoryName, categoryFMS]) => (
              <div key={categoryName} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{categoryName}</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    {categoryFMS.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {categoryFMS.map((fms) => (
                    <div key={fms._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                      {/* Card Header */}
                      <div 
                        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedFMS(expandedFMS === fms._id ? null : fms._id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-xl font-bold text-gray-900 truncate">{fms.fmsName}</h3>
                              <span className="px-3 py-1 bg-blue-600 text-white text-xs font-mono rounded-full shrink-0">
                                {fms.fmsId}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <List size={16} className="text-gray-400" />
                                <span className="font-semibold text-gray-900">{fms.stepCount}</span> steps
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock size={16} className="text-gray-400" />
                                {fms.totalTimeFormatted}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <User size={16} className="text-gray-400" />
                                {fms.createdBy}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Calendar size={16} className="text-gray-400" />
                                {new Date(fms.createdOn).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {user?.role === 'superadmin' && editingFMS === fms._id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={fms.category}
                                  onChange={(e) => handleCategoryChange(fms._id, e.target.value)}
                                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                >
                                  {categories.map(cat => (
                                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setEditingFMS(null)}
                                  className="p-1.5 hover:bg-gray-100 rounded"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <>
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFMS(fms._id);
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Edit Category"
                                  >
                                    <Edit size={18} className="text-gray-600" />
                                  </button>
                                )}
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/create-fms?edit=${fms._id}`);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                    title="Edit FMS Template"
                                  >
                                    <Edit size={16} />
                                    <span>Edit</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowPreview(fms);
                                  }}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                                >
                                  <Eye size={16} />
                                  Preview
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrint(fms);
                                  }}
                                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                                >
                                  <Printer size={16} />
                                  Print
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/start-project?fmsId=${fms._id}`);
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                                >
                                  Start Project
                                </button>
                              </>
                            )}
                            
                            {expandedFMS === fms._id ? (
                              <ChevronUp size={24} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={24} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedFMS === fms._id && (
                        <div className="border-t border-gray-200 p-6 bg-gray-50">
                          <h4 className="text-lg font-bold text-gray-900 mb-4">Workflow Steps</h4>
                          <div className="space-y-3">
                            {fms.steps.map((step) => (
                              <div key={step.stepNo} className="bg-white rounded-lg p-4 border border-gray-200">
                                <div className="flex items-start justify-between mb-3">
                                  <h5 className="text-base font-bold text-gray-900">
                                    Step {step.stepNo}: {step.what}
                                  </h5>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    step.whenType === 'fixed' ? 'bg-blue-100 text-blue-700' :
                                    step.whenType === 'dependent' ? 'bg-purple-100 text-purple-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {step.whenType === 'fixed' ? 'Fixed' : 
                                     step.whenType === 'dependent' ? 'Dependent' : 'On Completion'}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-700">Who: </span>
                                    <span className="text-gray-600">{formatAssignees(step.who)}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-700">How: </span>
                                    <span className="text-gray-600">{step.how}</span>
                                  </div>
                                  <div className="md:col-span-2">
                                    <span className="font-semibold text-gray-700">Duration: </span>
                                    <span className="text-gray-600">{getStepDuration(step)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Category Management Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Manage Categories</h3>
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Add New Category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Check size={18} />
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Current Categories</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {categories.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">{cat.name}</span>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {cat.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-white">{showPreview.fmsName}</h3>
                  <p className="text-blue-100 text-sm mt-1">{showPreview.fmsId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(showPreview)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Printer size={18} />
                    Print
                  </button>
                  <button
                    onClick={() => setShowPreview(null)}
                    className="px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 font-semibold"
                  >
                    <X size={18} />
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 font-medium">Steps:</span>
                      <p className="text-gray-900 font-bold text-lg">{showPreview.stepCount}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Duration:</span>
                      <p className="text-gray-900 font-bold text-lg">{showPreview.totalTimeFormatted}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Created By:</span>
                      <p className="text-gray-900 font-bold text-lg">{showPreview.createdBy}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 font-medium">Created:</span>
                      <p className="text-gray-900 font-bold text-lg">{new Date(showPreview.createdOn).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <h4 className="text-lg font-bold text-gray-900 mb-4">Workflow Steps</h4>
                <div className="space-y-4">
                  {showPreview.steps.map((step, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-5 border-l-4 border-blue-500 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {step.stepNo}
                          </div>
                          <h5 className="text-base font-bold text-gray-900">{step.what}</h5>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          step.whenType === 'fixed' ? 'bg-blue-100 text-blue-700' :
                          step.whenType === 'dependent' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {step.whenType === 'fixed' ? 'Fixed' : 
                           step.whenType === 'dependent' ? 'Dependent' : 'On Completion'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Who: </span>
                          <span className="text-gray-600">{formatAssignees(step.who)}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">How: </span>
                          <span className="text-gray-600">{step.how}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-semibold text-gray-700">Duration: </span>
                          <span className="text-gray-600">{getStepDuration(step)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewAllFMS;
