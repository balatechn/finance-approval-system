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

type Tab = 'departments' | 'costCenters' | 'entities' | 'itemMasters' | 'systemConfig' | 'emailTest';

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

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      fetchData();
    }
  }, [status, session, fetchData]);

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
        emailTest: '',
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
    { id: 'emailTest' as Tab, label: 'Email Test', icon: Mail },
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
        {activeTab !== 'emailTest' && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
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
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {'count' in tab && tab.count !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
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
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
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
        {activeTab === 'emailTest' && (
          <EmailTestPanel
            testEmail={testEmail}
            setTestEmail={setTestEmail}
            loading={testEmailLoading}
            result={testEmailResult}
            onSend={async () => {
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
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
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
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. FIN"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Head ID</label>
                    <input
                      type="text"
                      value={formData.headId}
                      onChange={(e) => setFormData({ ...formData, headId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. CC-IT-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department Code</label>
                    <input
                      type="text"
                      value={formData.departmentCode}
                      onChange={(e) => setFormData({ ...formData, departmentCode: e.target.value.toUpperCase() })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                        className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
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
                        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 italic"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100"
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. 48"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="Optional description"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
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
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
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
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Department</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4 text-gray-600">{getDeptName(item.departmentCode)}</td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
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
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
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
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Name</th>
            <th className="px-6 py-3">Code</th>
            <th className="px-6 py-3">Description</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4">
                <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{item.code}</code>
              </td>
              <td className="px-6 py-4 text-gray-500">{item.description || '—'}</td>
              <td className="px-6 py-4">
                <StatusBadge active={item.isActive} />
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(item.id, item.isActive)}
                    className={`rounded-lg p-1.5 ${
                      item.isActive
                        ? 'text-green-500 hover:bg-green-50 hover:text-green-700'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
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

function EmailTestPanel({
  testEmail,
  setTestEmail,
  loading,
  result,
  onSend,
}: {
  testEmail: string;
  setTestEmail: (v: string) => void;
  loading: boolean;
  result: { success: boolean; message: string } | null;
  onSend: () => void;
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2.5">
          <Mail className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Test Email Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Send a test email to verify that SendGrid is configured correctly and emails are being delivered.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">From Address</p>
        <p className="text-sm font-mono text-gray-700">bala@nationalgroupindia.com</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Recipient Email *</label>
        <div className="flex gap-3">
          <input
            type="email"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter email address to send test"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={onSend}
            disabled={loading || !testEmail}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            result.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">{result.success ? 'Success' : 'Error'}</p>
            <p className="text-sm mt-0.5">{result.message}</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Make sure SMTP credentials (SMTP_USER and SMTP_PASS) are configured in your environment variables.
          For Gmail, use an App Password (Google Account → Security → 2-Step Verification → App Passwords).
        </p>
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
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-6 py-3">Key</th>
            <th className="px-6 py-3">Value</th>
            <th className="px-6 py-3">Description</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <code className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{item.key}</code>
              </td>
              <td className="px-6 py-4 font-medium text-gray-900">{item.value}</td>
              <td className="px-6 py-4 text-gray-500">{item.description || '—'}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
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
