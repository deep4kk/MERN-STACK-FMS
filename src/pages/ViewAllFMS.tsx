import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp, Eye, Printer, Edit, Download } from 'lucide-react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { address } from '../../utils/ipAddress';
import { useAuth } from '../contexts/AuthContext';
import MermaidDiagram from '../components/MermaidDiagram';

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
  const [showMermaid, setShowMermaid] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [editingFMS, setEditingFMS] = useState<string | null>(null);
  const [downloadingPdfs, setDownloadingPdfs] = useState(false);

  const escapeHtml = (value: string | undefined | null) => {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const getStepDurationText = (step: any) => {
    if (step.whenType === 'ask-on-completion') {
      return 'Ask on completion';
    }
    if (step.whenUnit === 'days+hours') {
      return `${step.whenDays || 0}d ${step.whenHours || 0}h`;
    }
    return `${step.when || 0} ${step.whenUnit || 'days'}`;
  };

  const formatAssigneeNames = (who: any): string => {
    if (!Array.isArray(who)) return 'N/A';
    const resolved = who
      .map((w: any) => {
        if (typeof w === 'object' && w !== null) {
          return w.username || w.name || w.email || (typeof w.toString === 'function' ? w.toString() : '') || '';
        }
        if (typeof w === 'string') {
          return w;
        }
        return '';
      })
      .filter(Boolean);

    return resolved.length ? resolved.join(', ') : 'N/A';
  };

  const getPrintableStyles = () => `
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 12px;
      line-height: 1.4;
      color: #333;
      font-size: 11px;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }
    .header h1 {
      color: #007bff;
      margin: 0;
      font-size: 18px;
      font-weight: bold;
    }
    .header p {
      margin: 3px 0;
      color: #666;
      font-size: 11px;
    }
    .category-badge {
      display: inline-block;
      background: #28a745;
      color: white;
      padding: 3px 10px;
      border-radius: 14px;
      font-size: 10px;
      font-weight: bold;
      margin-left: 8px;
    }
    .fms-info {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid #007bff;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      font-size: 10px;
    }
    .fms-info p {
      margin: 3px 0;
      font-size: 10px;
    }
    .steps-section {
      margin-top: 8px;
    }
    .steps-section h2 {
      color: #007bff;
      border-bottom: 1px solid #dee2e6;
      padding-bottom: 4px;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .steps-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .step {
      border: 1px solid #e9ecef;
      border-radius: 6px;
      padding: 10px;
      background: white;
      font-size: 10px;
      page-break-inside: avoid;
    }
    .step-header {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 11px;
      color: #495057;
      display: flex;
      align-items: center;
    }
    .step-number {
      background: #007bff;
      color: white;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      margin-right: 8px;
      flex-shrink: 0;
      font-size: 10px;
    }
    .detail-row {
      margin-bottom: 5px;
      display: flex;
      align-items: flex-start;
      font-size: 10px;
    }
    .label {
      font-weight: bold;
      display: inline-block;
      width: 60px;
      color: #495057;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .value {
      flex: 1;
      font-size: 10px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .checklist-items {
      margin: 0;
      padding-left: 14px;
      list-style: disc;
      font-size: 10px;
    }
    .checklist-items li {
      margin-bottom: 2px;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #6c757d;
      border-top: 1px solid #dee2e6;
      padding-top: 10px;
    }
  `;

  const buildPrintableBody = (fms: FMSTemplate) => `
    <div class="header">
      <h1>FMS Template: ${escapeHtml(fms.fmsName)}</h1>
      <p>FMS ID: ${escapeHtml(fms.fmsId)} <span class="category-badge">${escapeHtml(fms.category || 'General')}</span></p>
    </div>
    <div class="fms-info">
      <p><strong>Created by:</strong> ${escapeHtml(fms.createdBy || '')}</p>
      <p><strong>Created:</strong> ${escapeHtml(new Date(fms.createdOn).toLocaleDateString())}</p>
      <p><strong>Category:</strong> ${escapeHtml(fms.category || 'General')}</p>
      <p><strong>Total Steps:</strong> ${fms.stepCount}</p>
      <p><strong>Duration:</strong> ${escapeHtml(fms.totalTimeFormatted || '')}</p>
      <p><strong>Status:</strong> ${escapeHtml(fms.status || 'Active')}</p>
    </div>
    <div class="steps-section">
      <h2>Workflow Steps</h2>
      <div class="steps-grid">
        ${fms.steps.map(step => `
          <div class="step">
            <div class="step-header">
              <div class="step-number">${step.stepNo}</div>
              <div>${escapeHtml(step.what || 'Task Description')}</div>
            </div>
            <div class="detail-row">
              <span class="label">WHO:</span>
              <span class="value">${escapeHtml(formatAssigneeNames(step.who))}</span>
            </div>
            <div class="detail-row">
              <span class="label">HOW:</span>
              <span class="value">${escapeHtml(step.how || 'Method not specified')}</span>
            </div>
            <div class="detail-row">
              <span class="label">WHEN:</span>
              <span class="value">${escapeHtml(getStepDurationText(step))}</span>
            </div>
            ${step.whenType ? `
              <div class="detail-row">
                <span class="label">Type:</span>
                <span class="value">${escapeHtml(step.whenType === 'fixed' ? 'Fixed' : step.whenType === 'dependent' ? 'Dependent' : 'Ask')}</span>
              </div>
            ` : ''}
            ${step.requiresChecklist && step.checklistItems?.length ? `
              <div class="detail-row checklist-row">
                <span class="label">Check:</span>
                <span class="value">
                  <ul class="checklist-items">
                    ${step.checklistItems.map((item: any) => `<li>${escapeHtml(item.text || '')}</li>`).join('')}
                  </ul>
                </span>
              </div>
            ` : ''}
            ${step.attachments?.length ? `
              <div class="detail-row">
                <span class="label">Files:</span>
                <span class="value">${step.attachments.length} file(s)</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="footer">
      <p><strong>FMS Management System</strong> | Generated on ${escapeHtml(new Date().toLocaleString())}</p>
    </div>
  `;

  const buildPrintableDocument = (fms: FMSTemplate) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>FMS Template: ${escapeHtml(fms.fmsName)}</title>
        <style>
          @page {
            size: A4;
            margin: 0.5cm;
          }
          ${getPrintableStyles()}
        </style>
      </head>
      <body>
        ${buildPrintableBody(fms)}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  const createHiddenPrintableNode = (fms: FMSTemplate) => {
    const node = document.createElement('div');
    node.style.position = 'fixed';
    node.style.top = '-10000px';
    node.style.left = '-10000px';
    node.style.width = '794px';
    node.style.background = '#ffffff';
    node.innerHTML = `<style>${getPrintableStyles()}</style>${buildPrintableBody(fms)}`;
    document.body.appendChild(node);
    return node;
  };

  const sanitizeFileName = (value: string) => {
    if (!value) return 'template';
    return value.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'template';
  };

  useEffect(() => {
    fetchFMSTemplates();
  }, [user, selectedCategory]);

  const fetchCategories = async (currentFmsList: FMSTemplate[] = []) => {
    try {
      const response = await axios.get(`${address}/api/fms-categories/categories`);
      if (response.data.success && response.data.categories) {
        // Get category counts from FMS list
        const categoryCounts = currentFmsList.reduce((acc: { [key: string]: number }, fms: FMSTemplate) => {
          const category = fms.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});

        // Merge API categories with counts from FMS list
        const categoriesList = response.data.categories.map((cat: any) => ({
          name: cat.name,
          count: categoryCounts[cat.name] || 0
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));

        setCategories(categoriesList);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback: calculate from FMS list if API fails
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
        // Fetch categories after FMS list is loaded, passing the list to avoid dependency
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
      setShowCategoryEdit(false);
      await fetchFMSTemplates(); // This will refresh both FMS list and categories
    } catch (error: any) {
      console.error('Error adding category:', error);
      alert(error.response?.data?.message || 'Failed to add category');
    }
  };

  const toggleExpand = (fmsId: string) => {
    setExpandedFMS(expandedFMS === fmsId ? null : fmsId);
  };

  const handlePrintFMS = (fms: FMSTemplate) => {
    const printWindow = window.open('', '', 'height=600,width=1000');
    if (!printWindow) return;

    let stepsHTML = fms.steps.map((step) => `
      <div style="page-break-inside: avoid; border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Step ${step.stepNo}: ${step.what}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
          <div><strong>Who:</strong> ${Array.isArray(step.who) ? step.who.map((w: any) => w.username || w).join(', ') : 'N/A'}</div>
          <div><strong>How:</strong> ${step.how}</div>
          <div><strong>Duration:</strong> ${step.whenUnit === 'days+hours' ? `${step.whenDays || 0}d ${step.whenHours || 0}h` : `${step.when} ${step.whenUnit}`}</div>
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
  };

  const printFMS = async (fms: FMSTemplate) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(buildPrintableDocument(fms));
    printWindow.document.close();
  };

  const downloadFmsAsPdf = async (fms: FMSTemplate) => {
    if (typeof window === 'undefined') return;

    try {
      const node = createHiddenPrintableNode(fms);

      try {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${sanitizeFileName(fms.fmsId)}-${sanitizeFileName(fms.fmsName)}.pdf`);
      } catch (pdfError) {
        console.error(`Failed to generate PDF for ${fms.fmsName}`, pdfError);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        node.remove();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const downloadAllFmsAsPdf = async () => {
    if (typeof window === 'undefined' || downloadingPdfs || fmsList.length === 0) return;

    setDownloadingPdfs(true);
    try {
      const zip = new JSZip();

      for (const fms of fmsList) {
        const node = createHiddenPrintableNode(fms);

        try {
          const canvas = await html2canvas(node, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          const blob = pdf.output('blob');
          zip.file(`${sanitizeFileName(fms.fmsId)}-${sanitizeFileName(fms.fmsName)}.pdf`, blob);
        } catch (pdfError) {
          console.error(`Failed to render PDF for ${fms.fmsName}`, pdfError);
        } finally {
          node.remove();
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `fms-templates-${new Date().toISOString().split('T')[0]}.zip`);
    } catch (error) {
      console.error('Error generating PDF bundle:', error);
    } finally {
      setDownloadingPdfs(false);
    }
  };

  const generateMermaidDiagram = (steps: any[]) => {
    // Use LR (left-right) layout for better horizontal flow
    let diagram = 'graph LR\n';

    // Style definitions for better appearance
    diagram += '    classDef stepBox fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#000\n';
    diagram += '    classDef stepBoxAlt fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#000\n';

    steps.forEach((step, index) => {
      const stepId = `S${step.stepNo}`;
      const nextStepId = index < steps.length - 1 ? `S${steps[index + 1].stepNo}` : null;

      // Enhanced assignee resolution - truncate for compact display
      let assignees = formatAssigneeNames(step.who);
      if (assignees.length > 30) {
        assignees = `${assignees.substring(0, 30)}...`;
      }

      const duration = step.whenUnit === 'days+hours'
        ? `${step.whenDays || 0}d ${step.whenHours || 0}h`
        : step.whenType === 'ask-on-completion'
          ? 'Ask on completion'
          : `${step.when || 0} ${step.whenUnit || 'days'}`;

      // Create compact step description - truncate long text
      let stepDescription = step.what || `Step ${step.stepNo}`;
      if (stepDescription.length > 40) stepDescription = stepDescription.substring(0, 40) + '...';

      let howDescription = step.how || 'Method not specified';
      if (howDescription.length > 30) howDescription = howDescription.substring(0, 30) + '...';

      // Use alternating colors for better visual distinction
      const boxClass = index % 2 === 0 ? 'stepBox' : 'stepBoxAlt';

      diagram += `    ${stepId}["<b>Step ${step.stepNo}</b><br/><b>WHAT:</b> ${stepDescription}<br/><b>WHO:</b> ${assignees}<br/><b>HOW:</b> ${howDescription}<br/><b>WHEN:</b> ${duration}"]\n`;
      diagram += `    class ${stepId} ${boxClass}\n`;

      if (nextStepId) {
        diagram += `    ${stepId} -->|Next| ${nextStepId}\n`;
      }
    });

    return diagram;
  };

  // Helper function to format assignee names in the details view
  const formatAssigneeForDetails = (who: any): string => formatAssigneeNames(who);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--color-text)]">Loading FMS templates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">FMS Templates</h1>
            <p className="text-[var(--color-textSecondary)]">View and manage workflow templates</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Category Filter */}
            <div className="relative">
              <label className="block text-xs mb-1" style={{ color: 'var(--color-textSecondary)' }}>
                Filter by Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 rounded-lg border text-sm min-w-[180px]"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)'
                }}
              >
                <option value="all">All Categories</option>
                {categories.length === 0 ? (
                  <option disabled>No categories available</option>
                ) : (
                  categories.map(cat => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Category Management for Superadmin Only */}
            {user?.role === 'superadmin' && (
              <div className="relative">
                <button
                  onClick={() => setShowCategoryEdit(true)}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                >
                  Manage Categories
                </button>

                {showCategoryEdit && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg z-50 p-4 border"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)'
                    }}
                  >
                    <div className="flex flex-col gap-3">
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        Add New Category
                      </h4>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category name"
                        className="px-3 py-2 rounded border text-sm"
                        style={{
                          backgroundColor: 'var(--color-background)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)'
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      />
                      <button
                        onClick={handleAddCategory}
                        className="px-3 py-2 rounded bg-[var(--color-primary)] text-white text-sm hover:opacity-90"
                      >
                        Add Category
                      </button>
                      <button
                        onClick={() => {
                          setShowCategoryEdit(false);
                          setNewCategory('');
                        }}
                        className="px-3 py-2 rounded border text-sm"
                        style={{
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text)'
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={downloadAllFmsAsPdf}
              disabled={downloadingPdfs || fmsList.length === 0}
              className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 ${downloadingPdfs || fmsList.length === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[var(--color-background)]'}`}
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)'
              }}
            >
              <Download size={18} />
              <span>{downloadingPdfs ? 'Preparing PDFs...' : 'Download PDFs'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/15 flex items-center gap-2 print:hidden"
            >
              <Printer size={18} />
              <span>Print</span>
            </button>

            <button
              onClick={() => navigate('/create-fms')}
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Create New FMS</span>
            </button>
          </div>
        </div>

        {fmsList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-textSecondary)] mb-4">No FMS templates found</p>
            <button
              onClick={() => navigate('/create-fms')}
              className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
            >
              Create Your First FMS Template
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {categories
              .filter(category => selectedCategory === 'all' || category.name === selectedCategory)
              .map(category => {
                const categoryFMS = fmsList.filter(fms =>
                  (fms.category || 'Uncategorized') === category.name
                );

                if (categoryFMS.length === 0) return null;

                return (
                  <div key={category.name} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-[var(--color-text)]">
                        {category.name} ({categoryFMS.length})
                      </h2>
                    </div>

                    <div className="space-y-4">
                      {categoryFMS.map((fms) => (
                        <div
                          key={fms._id}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
                        >
                          <div
                            className="p-6 cursor-pointer hover:bg-[var(--color-background)] transition-colors"
                            onClick={() => toggleExpand(fms.fmsId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h3 className="text-xl font-bold text-[var(--color-text)]">{fms.fmsName}</h3>
                                  <span className="px-3 py-1 bg-[var(--color-primary)] text-white text-xs rounded-full">
                                    {fms.fmsId}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-6 text-sm text-[var(--color-textSecondary)]">
                                  <span>{fms.stepCount} Steps</span>
                                  <span>Total Time: {fms.totalTimeFormatted}</span>
                                  <span>Created by: {fms.createdBy}</span>
                                  <span>Created: {new Date(fms.createdOn).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                                  <div className="relative">
                                    {editingFMS === fms._id ? (
                                      <div className="flex items-center space-x-2">
                                        <select
                                          value={fms.category || 'Uncategorized'}
                                          onChange={(e) => handleCategoryChange(fms._id, e.target.value)}
                                          className="px-2 py-1 rounded border text-sm"
                                          style={{
                                            backgroundColor: 'var(--color-surface)',
                                            borderColor: 'var(--color-border)',
                                            color: 'var(--color-text)'
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {categories.map(cat => (
                                            <option key={cat.name} value={cat.name}>
                                              {cat.name}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingFMS(null);
                                          }}
                                          className="text-[var(--color-textSecondary)] hover:text-[var(--color-text)]"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingFMS(fms._id);
                                        }}
                                        className="p-2 hover:bg-[var(--color-background)] rounded-full"
                                        title="Edit Category"
                                      >
                                        <Edit size={16} className="text-[var(--color-textSecondary)]" />
                                      </button>
                                    )}
                                  </div>
                                )}
                                {user?.role === 'superadmin' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/create-fms?edit=${fms._id}`);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                                    title="Edit FMS Template (Super Admin Only)"
                                  >
                                    <Edit size={16} />
                                    <span>Edit FMS</span>
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMermaid(showMermaid === fms.fmsId ? null : fms.fmsId);
                                  }}
                                  className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
                                >
                                  <Eye size={16} />
                                  <span>Preview</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void printFMS(fms);
                                  }}
                                  className="px-4 py-2 bg-[var(--color-secondary)] text-white rounded-lg hover:opacity-90 flex items-center gap-2"
                                >
                                  <Printer size={16} />
                                  Print
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void downloadFmsAsPdf(fms);
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                                >
                                  <Download size={16} />
                                  Download PDF
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/start-project?fmsId=${fms._id}`);
                                  }}
                                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
                                >
                                  Start Project
                                </button>
                                {expandedFMS === fms.fmsId ? (
                                  <ChevronUp size={24} className="text-[var(--color-text)]" />
                                ) : (
                                  <ChevronDown size={24} className="text-[var(--color-text)]" />
                                )}
                              </div>
                            </div>
                          </div>

                          {showMermaid === fms.fmsId && (
                            <div
                              className="fixed inset-0 bg-gradient-to-br from-gray-900/95 via-gray-900/90 to-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
                              onClick={() => setShowMermaid(null)}
                            >
                              <div
                                className="bg-white dark:bg-gray-800 rounded-3xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden shadow-2xl transform transition-all animate-slideUp border-2 border-gray-200 dark:border-gray-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Premium Header */}
                                <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-6 flex items-center justify-between z-10 shadow-lg">
                                  <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <h4 className="text-2xl font-bold text-white drop-shadow-lg">
                                        {fms.fmsName}
                                      </h4>
                                      <p className="text-sm text-white/90 mt-1">Process Workflow Visualization</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => void printFMS(fms)}
                                      className="px-5 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2 border border-white/30"
                                    >
                                      <Printer size={18} />
                                      <span>Print</span>
                                    </button>
                                    <button
                                      onClick={() => void downloadFmsAsPdf(fms)}
                                      className="px-5 py-2.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2 border border-white/30"
                                    >
                                      <Download size={18} />
                                      <span>Download PDF</span>
                                    </button>
                                    <button
                                      onClick={() => setShowMermaid(null)}
                                      className="px-5 py-2.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                      <span>Close</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Workflow Info Bar */}
                                <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-8 py-4 border-b border-gray-200 dark:border-gray-600">
                                  <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-6">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 dark:text-gray-300 font-medium">📋 FMS ID:</span>
                                        <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-lg font-mono text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500">{fms.fmsId}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 dark:text-gray-300 font-medium">📊 Steps:</span>
                                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-lg font-bold text-blue-700 dark:text-blue-200">{fms.steps.length}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-600 dark:text-gray-300 font-medium">⏱️ Duration:</span>
                                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-lg font-semibold text-purple-700 dark:text-purple-200">{fms.totalTimeFormatted}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-600 dark:text-gray-300 font-medium">👤 Created by:</span>
                                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900 rounded-lg font-semibold text-green-700 dark:text-green-200">{fms.createdBy}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Diagram Container */}
                                <div className="p-8 overflow-auto" style={{ maxHeight: 'calc(95vh - 220px)' }}>
                                  <div className="bg-gradient-to-br from-white via-blue-50 to-purple-50 dark:from-gray-800 dark:via-gray-750 dark:to-gray-700 p-8 rounded-2xl border-2 border-gray-200 dark:border-gray-600 shadow-inner">
                                    <div className="min-h-[500px] flex items-center justify-center">
                                      <MermaidDiagram chart={generateMermaidDiagram(fms.steps)} />
                                    </div>
                                  </div>
                                </div>

                                {/* Footer */}
                                <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 px-8 py-4 border-t border-gray-200 dark:border-gray-600">
                                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                                    <span className="flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                      </svg>
                                      Created: {new Date(fms.createdOn).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="font-medium">© {new Date().getFullYear()} FMS Workflow System</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {expandedFMS === fms.fmsId && (
                            <div className="px-6 pb-6 border-t border-[var(--color-border)]">
                              <h4 className="text-lg font-bold text-[var(--color-text)] mb-4 mt-4">
                                Steps Details
                              </h4>
                              <div className="space-y-4">
                                {fms.steps.map((step, index) => (
                                  <div
                                    key={index}
                                    className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <h5 className="text-lg font-bold text-[var(--color-text)]">Step {step.stepNo}</h5>
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs ${step.whenType === 'fixed'
                                            ? 'bg-blue-100 text-blue-800'
                                            : step.whenType === 'dependent'
                                              ? 'bg-purple-100 text-purple-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                      >
                                        {step.whenType === 'fixed'
                                          ? 'Fixed Duration'
                                          : step.whenType === 'dependent'
                                            ? 'Dependent'
                                            : 'Ask On Completion'}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-1">What</p>
                                        <p className="text-[var(--color-text)]">{step.what}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-1">Who</p>
                                        <p className="text-[var(--color-text)]">{formatAssigneeForDetails(step.who)}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-1">How</p>
                                        <p className="text-[var(--color-text)]">{step.how}</p>
                                      </div>

                                      <div>
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-1">Duration</p>
                                        <p className="text-[var(--color-text)]">
                                          {step.whenUnit === 'days+hours'
                                            ? `${step.whenDays || 0} days, ${step.whenHours || 0} hours`
                                            : step.whenType === 'ask-on-completion'
                                              ? 'Ask on completion'
                                              : `${step.when} ${step.whenUnit}`}
                                        </p>
                                      </div>
                                    </div>

                                    {step.requiresChecklist && step.checklistItems?.length > 0 && (
                                      <div className="mt-4">
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-2">Checklist</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {step.checklistItems.map((item: any, idx: number) => (
                                            <li key={idx} className="text-[var(--color-text)] text-sm">{item.text}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {step.attachments?.length > 0 && (
                                      <div className="mt-4">
                                        <p className="text-sm font-medium text-[var(--color-textSecondary)] mb-2">
                                          Attachments ({step.attachments.length})
                                        </p>
                                        <ul className="space-y-1">
                                          {step.attachments.map((attachment: any, idx: number) => (
                                            <li key={idx} className="text-[var(--color-text)] text-sm">
                                              {attachment.originalName}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewAllFMS;