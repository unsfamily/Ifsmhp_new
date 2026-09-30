import { useId, useState } from 'react';
import Button from '../common/Button';
import type { GalleryCategory, GallerySubcategory } from '../../types/gallery';
import type { SubcategoryInput } from '../../services/galleryService';

export function SubcategorySelect({ subcategories, categoryId, value, onChange, filter = false }: {
  subcategories: GallerySubcategory[]; categoryId: string; value: string;
  onChange: (value: string) => void; filter?: boolean;
}) {
  const id = useId();
  return <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">{filter ? 'Filter subcategory' : 'Subcategory'}</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-paper-border bg-white px-3 text-sm text-forum-800">
      {filter && <option value="all">All subcategories</option>}
      <option value={filter ? 'none' : ''}>No subcategory</option>
      {subcategories.filter(s => s.categoryId === categoryId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  </div>;
}

export function SubcategoryDialog({ initial, parentId, categories, busy, serverError, onSave, onClose }: {
  initial: GallerySubcategory | null; parentId: string; categories: GalleryCategory[];
  busy: boolean; serverError: string | null; onSave: (input: SubcategoryInput) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? parentId);
  const [error, setError] = useState('');
  const id = useId();
  return <div className="fixed inset-0 z-50 bg-forum-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
    <form role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}
      onSubmit={e => {
        e.preventDefault();
        if (!name.trim()) { setError('Please enter a subcategory name.'); return; }
        if (!categories.some(c => c.id === categoryId)) { setError('Please select a valid parent category.'); return; }
        setError(''); void onSave({ name: name.trim(), categoryId });
      }}>
      <fieldset disabled={busy} className="space-y-4 min-w-0">
        <h3 id={`${id}-title`} className="font-display text-lg font-semibold text-forum-900">{initial ? 'Edit subcategory' : 'New subcategory'}</h3>
        <div>
          <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium">Subcategory name</label>
          <input id={`${id}-name`} autoFocus required maxLength={191} value={name} onChange={e => setName(e.target.value)} className="h-11 w-full rounded-xl border border-paper-border px-3" />
        </div>
        <div>
          <label htmlFor={`${id}-parent`} className="mb-1.5 block text-sm font-medium">Parent category</label>
          <select id={`${id}-parent`} required value={categoryId} onChange={e => setCategoryId(e.target.value)} className="h-11 w-full rounded-xl border border-paper-border px-3">
            <option value="">Select a category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {initial && <p className="text-sm text-ink-muted">Changing the parent category also moves all {initial.photoCount} assigned photographs. Their publication settings are preserved; visibility follows the new category.</p>}
        {(error || serverError) && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{error || serverError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{initial ? 'Save subcategory' : 'Create subcategory'}</Button>
        </div>
      </fieldset>
    </form>
  </div>;
}
