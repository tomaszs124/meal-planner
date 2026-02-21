'use client'

import { useEffect, useState } from 'react'
import { supabase, ShoppingListItem } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export default function ShoppingList() {
  const { household, isLoading: userLoading } = useCurrentUser()
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Fetch shopping list items
  useEffect(() => {
    const householdId = household?.id
    if (!householdId) return

    async function fetchItems() {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setItems(data)
      }
    }

    fetchItems()

    // Subscribe to realtime changes
    const channel = supabase
      .channel('shopping-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((current) => [payload.new as ShoppingListItem, ...current])
          } else if (payload.eventType === 'UPDATE') {
            setItems((current) =>
              current.map((item) =>
                item.id === payload.new.id ? (payload.new as ShoppingListItem) : item
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setItems((current) => current.filter((item) => item.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [household?.id])

  // Toggle item checked status
  async function toggleItem(item: ShoppingListItem) {
    // Optimistic update
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i))
    )

    const { error } = await supabase
      .from('shopping_list_items')
      .update({
        is_checked: !item.is_checked,
        checked_at: !item.is_checked ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (error) {
      // Revert on error
      setItems((current) =>
        current.map((i) => (i.id === item.id ? { ...i, is_checked: item.is_checked } : i))
      )
    }
  }

  // Add new item
  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    const householdId = household?.id
    if (!householdId || !newItemName.trim()) return

    setIsAdding(true)

    const { error } = await supabase.from('shopping_list_items').insert({
      household_id: householdId,
      name: newItemName.trim(),
      amount: parseFloat(newItemAmount) || 1,
      is_checked: false,
    })

    if (!error) {
      setNewItemName('')
      setNewItemAmount('')
    }

    setIsAdding(false)
  }

  // Delete item
  async function deleteItem(itemId: string) {
    // Optimistic update
    setItems((current) => current.filter((i) => i.id !== itemId))

    const { error } = await supabase
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      // Refetch on error
      const householdId = household?.id
      if (!householdId) return
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      if (data) {
        setItems(data)
      }
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Ładowanie...</div>
      </div>
    )
  }

  if (!household) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
        Musisz najpierw dołączyć do gospodarstwa.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lista zakupów</h2>
        <p className="text-sm text-gray-500 mt-1">
          Synchronizowana w czasie rzeczywistym
        </p>
      </div>

      {/* Add new item form */}
      <form onSubmit={addItem} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Nazwa produktu"
            disabled={isAdding}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <input
            type="number"
            step="0.1"
            value={newItemAmount}
            onChange={(e) => setNewItemAmount(e.target.value)}
            placeholder="Ilość"
            disabled={isAdding}
            className="w-24 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isAdding || !newItemName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAdding ? 'Dodawanie...' : 'Dodaj'}
          </button>
        </div>
      </form>

      {/* Shopping list items */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak produktów na liście zakupów</p>
            <p className="text-gray-400 text-xs mt-1">Dodaj pierwszy produkt powyżej</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-3 transition-opacity ${
                item.is_checked ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={item.is_checked}
                onChange={() => toggleItem(item)}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />

              {/* Item details */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    item.is_checked ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {item.name || 'Unnamed item'}
                </p>
                {item.amount && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ilość: {item.amount} {item.unit_type || ''}
                  </p>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteItem(item.id)}
                className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                aria-label="Usuń produkt"
              >
                Usuń
              </button>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex justify-between text-sm">
          <span className="text-gray-600">
            Wszystkich: <span className="font-semibold text-gray-900">{items.length}</span>
          </span>
          <span className="text-gray-600">
            Kupionych: <span className="font-semibold text-gray-900">{items.filter((i) => i.is_checked).length}</span>
          </span>
        </div>
      )}
    </div>
  )
}
