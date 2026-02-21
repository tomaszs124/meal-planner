'use client'

import { useEffect, useState } from 'react'
import { supabase, Tag } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

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

export default function TagManagement() {
  const { household } = useCurrentUser()
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
          console.log('Tags realtime event in TagManagement:', payload.eventType, payload)
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
      alert('Błąd: ' + error.message)
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
      alert('Błąd: ' + error.message)
    }
  }

  // Delete tag
  async function deleteTag(tagId: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten tag? Zostanie usunięty ze wszystkich posiłków.')) return

    const { error } = await supabase.from('tags').delete().eq('id', tagId)

    if (error) {
      alert('Nie udało się usunąć tagu: ' + error.message)
    }
  }

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Ładowanie tagów...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Zarządzanie tagami</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          {showAddForm ? 'Anuluj' : 'Dodaj tag'}
        </button>
      </div>

      {/* Add tag form */}
      {showAddForm && (
        <form onSubmit={addTag} className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa tagu
            </label>
            <input
              id="tag-name"
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="np. Wegetariańskie, Szybkie, Dietetyczne"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tag-bg-color" className="block text-sm font-medium text-gray-700 mb-1">
                Kolor tła
              </label>
              <div className="flex gap-2">
                <input
                  id="tag-bg-color"
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tag-text-color" className="block text-sm font-medium text-gray-700 mb-1">
                Kolor tekstu
              </label>
              <div className="flex gap-2">
                <input
                  id="tag-text-color"
                  type="color"
                  value={newTagTextColor}
                  onChange={(e) => setNewTagTextColor(e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={newTagTextColor}
                  onChange={(e) => setNewTagTextColor(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Szablony kolorów:</p>
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
            <span className="text-sm text-gray-600">Podgląd:</span>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: newTagColor, color: newTagTextColor }}
            >
              {newTagName || 'Przykład'}
            </span>
          </div>

          <button
            type="submit"
            disabled={isAdding || !newTagName.trim()}
            className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? 'Dodawanie...' : 'Dodaj tag'}
          </button>
        </form>
      )}

      {/* Tags list */}
      <div className="space-y-2">
        {tags.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Brak tagów. Dodaj pierwszy tag powyżej.
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-3"
            >
              {editingId === tag.id ? (
                // Edit mode
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-10 w-16 rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editTextColor}
                        onChange={(e) => setEditTextColor(e.target.value)}
                        className="h-10 w-16 rounded border border-gray-300"
                      />
                      <input
                        type="text"
                        value={editTextColor}
                        onChange={(e) => setEditTextColor(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-black"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(tag.id)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      Zapisz
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-400"
                    >
                      Anuluj
                    </button>
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
                    <button
                      onClick={() => startEdit(tag)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50"
                    >
                      Usuń
                    </button>
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
