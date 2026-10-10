'use client'

import { useEffect, useState } from 'react'
import { SkeletonText } from '@/components/ui/Skeleton'
import { supabase, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useFeedback } from '@/components/ui/Feedback'
import Button from '@/components/ui/Button'

const DEFAULT_COLORS = [
  { bg: '#3B82F6', text: '#FFFFFF', label: 'Niebieski' },
  { bg: '#10B981', text: '#FFFFFF', label: 'Zielony' },
  { bg: '#F59E0B', text: '#FFFFFF', label: 'Pomarańczowy' },
  { bg: '#EF4444', text: '#FFFFFF', label: 'Czerwony' },
  { bg: '#8B5CF6', text: '#FFFFFF', label: 'Fioletowy' },
  { bg: '#EC4899', text: '#FFFFFF', label: 'Różowy' },
  { bg: '#6B7280', text: '#FFFFFF', label: 'Szary' },
  { bg: '#14B8A6', text: '#FFFFFF', label: 'Turkus' },
]

/** Tag list + add/edit/delete; rendered inside TagManagementModal (no card of its own). */
export default function TagManagement() {
  const { household } = useCurrentUser()
  const { toast, confirm } = useFeedback()
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Add tag form
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const [newTagTextColor, setNewTagTextColor] = useState('#FFFFFF')
  const [isAdding, setIsAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit tag
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editTextColor, setEditTextColor] = useState('')

  // Fetch tags
  useEffect(() => {
    const householdId = household?.id
    if (!householdId) return

    async function fetchTags() {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('household_id', householdId)
        .order('name')

      if (!error && data) {
        setTags(data)
      }
      setIsLoading(false)
    }

    fetchTags()

    // Realtime subscription
    const channel = supabase
      .channel(`tag-management-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tags',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTags((current) => [...current, payload.new as Tag].sort((a, b) => a.name.localeCompare(b.name)))
          } else if (payload.eventType === 'UPDATE') {
            setTags((current) =>
              current.map((t) => (t.id === payload.new.id ? (payload.new as Tag) : t))
            )
          } else if (payload.eventType === 'DELETE') {
            setTags((current) => current.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [household?.id])

  // Add tag
  async function addTag(e: React.FormEvent) {
    e.preventDefault()
    const householdId = household?.id
    if (!householdId || !newTagName.trim()) return

    setIsAdding(true)

    const { error } = await supabase.from('tags').insert({
      household_id: householdId,
      name: newTagName.trim(),
      color: newTagColor,
      text_color: newTagTextColor,
    })

    if (!error) {
      setNewTagName('')
      setNewTagColor('#3B82F6')
      setNewTagTextColor('#FFFFFF')
      setShowAddForm(false)
    } else {
      toast('Błąd: ' + error.message, { type: 'error' })
    }

    setIsAdding(false)
  }

  // Start editing
  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setEditTextColor(tag.text_color)
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditColor('')
    setEditTextColor('')
  }

  // Save edit
  async function saveEdit(tagId: string) {
    if (!editName.trim()) return

    const { error } = await supabase
      .from('tags')
      .update({
        name: editName.trim(),
        color: editColor,
        text_color: editTextColor,
      })
      .eq('id', tagId)

    if (!error) {
      setEditingId(null)
    } else {
      toast('Błąd: ' + error.message, { type: 'error' })
    }
  }

  // Delete tag
  async function deleteTag(tagId: string) {
    if (!(await confirm({ message: 'Czy na pewno chcesz usunąć ten tag? Zostanie usunięty ze wszystkich posiłków.', danger: true, confirmLabel: 'Usuń' }))) return

    const { error } = await supabase.from('tags').delete().eq('id', tagId)

    if (error) {
      toast('Nie udało się usunąć tagu: ' + error.message, { type: 'error' })
    }
  }

  // Without a household there is nothing to load; do not show the skeleton forever
  if (isLoading && household?.id) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Ładowanie tagów...</span>
        <SkeletonText lines={2} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Tagi pomagają filtrować posiłki.</p>
        <Button
          variant={showAddForm ? 'secondary' : 'primary'}
          aria-expanded={showAddForm}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Anuluj' : 'Dodaj tag'}
        </Button>
      </div>

      {/* Add tag form */}
      {showAddForm && (
        <form onSubmit={addTag} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nazwa tagu
            </label>
            <input
              id="tag-name"
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="np. Wegetariańskie, Szybkie, Dietetyczne"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-black dark:text-gray-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tag-bg-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kolor tła
              </label>
              <div className="flex gap-2">
                <input
                  id="tag-bg-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  aria-label="Kolor tła (kod hex)"
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-black dark:text-gray-100"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tag-text-color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kolor tekstu
              </label>
              <div className="flex gap-2">
                <input
                  id="tag-text-color"
                  type="color"
                  value={newTagTextColor}
                  onChange={(e) => setNewTagTextColor(e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagTextColor}
                  onChange={(e) => setNewTagTextColor(e.target.value)}
                  aria-label="Kolor tekstu (kod hex)"
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-black dark:text-gray-100"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Szablony kolorów:</p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((preset) => (
                <button
                  key={preset.bg}
                  type="button"
                  onClick={() => {
                    setNewTagColor(preset.bg)
                    setNewTagTextColor(preset.text)
                  }}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-transform hover:scale-105"
                  style={{ backgroundColor: preset.bg, color: preset.text }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Podgląd:</span>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: newTagColor, color: newTagTextColor }}
            >
              {newTagName || 'Przykład'}
            </span>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={isAdding || !newTagName.trim()}>
            {isAdding ? 'Dodawanie...' : 'Dodaj tag'}
          </Button>
        </form>
      )}

      {/* Tags list */}
      <div className="space-y-2">
        {tags.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            Brak tagów. Dodaj pierwszy tag powyżej.
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 flex items-center justify-between gap-3"
            >
              {editingId === tag.id ? (
                // Edit mode
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Nazwa tagu"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-black dark:text-gray-100"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        aria-label="Kolor tła"
                        className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        aria-label="Kolor tła (kod hex)"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-black dark:text-gray-100"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editTextColor}
                        onChange={(e) => setEditTextColor(e.target.value)}
                        aria-label="Kolor tekstu"
                        className="h-10 w-16 rounded border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={editTextColor}
                        onChange={(e) => setEditTextColor(e.target.value)}
                        aria-label="Kolor tekstu (kod hex)"
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-black dark:text-gray-100"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => saveEdit(tag.id)}>
                      Zapisz
                    </Button>
                    <Button size="sm" onClick={cancelEdit}>
                      Anuluj
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: tag.color, color: tag.text_color }}
                  >
                    {tag.name}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(tag)} aria-label={`Edytuj tag ${tag.name}`}>
                      Edytuj
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteTag(tag.id)} aria-label={`Usuń tag ${tag.name}`}>
                      Usuń
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
