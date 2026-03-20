'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type HouseholdMember = {
  user_id: string
  name: string | null
}

type CustomListItem = {
  id: string
  list_id: string
  name: string
  quantity: string | null
  is_checked: boolean
  created_at: string
}

type CustomList = {
  id: string
  household_id: string
  created_by: string | null
  name: string
  visible_to: string[]
  created_at: string
  updated_at: string
  items?: CustomListItem[]
}

export default function CustomLists() {
  const { user, household } = useCurrentUser()
  const [lists, setLists] = useState<CustomList[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // New list form
  const [newListName, setNewListName] = useState('')
  const [newListVisibleTo, setNewListVisibleTo] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [showNewListForm, setShowNewListForm] = useState(false)

  // Expanded list
  const [expandedListId, setExpandedListId] = useState<string | null>(null)

  // New item form per list
  const [newItemName, setNewItemName] = useState<Record<string, string>>({})
  const [newItemQty, setNewItemQty] = useState<Record<string, string>>({})
  const [isAddingItem, setIsAddingItem] = useState<Record<string, boolean>>({})

  // Edit list name
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editListName, setEditListName] = useState('')

  useEffect(() => {
    const householdId = household?.id
    const userId = user?.id
    if (!householdId || !userId) return

    async function fetchData() {
      setIsLoading(true)

      // Fetch members
      const { data: huData } = await supabase
        .from('household_users')
        .select('user_id')
        .eq('household_id', householdId)

      if (huData) {
        const userIds = huData.map((h: { user_id: string }) => h.user_id)
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('user_id, name')
          .in('user_id', userIds)

        const membersResult: HouseholdMember[] = userIds.map((uid: string) => ({
          user_id: uid,
          name: settingsData?.find((s: { user_id: string; name: string | null }) => s.user_id === uid)?.name || null,
        }))
        setMembers(membersResult)

        // Default visible_to = all members
        setNewListVisibleTo(userIds)
      }

      // Fetch lists + items
      const { data: listsData } = await supabase
        .from('custom_lists')
        .select('*, items:custom_list_items(*)')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })

      if (listsData) {
        setLists(listsData as CustomList[])
      }

      setIsLoading(false)
    }

    fetchData()

    // Realtime
    const channel = supabase
      .channel('custom-lists-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_lists', filter: `household_id=eq.${householdId}` }, () => {
        fetchData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_list_items' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [household?.id, user?.id])

  async function createList(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !user?.id || !newListName.trim()) return
    setIsCreating(true)

    const { data } = await supabase
      .from('custom_lists')
      .insert({
        household_id: household.id,
        created_by: user.id,
        name: newListName.trim(),
        visible_to: newListVisibleTo,
      })
      .select('*, items:custom_list_items(*)')
      .single()

    if (data) {
      setLists((prev) => [...prev, data as CustomList])
      setExpandedListId(data.id)
      setNewListName('')
      setShowNewListForm(false)
    }
    setIsCreating(false)
  }

  async function deleteList(listId: string) {
    if (!confirm('Usunąć tę listę wraz ze wszystkimi pozycjami?')) return
    await supabase.from('custom_lists').delete().eq('id', listId)
    setLists((prev) => prev.filter((l) => l.id !== listId))
    if (expandedListId === listId) setExpandedListId(null)
  }

  async function saveListName(list: CustomList) {
    const trimmed = editListName.trim()
    if (!trimmed) return
    await supabase.from('custom_lists').update({ name: trimmed }).eq('id', list.id)
    setLists((prev) => prev.map((l) => l.id === list.id ? { ...l, name: trimmed } : l))
    setEditingListId(null)
  }

  async function updateVisibility(list: CustomList, userId: string, checked: boolean) {
    const updated = checked
      ? [...list.visible_to, userId]
      : list.visible_to.filter((id) => id !== userId)
    await supabase.from('custom_lists').update({ visible_to: updated }).eq('id', list.id)
    setLists((prev) => prev.map((l) => l.id === list.id ? { ...l, visible_to: updated } : l))
  }

  async function addItem(e: React.FormEvent, listId: string) {
    e.preventDefault()
    const name = newItemName[listId]?.trim()
    if (!name) return

    setIsAddingItem((prev) => ({ ...prev, [listId]: true }))

    const { data } = await supabase
      .from('custom_list_items')
      .insert({ list_id: listId, name, quantity: newItemQty[listId]?.trim() || null, is_checked: false })
      .select()
      .single()

    if (data) {
      setLists((prev) => prev.map((l) =>
        l.id === listId ? { ...l, items: [...(l.items || []), data as CustomListItem] } : l
      ))
      setNewItemName((prev) => ({ ...prev, [listId]: '' }))
      setNewItemQty((prev) => ({ ...prev, [listId]: '' }))
    }
    setIsAddingItem((prev) => ({ ...prev, [listId]: false }))
  }

  async function toggleItem(listId: string, item: CustomListItem) {
    const updated = !item.is_checked
    await supabase.from('custom_list_items').update({ is_checked: updated }).eq('id', item.id)
    setLists((prev) => prev.map((l) =>
      l.id === listId
        ? { ...l, items: (l.items || []).map((i) => i.id === item.id ? { ...i, is_checked: updated } : i) }
        : l
    ))
  }

  async function deleteItem(listId: string, itemId: string) {
    await supabase.from('custom_list_items').delete().eq('id', itemId)
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, items: (l.items || []).filter((i) => i.id !== itemId) } : l
    ))
  }

  async function clearChecked(listId: string) {
    const list = lists.find((l) => l.id === listId)
    if (!list) return
    const checkedIds = (list.items || []).filter((i) => i.is_checked).map((i) => i.id)
    if (checkedIds.length === 0) return
    await supabase.from('custom_list_items').delete().in('id', checkedIds)
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, items: (l.items || []).filter((i) => !i.is_checked) } : l
    ))
  }

  // Only show lists visible to current user
  const visibleLists = user
    ? lists.filter((l) => l.visible_to.includes(user.id) || l.created_by === user.id)
    : []

  if (isLoading) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Moje listy</h3>
        <button
          onClick={() => setShowNewListForm((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          {showNewListForm ? 'Anuluj' : '+ Nowa lista'}
        </button>
      </div>

      {/* New list form */}
      {showNewListForm && (
        <form onSubmit={createList} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nazwa listy</label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Np. Rossmann, Castorama..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          {members.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Widoczna dla</label>
              <div className="flex flex-wrap gap-3">
                {members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newListVisibleTo.includes(m.user_id)}
                      onChange={(e) => {
                        setNewListVisibleTo((prev) =>
                          e.target.checked ? [...prev, m.user_id] : prev.filter((id) => id !== m.user_id)
                        )
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {m.user_id === user?.id ? `${m.name || 'Ja'} (ja)` : m.name || 'Bez nazwy'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={isCreating || !newListName.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Tworzenie...' : 'Utwórz listę'}
          </button>
        </form>
      )}

      {visibleLists.length === 0 && !showNewListForm && (
        <p className="text-sm text-gray-500 text-center py-4">Brak list. Utwórz swoją pierwszą listę.</p>
      )}

      {/* Lists */}
      {visibleLists.map((list) => {
        const isExpanded = expandedListId === list.id
        const items = list.items || []
        const checkedCount = items.filter((i) => i.is_checked).length

        return (
          <div key={list.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* List header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => setExpandedListId(isExpanded ? null : list.id)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {editingListId === list.id ? (
                  <input
                    type="text"
                    value={editListName}
                    onChange={(e) => setEditListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveListName(list) }
                      if (e.key === 'Escape') setEditingListId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="flex-1 rounded border border-blue-400 px-2 py-0.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                  />
                ) : (
                  <span className="font-semibold text-sm text-gray-900 truncate">{list.name}</span>
                )}
                <span className="text-xs text-gray-500 flex-shrink-0">{items.length} poz.</span>
              </button>
              <div className="flex items-center gap-1 flex-shrink-0">
                {editingListId === list.id ? (
                  <>
                    <button onClick={() => saveListName(list)} className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors font-medium">Zapisz</button>
                    <button onClick={() => setEditingListId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Anuluj</button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditingListId(list.id); setEditListName(list.name) }}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Zmień nazwę
                  </button>
                )}
                <button
                  onClick={() => deleteList(list.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Usuń
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-4 space-y-4">
                {/* Visibility */}
                {members.length > 1 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Widoczna dla</p>
                    <div className="flex flex-wrap gap-3">
                      {members.map((m) => (
                        <label key={m.user_id} className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={list.visible_to.includes(m.user_id)}
                            onChange={(e) => updateVisibility(list, m.user_id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-700">
                            {m.user_id === user?.id ? `${m.name || 'Ja'} (ja)` : m.name || 'Bez nazwy'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(list.id, item)}
                        className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity cursor-pointer ${item.is_checked ? 'opacity-60' : 'opacity-100'}`}
                      >
                        <input
                          type="checkbox"
                          checked={item.is_checked}
                          onChange={(e) => { e.stopPropagation(); toggleItem(list.id, item) }}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${item.is_checked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          {item.quantity && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.quantity}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItem(list.id, item.id) }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                          aria-label="Usuń pozycję"
                        >
                          Usuń
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {checkedCount > 0 && (
                  <button
                    onClick={() => clearChecked(list.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Usuń odhaczone ({checkedCount})
                  </button>
                )}

                {/* Add item form */}
                <form onSubmit={(e) => addItem(e, list.id)} className="flex gap-2 pt-1 border-t border-gray-100">
                  <input
                    type="text"
                    value={newItemName[list.id] || ''}
                    onChange={(e) => setNewItemName((prev) => ({ ...prev, [list.id]: e.target.value }))}
                    placeholder="Nazwa produktu"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newItemQty[list.id] || ''}
                    onChange={(e) => setNewItemQty((prev) => ({ ...prev, [list.id]: e.target.value }))}
                    placeholder="Ilość"
                    className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isAddingItem[list.id] || !newItemName[list.id]?.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Dodaj
                  </button>
                </form>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
