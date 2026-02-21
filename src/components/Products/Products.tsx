'use client'

import { useEffect, useState } from 'react'
import { supabase, Product, ProductCategory, ProductCategoryRecord } from '@/lib/supabase/client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type UnitType = '100g' | 'piece' | 'tablespoon' | 'teaspoon'

const UNITS: { value: UnitType; label: string }[] = [
  { value: '100g', label: 'g' },
  { value: 'piece', label: 'Sztuka' },
  { value: 'tablespoon', label: 'Łyżka' },
  { value: 'teaspoon', label: 'Łyżeczka' },
]

const DEFAULT_CATEGORY_NAME = 'Pozostałe'

export default function Products() {
  const { user, household, isLoading: userLoading } = useCurrentUser()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Add form state
  const [newName, setNewName] = useState('')
  const [newKcal, setNewKcal] = useState('')
  const [newUnit, setNewUnit] = useState<UnitType>('100g')
  const [newUnitWeight, setNewUnitWeight] = useState('1')
  const [newCategory, setNewCategory] = useState<ProductCategory>('')
  const [newProtein, setNewProtein] = useState('')
  const [newFat, setNewFat] = useState('')
  const [newCarbs, setNewCarbs] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Categories state
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editKcal, setEditKcal] = useState('')
  const [editUnit, setEditUnit] = useState<UnitType>('100g')
  const [editUnitWeight, setEditUnitWeight] = useState('1')
  const [editCategory, setEditCategory] = useState<ProductCategory>('')
  const [editProtein, setEditProtein] = useState('')
  const [editFat, setEditFat] = useState('')
  const [editCarbs, setEditCarbs] = useState('')

  // Fetch products and categories
  useEffect(() => {
    if (!household?.id) return
    const householdId = household.id

    async function fetchData() {
      setIsLoading(true)

      const [{ data: productsData, error: productsError }, { data: categoriesData, error: categoriesError }] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false }),
        supabase
          .from('product_categories')
          .select('*')
          .eq('household_id', householdId)
          .order('name', { ascending: true }),
      ])

      if (!productsError && productsData) {
        setProducts(productsData)
      }

      if (!categoriesError && categoriesData) {
        setCategories(categoriesData)

        if (categoriesData.length > 0) {
          const fallback = categoriesData.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || categoriesData[0].name
          setNewCategory((current) =>
            current && categoriesData.some((c) => c.name === current) ? current : fallback
          )
        }
      }

      setIsLoading(false)
    }

    fetchData()

    // Realtime subscription (optional)
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `household_id=eq.${household.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((current) => [payload.new as Product, ...current])
          } else if (payload.eventType === 'UPDATE') {
            setProducts((current) =>
              current.map((p) => (p.id === payload.new.id ? (payload.new as Product) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProducts((current) => current.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [household?.id])

  // Add new product
  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !user?.id || !newName.trim() || !newKcal || !newUnitWeight || !newCategory) return

    setIsAdding(true)

    const { data, error } = await supabase.from('products').insert({
      household_id: household.id,
      name: newName.trim(),
      kcal_per_unit: parseFloat(newKcal),
      unit_type: newUnit,
      unit_weight_grams: parseFloat(newUnitWeight),
      category: newCategory,
      protein: newProtein ? parseFloat(newProtein) : null,
      fat: newFat ? parseFloat(newFat) : null,
      carbs: newCarbs ? parseFloat(newCarbs) : null,
      created_by: user.id,
    }).select().single()

    if (!error && data) {
      // Add to list immediately (optimistic update)
      setProducts((current) => [data as Product, ...current])
      setNewName('')
      setNewKcal('')
      setNewUnit('100g')
      setNewUnitWeight('1')
      const fallback = categories.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || categories[0]?.name || ''
      setNewCategory(fallback)
      setNewProtein('')
      setNewFat('')
      setNewCarbs('')
    }

    setIsAdding(false)
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!household?.id || !user?.id || !newCategoryName.trim()) return

    const normalizedName = newCategoryName.trim()
    const isDuplicate = categories.some((category) => category.name.toLowerCase() === normalizedName.toLowerCase())
    if (isDuplicate) {
      alert('Kategoria o tej nazwie już istnieje')
      return
    }

    setIsAddingCategory(true)

    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        household_id: household.id,
        name: normalizedName,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error || !data) {
      alert('Nie udało się dodać kategorii')
      setIsAddingCategory(false)
      return
    }

    setCategories((current) => [...current, data as ProductCategoryRecord].sort((a, b) => a.name.localeCompare(b.name, 'pl')))
    setNewCategory((current) => current || normalizedName)
    setNewCategoryName('')
    setIsAddingCategory(false)
  }

  function startCategoryEdit(category: ProductCategoryRecord) {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  async function saveCategoryEdit(category: ProductCategoryRecord) {
    const normalizedName = editingCategoryName.trim()
    if (!normalizedName) return
    if (!household?.id) return

    const isDuplicate = categories.some(
      (currentCategory) =>
        currentCategory.id !== category.id && currentCategory.name.toLowerCase() === normalizedName.toLowerCase()
    )
    if (isDuplicate) {
      alert('Kategoria o tej nazwie już istnieje')
      return
    }

    const previousName = category.name

    const { error: productsUpdateError } = await supabase
      .from('products')
      .update({ category: normalizedName })
      .eq('household_id', household.id)
      .eq('category', previousName)

    if (productsUpdateError) {
      alert('Nie udało się zaktualizować produktów dla tej kategorii')
      return
    }

    const { error: categoryUpdateError } = await supabase
      .from('product_categories')
      .update({ name: normalizedName })
      .eq('id', category.id)

    if (categoryUpdateError) {
      alert('Nie udało się zaktualizować kategorii')
      return
    }

    setCategories((current) =>
      current
        .map((currentCategory) =>
          currentCategory.id === category.id ? { ...currentCategory, name: normalizedName } : currentCategory
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    )

    setProducts((current) =>
      current.map((product) =>
        product.category === previousName ? { ...product, category: normalizedName } : product
      )
    )

    if (newCategory === previousName) {
      setNewCategory(normalizedName)
    }
    if (editCategory === previousName) {
      setEditCategory(normalizedName)
    }

    cancelCategoryEdit()
  }

  async function deleteCategory(category: ProductCategoryRecord) {
    if (!confirm(`Usunąć kategorię "${category.name}"?`)) return

    const isUsedByProducts = products.some((product) => product.category === category.name)
    if (isUsedByProducts) {
      alert('Nie można usunąć kategorii, która jest przypisana do produktów')
      return
    }

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', category.id)

    if (error) {
      alert('Nie udało się usunąć kategorii')
      return
    }

    const remainingCategories = categories.filter((currentCategory) => currentCategory.id !== category.id)
    setCategories(remainingCategories)

    if (newCategory === category.name) {
      const fallback = remainingCategories.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || remainingCategories[0]?.name || ''
      setNewCategory(fallback)
    }

    if (editCategory === category.name) {
      const fallback = remainingCategories.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || remainingCategories[0]?.name || ''
      setEditCategory(fallback)
    }

    if (editingCategoryId === category.id) {
      cancelCategoryEdit()
    }
  }

  // Start editing
  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditName(product.name)
    setEditKcal(product.kcal_per_unit.toString())
    setEditUnit(product.unit_type as UnitType)
    // Set default weight based on unit type if not provided
    const defaultWeight = product.unit_type === '100g' ? '1' 
      : product.unit_type === 'tablespoon' ? '15'
      : product.unit_type === 'teaspoon' ? '5'
      : '100'
    setEditUnitWeight(product.unit_weight_grams?.toString() || defaultWeight)
    setEditCategory(product.category)
    setEditProtein(product.protein?.toString() || '')
    setEditFat(product.fat?.toString() || '')
    setEditCarbs(product.carbs?.toString() || '')
  }

  // Cancel editing
  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditKcal('')
    setEditUnit('100g')
    setEditUnitWeight('1')
    setEditCategory(categories.find((c) => c.name === DEFAULT_CATEGORY_NAME)?.name || categories[0]?.name || '')
    setEditProtein('')
    setEditFat('')
    setEditCarbs('')
  }

  // Save edit
  async function saveEdit(productId: string) {
    if (!editName.trim() || !editKcal || !editUnitWeight || !editCategory) return

    // Optimistic update - update list immediately
    const updatedProduct = {
      name: editName.trim(),
      kcal_per_unit: parseFloat(editKcal),
      unit_type: editUnit,
      unit_weight_grams: parseFloat(editUnitWeight),
      category: editCategory,
      protein: editProtein ? parseFloat(editProtein) : null,
      fat: editFat ? parseFloat(editFat) : null,
      carbs: editCarbs ? parseFloat(editCarbs) : null,
    }

    setProducts((current) =>
      current.map((p) =>
        p.id === productId ? { ...p, ...updatedProduct } : p
      )
    )

    const { error } = await supabase
      .from('products')
      .update(updatedProduct)
      .eq('id', productId)

    if (!error) {
      setEditingId(null)
    } else {
      // Rollback on error - refetch from database
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('household_id', household!.id)
        .order('created_at', { ascending: false })

      if (data) {
        setProducts(data)
      }
    }
  }

  // Delete product
  async function deleteProduct(productId: string) {
    if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return

    // Optimistic update - remove from list immediately
    const previousProducts = [...products]
    setProducts((current) => current.filter((p) => p.id !== productId))

    const { error } = await supabase.from('products').delete().eq('id', productId)

    if (error) {
      alert('Nie udało się usunąć produktu')
      // Rollback on error
      setProducts(previousProducts)
    }
  }

  if (userLoading || isLoading) {
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
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Produkty</h2>
        <p className="text-sm text-gray-500 mt-1">Zarządzaj bazą produktów spożywczych</p>
      </div>

      {/* Categories management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Kategorie produktów</h3>
          <p className="text-xs text-gray-500 mt-1">Nazwy kategorii, które przypisujesz produktom</p>
        </div>

        <form onSubmit={addCategory} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Np. Przyprawy"
            disabled={isAddingCategory}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isAddingCategory || !newCategoryName.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAddingCategory ? 'Dodawanie...' : 'Dodaj kategorię'}
          </button>
        </form>

        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">Brak kategorii. Dodaj pierwszą kategorię.</p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-2">
                {editingCategoryId === category.id ? (
                  <>
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => saveCategoryEdit(category)}
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
                    >
                      Zapisz
                    </button>
                    <button
                      type="button"
                      onClick={cancelCategoryEdit}
                      className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      Anuluj
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-800">{category.name}</span>
                    <button
                      type="button"
                      onClick={() => startCategoryEdit(category)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Usuń
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new product form */}
      <form onSubmit={addProduct} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Dodaj nowy produkt</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa produktu
            </label>
            <input
              id="product-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nazwa produktu"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>
          <div>
            <label htmlFor="product-kcal" className="block text-sm font-medium text-gray-700 mb-1">
              Kalorie (kcal)
            </label>
            <input
              id="product-kcal"
              type="number"
              step="0.01"
              value={newKcal}
              onChange={(e) => setNewKcal(e.target.value)}
              placeholder="Kalorie"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>
          <div>
            <label htmlFor="product-protein" className="block text-sm font-medium text-gray-700 mb-1">
              Białko (g)
            </label>
            <input
              id="product-protein"
              type="number"
              step="0.01"
              value={newProtein}
              onChange={(e) => setNewProtein(e.target.value)}
              placeholder="Białko"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="product-fat" className="block text-sm font-medium text-gray-700 mb-1">
              Tłuszcz (g)
            </label>
            <input
              id="product-fat"
              type="number"
              step="0.01"
              value={newFat}
              onChange={(e) => setNewFat(e.target.value)}
              placeholder="Tłuszcz"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label htmlFor="product-carbs" className="block text-sm font-medium text-gray-700 mb-1">
              Węglowodany (g)
            </label>
            <input
              id="product-carbs"
              type="number"
              step="0.01"
              value={newCarbs}
              onChange={(e) => setNewCarbs(e.target.value)}
              placeholder="Węglowodany"
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
          <div>
            <label htmlFor="product-unit" className="block text-sm font-medium text-gray-700 mb-1">
              Preferowana jednostka
            </label>
            <select
              id="product-unit"
              value={newUnit}
              onChange={(e) => {
                const unit = e.target.value as UnitType
                setNewUnit(unit)
                // Auto-set default weight based on unit
                if (unit === '100g') setNewUnitWeight('1')
                else if (unit === 'tablespoon') setNewUnitWeight('15')
                else if (unit === 'teaspoon') setNewUnitWeight('5')
                else if (unit === 'piece') setNewUnitWeight('100')
              }}
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="product-unit-weight" className="block text-sm font-medium text-gray-700 mb-1">
              Waga jednostki (g)
            </label>
            <input
              id="product-unit-weight"
              type="number"
              step="0.01"
              value={newUnitWeight}
              onChange={(e) => setNewUnitWeight(e.target.value)}
              placeholder={newUnit === '100g' ? '1 (dla gramów)' : newUnit === 'piece' ? 'np. 300 dla sztuki' : newUnit === 'tablespoon' ? '15' : '5'}
              disabled={isAdding}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              required
            />
          </div>
          <div>
            <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
              Kategoria
            </label>
            <select
              id="product-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={isAdding || categories.length === 0}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isAdding || !newName.trim() || !newKcal || categories.length === 0 || !newCategory}
              className="w-full rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? 'Dodawanie...' : 'Dodaj produkt'}
            </button>
          </div>
        </div>
      </form>

      {/* Products list */}
      <div className="space-y-3">
        {products.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">Brak produktów</p>
            <p className="text-gray-400 text-xs mt-1">Dodaj pierwszy produkt powyżej</p>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              {editingId === product.id ? (
                // Edit mode
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nazwa produktu</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nazwa"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kalorie (kcal)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editKcal}
                        onChange={(e) => setEditKcal(e.target.value)}
                        placeholder="Kalorie"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Białko (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editProtein}
                        onChange={(e) => setEditProtein(e.target.value)}
                        placeholder="Białko"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tłuszcz (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFat}
                        onChange={(e) => setEditFat(e.target.value)}
                        placeholder="Tłuszcz"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Węglowodany (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editCarbs}
                        onChange={(e) => setEditCarbs(e.target.value)}
                        placeholder="Węglowodany"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Preferowana jednostka</label>
                      <select
                        value={editUnit}
                        onChange={(e) => {
                          const unit = e.target.value as UnitType
                          setEditUnit(unit)
                          // Auto-set default weight based on unit
                          if (unit === '100g') setEditUnitWeight('1')
                          else if (unit === 'tablespoon') setEditUnitWeight('15')
                          else if (unit === 'teaspoon') setEditUnitWeight('5')
                          else if (unit === 'piece') setEditUnitWeight('100')
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Waga jednostki (g)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editUnitWeight}
                        onChange={(e) => setEditUnitWeight(e.target.value)}
                        placeholder={editUnit === '100g' ? '1 (dla gramów)' : editUnit === 'piece' ? 'np. 300 dla sztuki' : editUnit === 'tablespoon' ? '15' : '5'}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        disabled={categories.length === 0}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => saveEdit(product.id)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
                    >
                      Zapisz
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {product.name}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">
                        {product.category}
                      </span>
                      <span>{product.kcal_per_unit} kcal</span>
                      {product.protein && <span>• B: {product.protein}g</span>}
                      {product.fat && <span>• T: {product.fat}g</span>}
                      {product.carbs && <span>• W: {product.carbs}g</span>}
                      <span>
                        • {UNITS.find((u) => u.value === product.unit_type)?.label || product.unit_type}
                        {product.unit_weight_grams && ` (${product.unit_weight_grams}g)`}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(product)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {products.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-600">
          Wszystkich produktów: <span className="font-semibold text-gray-900">{products.length}</span>
        </div>
      )}
    </div>
  )
}
