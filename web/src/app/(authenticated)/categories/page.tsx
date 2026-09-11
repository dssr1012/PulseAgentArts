'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient } from '@/lib/api';
import type { Category } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/Tabs';
import { Plus, Tag, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

export default function CategoriesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!user?.circle_id) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getCategories(user.circle_id);
      setCategories(data);
    } catch {
      addToast('error', 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.circle_id, addToast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleCreate = async () => {
    if (!newCategoryName.trim() || !user?.circle_id) return;
    setIsCreating(true);
    try {
      await apiClient.createCategory(user.circle_id, { name: newCategoryName.trim(), icon: newCategoryIcon || undefined });
      addToast('success', 'Category created.');
      setShowAddModal(false);
      setNewCategoryName('');
      setNewCategoryIcon('');
      fetchCategories();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CATEGORY_DUPLICATE') {
        addToast('warning', 'A category with this name already exists.');
      } else {
        addToast('error', 'Failed to create category.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      addToast('warning', 'Default categories cannot be deleted.');
      return;
    }
    if (!confirm('Delete this category?')) return;
    try {
      await apiClient.deleteCategory(id);
      addToast('success', 'Category deleted.');
      fetchCategories();
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === 'CATEGORY_IN_USE') {
        addToast('warning', 'This category is in use by existing expenses and cannot be deleted.');
      } else {
        addToast('error', 'Failed to delete category.');
      }
    }
  };

  const defaultCategories = categories.filter((c) => c.is_default);
  const customCategories = categories.filter((c) => !c.is_default);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage expense categories</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {isLoading ? (
        <LoadingOverlay />
      ) : (
        <>
          {/* Default Categories */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Default Categories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {defaultCategories.map((cat) => (
                <div key={cat.id} className="card p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-pulse-blue-100 flex items-center justify-center">
                    <Tag className="h-5 w-5 text-pulse-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                    <p className="text-xs text-gray-500">Default</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Categories */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Custom Categories</h2>
            {customCategories.length === 0 ? (
              <p className="text-sm text-gray-500">No custom categories yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {customCategories.map((cat) => (
                  <div key={cat.id} className="card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-pulse-yellow-100 flex items-center justify-center">
                      <Tag className="h-5 w-5 text-pulse-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500">Custom</p>
                    </div>
                    <button
                      onClick={() => handleDelete(cat.id, cat.is_default)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-pulse-red-500 hover:bg-pulse-red-50 transition-colors"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Category Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Custom Category" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <div>
            <label htmlFor="catName" className="label-field">Category Name</label>
            <input
              id="catName"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="input-field"
              placeholder="e.g., Entertainment"
              maxLength={50}
              required
            />
          </div>
          <div>
            <label htmlFor="catIcon" className="label-field">Icon (optional)</label>
            <input
              id="catIcon"
              type="text"
              value={newCategoryIcon}
              onChange={(e) => setNewCategoryIcon(e.target.value)}
              className="input-field"
              placeholder="Icon identifier"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isCreating || !newCategoryName.trim()} className="btn-primary">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}