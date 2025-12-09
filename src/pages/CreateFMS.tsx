import React, { useState, useEffect } from 'react';
import { Plus, Save, ArrowLeft, FileText, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { address } from '../../utils/ipAddress';
import { toast } from 'react-toastify';
import SectionCard from '../components/fms/SectionCard';
import FormField from '../components/fms/FormField';
import StepCard from '../components/fms/StepCard';
import FrequencySettings from '../components/fms/FrequencySettings';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Step {
  stepNo: number;
  what: string;
  who: string; // Changed from string[] to string for single doer
  how: string;
  when: number;
  whenUnit: 'days' | 'hours' | 'days+hours';
  whenDays?: number;
  whenHours?: number;
  whenType: 'fixed' | 'dependent' | 'ask-on-completion';
  dependentOnStep?: number; // Step number this step depends on
  dependentDelay?: number; // Delay after dependent step
  dependentDelayUnit?: 'days' | 'hours'; // Unit for delay
  requiresChecklist: boolean;
  checklistItems: ChecklistItem[];
  attachments: File[];
  triggersFMSId?: string;
  requireAttachments: boolean;
  mandatoryAttachments: boolean;
}

const CreateFMS: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editFmsId = searchParams.get('edit');
  const isEditMode = !!editFmsId;
  
  const [fmsName, setFmsName] = useState('');
  const [category, setCategory] = useState('General');
  const [categories, setCategories] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([{
    stepNo: 1,
    what: '',
    who: '',
    how: '',
    when: 1,
    whenUnit: 'days',
    whenType: 'fixed',
    requiresChecklist: false,
    checklistItems: [],
    attachments: [],
    requireAttachments: false,
    mandatoryAttachments: false
  }]);
  const [users, setUsers] = useState<any[]>([]);
  const [fmsList, setFmsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [userSearchTerms, setUserSearchTerms] = useState<string[]>(['']);
  const [frequency, setFrequency] = useState<'one-time' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('one-time');
  const [frequencySettings, setFrequencySettings] = useState({
    includeSunday: true,
    shiftSundayToMonday: true,
    weeklyDays: [] as number[],
    monthlyDay: 1,
    yearlyDuration: 3
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);


  useEffect(() => {
    fetchUsers();
    fetchFmsList();
    fetchCategories();
    if (isEditMode && editFmsId) {
      fetchFMSForEdit(editFmsId);
    }
  }, [isEditMode, editFmsId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${address}/api/users`);
      setUsers(response.data.filter((u: any) => u.isActive));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchFmsList = async () => {
    try {
      const params = {
        userId: user?.id,
        isAdmin: (user?.role === 'admin' || user?.role === 'superadmin') ? 'true' : 'false'
      };
      const response = await axios.get(`${address}/api/fms`, { params });
      setFmsList(response.data.fmsList || []);
    } catch (error) {
      console.error('Error fetching FMS list:', error);
      setFmsList([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${address}/api/fms-categories/categories`);
      const categoryNames = response.data.categories?.map((c: any) => c.name) || ['General'];
      setCategories(categoryNames.length > 0 ? categoryNames : ['General']);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(['General']);
    }
  };

  const fetchFMSForEdit = async (fmsId: string) => {
    try {
      setLoading(true);
      console.log('Fetching FMS for edit with ID:', fmsId);
      console.log('Full URL:', `${address}/api/fms/${fmsId}`);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${address}/api/fms/${fmsId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('FMS data received:', response.data);
      const fmsData = response.data;
      
      // Populate form with existing data
      setFmsName(fmsData.fmsName || '');
      setCategory(fmsData.category || 'General');
      setFrequency(fmsData.frequency || 'one-time');
      setFrequencySettings(fmsData.frequencySettings || {
        includeSunday: true,
        shiftSundayToMonday: true,
        weeklyDays: [],
        monthlyDay: 1,
        yearlyDuration: 3
      });
      
      // Populate steps
      if (fmsData.steps && fmsData.steps.length > 0) {
        const loadedSteps = fmsData.steps.map((step: any, index: number) => ({
          stepNo: index + 1,
          what: step.what || '',
          who: step.who ? (Array.isArray(step.who) ? (step.who[0] ? (typeof step.who[0] === 'string' ? step.who[0] : step.who[0]._id || step.who[0].id) : '') : (typeof step.who === 'string' ? step.who : step.who._id || step.who.id)) : '',
          how: step.how || '',
          when: step.when || 1,
          whenUnit: step.whenUnit || 'days',
          whenDays: step.whenDays,
          whenHours: step.whenHours,
          whenType: step.whenType || 'fixed',
          dependentOnStep: step.dependentOnStep,
          dependentDelay: step.dependentDelay,
          dependentDelayUnit: step.dependentDelayUnit,
          requiresChecklist: step.requiresChecklist || false,
          checklistItems: step.checklistItems || [],
          attachments: [], // Existing attachments are kept on server
          triggersFMSId: step.triggersFMSId,
          requireAttachments: step.requireAttachments || false,
          mandatoryAttachments: step.mandatoryAttachments || false
        }));
        setSteps(loadedSteps);
        setUserSearchTerms(loadedSteps.map(() => ''));
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching FMS for edit:', error);
      setLoading(false);
      
      // Don't show alert or navigate if it's an auth error (401/403)
      // The axios interceptor will handle the redirect to login
      if (error.response?.status === 401 || error.response?.status === 403) {
        return;
      }
      
      alert('Failed to load FMS template for editing');
      navigate('/fms-templates');
    }
  };

  const addStep = (insertAfterIndex?: number) => {
    const newStep: Step = {
      stepNo: insertAfterIndex !== undefined ? insertAfterIndex + 2 : steps.length + 1,
      what: '',
      who: '',
      how: '',
      when: 1,
      whenUnit: 'days' as const,
      whenType: insertAfterIndex !== undefined && insertAfterIndex >= 0 ? 'dependent' as const : 'fixed' as const,
      requiresChecklist: false,
      checklistItems: [],
      attachments: [],
      requireAttachments: false,
      mandatoryAttachments: false
    };

    if (insertAfterIndex !== undefined) {
      // Insert step at specific position
      const newSteps = [...steps];
      const newUserSearchTerms = [...userSearchTerms];
      
      newSteps.splice(insertAfterIndex + 1, 0, newStep);
      newUserSearchTerms.splice(insertAfterIndex + 1, 0, '');
      
      // Update step numbers
      newSteps.forEach((step, index) => {
        step.stepNo = index + 1;
      });

      setSteps(newSteps);
      setUserSearchTerms(newUserSearchTerms);
    } else {
      // Add at the end
      setSteps([...steps, newStep]);
      setUserSearchTerms(prev => [...prev, '']);
    }
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    newSteps.forEach((step, i) => {
      step.stepNo = i + 1;
    });
    
    // Update dependent step references - remove invalid dependencies
    newSteps.forEach((step) => {
      if (step.whenType === 'dependent' && step.dependentOnStep) {
        // If the dependent step was removed or is now invalid, clear the dependency
        if (step.dependentOnStep > newSteps.length || step.dependentOnStep >= step.stepNo) {
          step.dependentOnStep = undefined;
          step.dependentDelay = undefined;
          step.dependentDelayUnit = undefined;
        } else if (step.dependentOnStep > index) {
          // If the dependent step was after the removed step, adjust the step number
          step.dependentOnStep = step.dependentOnStep - 1;
        }
      }
    });
    
    setSteps(newSteps);
    setUserSearchTerms(prev => prev.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    (newSteps[index] as any)[field] = value;

    if (field === 'whenType') {
      if (value === 'ask-on-completion') {
        newSteps[index].when = 0;
        newSteps[index].whenDays = 0;
        newSteps[index].whenHours = 0;
      } else if (value === 'fixed' && index === 0) {
        newSteps[index].whenUnit = 'days';
        newSteps[index].when = 1;
      }
    }

    setSteps(newSteps);
  };

  const updateUserSearchTerm = (index: number, value: string) => {
    const updated = [...userSearchTerms];
    updated[index] = value;
    setUserSearchTerms(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSteps = [...steps];
    const newUserSearchTerms = [...userSearchTerms];

    // Remove the dragged item
    const [draggedStep] = newSteps.splice(draggedIndex, 1);
    const [draggedSearchTerm] = newUserSearchTerms.splice(draggedIndex, 1);

    // Insert at new position
    newSteps.splice(dropIndex, 0, draggedStep);
    newUserSearchTerms.splice(dropIndex, 0, draggedSearchTerm);

    // Update step numbers
    newSteps.forEach((step, index) => {
      step.stepNo = index + 1;
    });

    // Update dependent step references to match new step numbers
    // Create a map of old step numbers to new step numbers by tracking which step moved where
    const stepNumberMap = new Map<number, number>();
    
    // First, create a mapping of old indices to new indices
    const indexMap = new Map<number, number>();
    steps.forEach((oldStep, oldIdx) => {
      const newIdx = newSteps.findIndex((newStep) => {
        // Match by step content (what and how) since stepNo will change
        return oldStep.what === newStep.what && oldStep.how === newStep.how && oldStep.who === newStep.who;
      });
      if (newIdx !== -1) {
        indexMap.set(oldIdx, newIdx);
        // Map old step number to new step number
        stepNumberMap.set(oldStep.stepNo, newIdx + 1);
      }
    });

    // Update dependent step references
    newSteps.forEach((step) => {
      if (step.whenType === 'dependent' && step.dependentOnStep) {
        const newDependentStepNo = stepNumberMap.get(step.dependentOnStep);
        if (newDependentStepNo !== undefined && newDependentStepNo < step.stepNo) {
          // Only update if the dependent step is before the current step
          step.dependentOnStep = newDependentStepNo;
        } else if (newDependentStepNo === undefined || newDependentStepNo >= step.stepNo) {
          // If we can't find the mapping or dependency is invalid, clear it
          step.dependentOnStep = undefined;
          step.dependentDelay = undefined;
          step.dependentDelayUnit = undefined;
        }
      }
    });

    setSteps(newSteps);
    setUserSearchTerms(newUserSearchTerms);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const addChecklistItem = (stepIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].checklistItems.push({
      id: Date.now().toString(),
      text: '',
      completed: false
    });
    setSteps(newSteps);
  };

  const updateChecklistItem = (stepIndex: number, itemIndex: number, text: string) => {
    const newSteps = [...steps];
    newSteps[stepIndex].checklistItems[itemIndex].text = text;
    setSteps(newSteps);
  };

  const removeChecklistItem = (stepIndex: number, itemIndex: number) => {
    const newSteps = [...steps];
    newSteps[stepIndex].checklistItems.splice(itemIndex, 1);
    setSteps(newSteps);
  };

  const handleFileChange = (stepIndex: number, files: FileList | null) => {
    if (files) {
      const newSteps = [...steps];
      newSteps[stepIndex].attachments = Array.from(files).slice(0, 10);
      setSteps(newSteps);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fmsName.trim()) {
      newErrors.fmsName = 'FMS name is required';
    }

    steps.forEach((step, index) => {
      if (!step.what.trim()) {
        newErrors[`step${index}_what`] = 'Task description is required';
      }
      if (!step.who || step.who.trim() === '') {
        newErrors[`step${index}_who`] = 'An assignee is required';
      }
      if (!step.how.trim()) {
        newErrors[`step${index}_how`] = 'Process/method is required';
      }
      if (step.requiresChecklist) {
        if (step.checklistItems.length === 0) {
          newErrors[`step${index}_checklist`] = 'At least one checklist item is required';
        } else {
          // Check if all checklist items have non-empty text
          const emptyItems = step.checklistItems.filter(item => !item.text || !item.text.trim());
          if (emptyItems.length > 0) {
            newErrors[`step${index}_checklist`] = 'All checklist items must have text';
          }
        }
      }
      
      // Validate dependent step configuration
      if (step.whenType === 'dependent') {
        if (!step.dependentOnStep || step.dependentOnStep < 1 || step.dependentOnStep >= step.stepNo) {
          newErrors[`step${index}_dependentOnStep`] = 'Please select a valid previous step';
        }
        if (step.dependentDelay === undefined || step.dependentDelay === null || !Number.isFinite(step.dependentDelay) || step.dependentDelay < 0) {
          newErrors[`step${index}_dependentDelay`] = 'Please enter a valid delay (>= 0)';
        }
        if (!step.dependentDelayUnit || !['days', 'hours'].includes(step.dependentDelayUnit)) {
          newErrors[`step${index}_dependentDelayUnit`] = 'Please select a delay unit';
        }
      }
      
      // Validate fixed duration
      if (step.whenType === 'fixed') {
        if (step.whenUnit === 'days' || step.whenUnit === 'hours') {
          if (!Number.isFinite(step.when) || step.when < 0) {
            newErrors[`step${index}_when`] = 'Please provide a valid duration';
          }
        }
        if (step.whenUnit === 'days+hours') {
          if (!Number.isFinite(step.whenDays) || (step.whenDays ?? 0) < 0) {
            newErrors[`step${index}_whenDays`] = 'Enter valid number of days';
          }
          if (!Number.isFinite(step.whenHours) || (step.whenHours ?? 0) < 0) {
            newErrors[`step${index}_whenHours`] = 'Enter valid number of hours';
          }
          // Ensure at least one is greater than 0
          if ((step.whenDays ?? 0) === 0 && (step.whenHours ?? 0) === 0) {
            newErrors[`step${index}_whenDays`] = 'Enter at least one day or hour';
          }
        }
      }
    });

    if (frequency === 'weekly' && frequencySettings.weeklyDays.length === 0) {
      newErrors.frequency = 'Select at least one weekday for weekly frequency';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    const isValid = validateForm();
    if (!isValid) {
      toast.error('Please fill all required fields correctly');
      // Scroll to first error after a brief delay to ensure errors are rendered
      setTimeout(() => {
        const firstErrorKey = Object.keys(errors)[0];
        if (firstErrorKey) {
          // Try to find the error element by various methods
          const errorElement = document.querySelector(`[data-error*="${firstErrorKey}"]`) || 
                             document.querySelector(`[name="${firstErrorKey}"]`) ||
                             document.getElementById(firstErrorKey) ||
                             document.querySelector(`[data-error]`);
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusableElement = errorElement.querySelector('input, textarea, select') as HTMLElement;
            if (focusableElement) {
              focusableElement.focus();
            }
          }
        }
      }, 100);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('fmsName', fmsName);
      formData.append('category', category);
      formData.append('createdBy', user?.id || '');
      formData.append('frequency', frequency);
      formData.append('frequencySettings', JSON.stringify(frequencySettings));

      // Prepare steps for submission
      const stepsData = steps.map(step => ({
        ...step,
        attachments: [], // Will be populated by backend
        when: step.whenType === 'ask-on-completion' ? 0 : step.when,
        whenDays: step.whenType === 'ask-on-completion' ? 0 : step.whenDays,
        whenHours: step.whenType === 'ask-on-completion' ? 0 : step.whenHours
      }));
      formData.append('steps', JSON.stringify(stepsData));

      // Append files with step index
      steps.forEach((step, index) => {
        step.attachments.forEach((file) => {
          formData.append(`files-${index}`, file);
        });
      });

      const token = localStorage.getItem('token');
      let response;
      
      if (isEditMode && editFmsId) {
        // Update existing FMS
        response = await axios.put(`${address}/api/fms/${editFmsId}`, formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
      } else {
        // Create new FMS
        response = await axios.post(`${address}/api/fms`, formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
      }

      if (response.data.success) {
        toast.success(isEditMode ? 'FMS template updated successfully!' : 'FMS template created successfully!');
        navigate('/fms-templates');
      } else {
        toast.error(response.data.message || `Failed to ${isEditMode ? 'update' : 'create'} FMS template`);
      }
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} FMS:`, error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} FMS template`;
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/fms-templates')}
                className="p-2 hover:bg-[var(--color-background)] rounded-lg transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: 'var(--color-text)' }} />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-[var(--color-text)]">
                  {isEditMode ? 'Edit FMS Template' : 'Create FMS Template'}
                </h1>
                <p className="text-sm text-[var(--color-textSecondary)] hidden sm:block">
                  {isEditMode ? 'Update workflow steps and settings' : 'Define workflow steps for repeatable processes'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 transition-opacity"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Template Details */}
        <SectionCard
          icon={FileText}
          title="Template Details"
          description="Basic information about this FMS template"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Template Name" required error={errors.fmsName}>
              <input
                type="text"
                value={fmsName}
                onChange={(e) => setFmsName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
                placeholder="Enter a descriptive name..."
              />
            </FormField>

            <FormField label="Category" required>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </FormField>
          </div>
        </SectionCard>

        {/* Frequency Settings */}
        <FrequencySettings
          frequency={frequency}
          settings={frequencySettings}
          onFrequencyChange={setFrequency}
          onSettingsChange={setFrequencySettings}
          error={errors.frequency}
        />

        {/* Steps Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--color-accent)10' }}>
                <Layers className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Workflow Steps</h2>
                <p className="text-sm text-[var(--color-textSecondary)]">{steps.length} step{steps.length !== 1 ? 's' : ''} configured</p>
              </div>
            </div>
            <button
              onClick={() => addStep()}
              className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-background)] flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <StepCard
                  step={step}
                  index={index}
                  totalSteps={steps.length}
                  users={users}
                  fmsList={fmsList}
                  errors={errors}
                  userSearchTerm={userSearchTerms[index]}
                  steps={steps}
                  onUpdateStep={updateStep}
                  onRemoveStep={removeStep}
                  onUpdateUserSearchTerm={updateUserSearchTerm}
                  onAddChecklistItem={addChecklistItem}
                  onUpdateChecklistItem={updateChecklistItem}
                  onRemoveChecklistItem={removeChecklistItem}
                  onFileChange={handleFileChange}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedIndex === index}
                  dragOverIndex={dragOverIndex}
                />
                {/* Add Step Button Between Steps */}
                {index < steps.length - 1 && (
                  <div className="flex items-center justify-center py-2">
                    <button
                      onClick={() => addStep(index)}
                      className="px-4 py-2 border-2 border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-textSecondary)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 transition-all duration-200 flex items-center gap-2 text-sm"
                      title={`Insert step after Step ${step.stepNo}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Step Here</span>
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Add Step Button (Bottom) */}
          <button
            onClick={() => addStep()}
            className="w-full py-4 border-2 border-dashed border-[var(--color-border)] rounded-xl text-[var(--color-textSecondary)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/5 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Another Step
          </button>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-[var(--color-border)]">
          <button
            onClick={() => navigate('/fms-templates')}
            className="px-6 py-3 border border-[var(--color-border)] text-[var(--color-text)] rounded-lg hover:bg-[var(--color-background)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50 transition-opacity min-w-[160px] justify-center"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </main>

    </div>
  );
};

export default CreateFMS;