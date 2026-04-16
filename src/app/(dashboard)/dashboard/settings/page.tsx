'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CreditCard,
  Landmark,
  Settings2,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Loader2,
  Package,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

type Tab = 'departments' | 'costCenters' | 'entities' | 'itemMasters' | 'systemConfig' | 'emailConfig';

interface Department {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CostCenter {
  id: string;
  name: string;
  code: string;
  departmentCode: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Entity {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

interface ItemMaster {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

interface SettingsData {
  departments: Department[];
  costCenters: CostCenter[];
  entities: Entity[];
  itemMasters: ItemMaster[];
  systemConfig: SystemConfig[];
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('departments');
  const [data, setData] = useState<SettingsData>({
    departments: [],
    costCenters: [],
    entities: [],
    itemMasters: [],
    systemConfig: [],
  });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Email config state
  const [emailConfig, setEmailConfig] = useState({
    provider: '',
    host: '',
    port: '',
    user: '',
    password: '',
    fromEmail: '',
    fromName: '',
    configured: false,
    hasPassword: false,
  });
  const [emailConfigLoading, setEmailConfigLoading] = useState(false);
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);
  const [emailConfigResult, setEmailConfigResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmailConfig = useCallback(async () => {
    try {
      setEmailConfigLoading(true);
      const res = await fetch('/api/settings/email-config');
      if (res.ok) {
        const data = await res.json();
        setEmailConfig({
          provider: data.provider || 'gmail',
          host: data.host || '',
          port: data.port || '',
          user: data.user || '',
          password: data.hasPassword ? data.password : '',
          fromEmail: data.fromEmail || '',
          fromName: data.fromName || '',
          configured: data.configured,
          hasPassword: data.hasPassword,
        });
      }
    } catch (error) {
      console.error('Failed to fetch email config:', error);
    } finally {
      setEmailConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchData();
      fetchEmailConfig();
    }
  }, [status, session, fetchData, fetchEmailConfig]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormError('');
    switch (activeTab) {
      case 'departments':
        setFormData({ name: '', code: '', headId: '' });
        break;
      case 'costCenters':
        setFormData({ name: '', code: '', departmentCode: '' });
        break;
      case 'entities':
        setFormData({ name: '', code: '' });
        break;
      case 'itemMasters':
        setFormData({ name: '', code: '', description: '' });
        break;
      case 'systemConfig':
        setFormData({ key: '', value: '', description: '' });
        break;
    }
    setModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormError('');
    switch (activeTab) {
      case 'departments':
        setFormData({ name: item.name, code: item.code, headId: item.headId || '' });
        break;
      case 'costCenters':
        setFormData({ name: item.name, code: item.code, departmentCode: item.departmentCode || '' });
        break;
      case 'entities':
        setFormData({ name: item.name, code: item.code });
        break;
      case 'itemMasters':
        setFormData({ name: item.name, code: item.code, description: item.description || '' });
        break;
      case 'systemConfig':
        setFormData({ key: item.key, value: item.value, description: item.description || '' });
        break;
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const typeMap: Record<Tab, string> = {
        departments: 'department',
        costCenters: 'costCenter',
        entities: 'entity',
        itemMasters: 'itemMaster',
        systemConfig: 'systemConfig',
        emailConfig: '',
      };

      const payload = {
        type: typeMap[activeTab],
        ...formData,
        ...(editingItem && { id: editingItem.id }),
      };

      const res = await fetch('/api/settings', {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || 'Failed to save');
        return;
      }

      setModalOpen(false);
      fetchData();
    } catch {
      setFormError('An error occurred');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (type: string, id: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await fetch(`/api/settings?type=${type}&id=${id}`, { method: 'DELETE' });
      } else {
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, id, isActive: true }),
        });
      }
      fetchData();
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Are you sure you want to delete this config?')) return;
    try {
      await fetch(`/api/settings?type=systemConfig&id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const tabs = [
    { id: 'departments' as Tab, label: 'Departments', icon: Building2, count: data.departments.length },
    { id: 'costCenters' as Tab, label: 'Cost Centers', icon: CreditCard, count: data.costCenters.length },
    { id: 'entities' as Tab, label: 'Entities', icon: Landmark, count: data.entities.length },
    { id: 'itemMasters' as Tab, label: 'Item Master', icon: Package, count: data.itemMasters.length },
    { id: 'systemConfig' as Tab, label: 'System Config', icon: Settings2, count: data.systemConfig.length },
    { id: 'emailConfig' as Tab, label: 'Email Config', icon: Mail },
  ];

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage departments, cost centers, entities, and system configuration
          </p>
        </div>
        {activeTab !== 'emailConfig' && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-white/60">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-white/60 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {'count' in tab && tab.count !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-white/70 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-white/60 bg-white/70 backdrop-blur-sm shadow-sm">
        {activeTab === 'departments' && (
          <DepartmentsTable
            items={data.departments}
            onEdit={openEditModal}
            onToggle={(id, active) => handleToggleActive('department', id, active)}
          />
        )}
        {activeTab === 'costCenters' && (
          <CostCentersTable
            items={data.costCenters}
            departments={data.departments}
            onEdit={openEditModal}
            onToggle={(id, active) => handleToggleActive('costCenter', id, active)}
          />
        )}
        {activeTab === 'entities' && (
          <EntitiesTable
            items={data.entities}
            onEdit={openEditModal}
            onToggle={(id, active) => handleToggleActive('entity', id, active)}
          />
        )}
        {activeTab === 'itemMasters' && (
          <ItemMastersTable
            items={data.itemMasters}
            onEdit={openEditModal}
            onToggle={(id, active) => handleToggleActive('itemMaster', id, active)}
          />
        )}
        {activeTab === 'systemConfig' && (
          <SystemConfigTable
            items={data.systemConfig}
            onEdit={openEditModal}
            onDelete={handleDeleteConfig}
          />
        )}
        {activeTab === 'emailConfig' && (
          <EmailConfigPanel
            config={emailConfig}
            setConfig={setEmailConfig}
            configLoading={emailConfigLoading}
            configSaving={emailConfigSaving}
            configResult={emailConfigResult}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            onSaveConfig={async () => {
              setEmailConfigSaving(true);
              setEmailConfigResult(null);
              try {
                const res = await fetch('/api/settings/email-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    provider: emailConfig.provider,
                    host: emailConfig.host,
                    port: emailConfig.port,
                    user: emailConfig.user,
                    password: emailConfig.password,
                    fromEmail: emailConfig.fromEmail,
                    fromName: emailConfig.fromName,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  setEmailConfigResult({ success: true, message: data.message });
                  fetchEmailConfig();
                } else {
                  setEmailConfigResult({ success: false, message: data.error || 'Failed to save' });
                }
              } catch {
                setEmailConfigResult({ success: false, message: 'Network error' });
              } finally {
                setEmailConfigSaving(false);
              }
            }}
            testEmail={testEmail}
            setTestEmail={setTestEmail}
            testLoading={testEmailLoading}
            testResult={testEmailResult}
            onSendTest={async () => {
              if (!testEmail || !testEmail.includes('@')) {
                setTestEmailResult({ success: false, message: 'Please enter a valid email address' });
                return;
              }
              setTestEmailLoading(true);
              setTestEmailResult(null);
              try {
                const res = await fetch('/api/settings/test-email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ recipientEmail: testEmail }),
                });
                const data = await res.json();
                if (res.ok) {
                  setTestEmailResult({ success: true, message: data.message });
                } else {
                  setTestEmailResult({ success: false, message: data.error || 'Failed to send test email' });
                }
              } catch {
                setTestEmailResult({ success: false, message: 'Network error. Please try again.' });
              } finally {
                setTestEmailLoading(false);
              }
            }}
          />
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white/70 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingItem ? 'Edit' : 'Add New'}{' '}
                {activeTab === 'departments'
                  ? 'Department'
                  : activeTab === 'costCenters'
                  ? 'Cost Center'
                  : activeTab === 'entities'
                  ? 'Entity'
                  : activeTab === 'itemMasters'
                  ? 'Item'
                  : 'System Config'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-500/30 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {activeTab === 'departments' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. Finance"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. FIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Head ID</label>
                    <input
                      type="text"
                      value={formData.headId}
                      onChange={(e) => setFormData({ ...formData, headId: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}

              {activeTab === 'costCenters' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. IT Operations"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. CC-IT-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department Code</label>
                    <input
                      type="text"
                      value={formData.departmentCode}
                      onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional - e.g. IT"
                    />
                  </div>
                </>
              )}

              {activeTab === 'entities' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. National Group India"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. NGI"
                    />
                  </div>
                </>
              )}

              {activeTab === 'itemMasters' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. Desktop Computer"
                    />
                  </div>
                  {editingItem && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        disabled
                        value={formData.code}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500"
                      />
                    </div>
                  )}
                  {!editingItem && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                      <input
                        type="text"
                        disabled
                        value="Auto-generated (ITEM-001, ITEM-002...)"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 italic"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional description"
                    />
                  </div>
                </>
              )}

              {activeTab === 'systemConfig' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingItem}
                      value={formData.key}
                      onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-white"
                      placeholder="e.g. SLA_HOURS"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                    <input
                      type="text"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. 48"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional description"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-white/60 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-gray-900 hover:bg-primary/90 disabled:opacity-50"
                >
                  {formLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============= Sub-components ============= */

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-white/70 text-gray-500'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Settings2 className="h-10 w-10 mb-2" />
      <p className="text-sm">No {label} found</p>
    </div>
  );
}

function DepartmentsTable({
  items,
  onEdit,
  onToggle,
}: {
  items: Department[];
  onEdit: (item: Department) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) return <EmptyState label="departments" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-white/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-white/70 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'text-gray-400 hover:bg-white/60 hover:text-gray-600'
                    }`}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostCentersTable({
  items,
  departments,
  onEdit,
  onToggle,
}: {
  items: CostCenter[];
  departments: Department[];
  onEdit: (item: CostCenter) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const getDeptName = (code: string | null) => {
    if (!code) return '—';
    const dept = departments.find((d) => d.code === code);
    return dept ? dept.name : code;
  };

  if (items.length === 0) return <EmptyState label="cost centers" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-white/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Department</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-white/70 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4 text-gray-600">{getDeptName(item.departmentCode)}</td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'text-gray-400 hover:bg-white/60 hover:text-gray-600'
                    }`}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntitiesTable({
  items,
  onEdit,
  onToggle,
}: {
  items: Entity[];
  onEdit: (item: Entity) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) return <EmptyState label="entities" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-white/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-white/70 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'text-gray-400 hover:bg-white/60 hover:text-gray-600'
                    }`}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemMastersTable({
  items,
  onEdit,
  onToggle,
}: {
  items: ItemMaster[];
  onEdit: (item: ItemMaster) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  if (items.length === 0) return <EmptyState label="items" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-white/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Description</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-white/70 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4 text-gray-500">{item.description || '—'}</td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        : 'text-gray-400 hover:bg-white/60 hover:text-gray-600'
                    }`}
                    title={item.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailConfigPanel({
  config,
  setConfig,
  configLoading,
  configSaving,
  configResult,
  showPassword,
  setShowPassword,
  onSaveConfig,
  testEmail,
  setTestEmail,
  testLoading,
  testResult,
  onSendTest,
}: {
  config: { provider: string; host: string; port: string; user: string; password: string; fromEmail: string; fromName: string; configured: boolean; hasPassword: boolean };
  setConfig: (v: any) => void;
  configLoading: boolean;
  configSaving: boolean;
  configResult: { success: boolean; message: string } | null;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onSaveConfig: () => void;
  testEmail: string;
  setTestEmail: (v: string) => void;
  testLoading: boolean;
  testResult: { success: boolean; message: string } | null;
  onSendTest: () => void;
}) {
  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const providerInfo: Record<string, { label: string; host: string; helpUrl: string; helpText: string }> = {
    gmail: {
      label: 'Gmail',
      host: 'smtp.gmail.com:587',
      helpUrl: 'https://myaccount.google.com/apppasswords',
      helpText: 'Go to Google Account → Security → 2-Step Verification → App Passwords. Generate a new app password and paste it here.',
    },
    microsoft365: {
      label: 'Microsoft 365 / Outlook',
      host: 'smtp.office365.com:587',
      helpUrl: 'https://account.live.com/proofs/manage/additional',
      helpText: 'Go to Microsoft Account → Security → Advanced security options → App passwords. Create a new app password and paste it here.',
    },
    custom: {
      label: 'Custom SMTP',
      host: 'Custom host:port',
      helpUrl: '',
      helpText: 'Enter your SMTP server host, port, username and password below.',
    },
  };

  const currentProvider = providerInfo[config.provider] || providerInfo.gmail;

  return (
    <div className="p-6 space-y-8">
      {/* Section 1: SMTP Configuration */}
      <div>
        <div className="flex items-start gap-3 mb-6">
          <div className="rounded-lg bg-blue-50 p-2.5">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Email Configuration</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure SMTP settings to enable email notifications. Choose your email provider and enter your app password.
            </p>
          </div>
          {config.configured && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Configured
            </span>
          )}
        </div>

        <div className="space-y-5">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Provider *</label>
            <div className="grid grid-cols-3 gap-3">
              {(['gmail', 'microsoft365', 'custom'] as const).map((p) => {
                const info = providerInfo[p];
                const isSelected = config.provider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setConfig({ ...config, provider: p })}
                    className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-white/60 hover:border-white/60 hover:bg-white/50'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                      {info.label}
                    </span>
                    <span className="text-xs text-gray-500 mt-1 font-mono">{info.host}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom SMTP Host/Port (only shown for custom provider) */}
          {config.provider === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host *</label>
                <input
                  type="text"
                  required
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="smtp.mailgun.org"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Port *</label>
                <input
                  type="text"
                  required
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: e.target.value })}
                  placeholder="587"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{config.provider === 'custom' ? 'SMTP Username *' : 'Email Address *'}</label>
            <input
              type={config.provider === 'custom' ? 'text' : 'email'}
              required
              value={config.user}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
              placeholder={config.provider === 'custom' ? 'admin@mailer.example.com' : config.provider === 'microsoft365' ? 'your-email@company.com' : 'your-email@gmail.com'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-gray-400 mt-1">{config.provider === 'custom' ? 'SMTP login username provided by your email service.' : 'This will also be used as the "From" address unless overridden below.'}</p>
          </div>

          {/* App Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{config.provider === 'custom' ? 'SMTP Password *' : 'App Password *'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder={config.hasPassword ? 'Enter new password to change' : config.provider === 'custom' ? 'Enter your SMTP password' : 'Paste your app password here'}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-20 text-sm focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-white/60"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {config.provider !== 'custom' && (
              <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">
                  <strong>How to get an App Password:</strong> {currentProvider.helpText}
                </p>
                <a
                  href={currentProvider.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 underline"
                >
                  Open {currentProvider.label} App Passwords
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            )}
          </div>

          {/* Optional From overrides */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From Name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={config.fromName}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="Finance Approval System"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">From Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="email"
                value={config.fromEmail}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="Same as email address"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSaveConfig}
              disabled={configSaving || !config.user || (!config.password && !config.hasPassword)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {configSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {configSaving ? 'Saving...' : 'Save Configuration'}
            </button>
            {configResult && (
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                configResult.success ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {configResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {configResult.message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-white/60" />

      {/* Section 2: Test Email */}
      <div>
        <div className="flex items-start gap-3 mb-4">
          <div className="rounded-lg bg-emerald-50 p-2.5">
            <Send className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Send Test Email</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Verify your configuration by sending a test email.
            </p>
          </div>
        </div>

        {!config.configured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              <strong>Note:</strong> Save your email configuration above first before sending a test email.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter recipient email address"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={onSendTest}
                disabled={testLoading || !testEmail}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {testLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {testLoading ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>

            {testResult && (
              <div
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-500/30 text-emerald-700'
                    : 'bg-red-50 border-red-500/30 text-red-700'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">{testResult.success ? 'Success' : 'Error'}</p>
                  <p className="text-sm mt-0.5">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemConfigTable({
  items,
  onEdit,
  onDelete,
}: {
  items: SystemConfig[];
  onEdit: (item: SystemConfig) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return <EmptyState label="system configs" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-white/60 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Key</th>
            <th className="px-6 py-3">Value</th>
            <th className="px-6 py-3">Description</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/50">
              <td className="px-6 py-4">
                <code className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{item.key}</code>
              </td>
              <td className="px-6 py-4 font-medium text-gray-900">{item.value}</td>
              <td className="px-6 py-4 text-gray-500">{item.description || '—'}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-100 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
