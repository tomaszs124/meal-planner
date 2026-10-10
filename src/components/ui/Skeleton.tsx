/**
 * Lightweight loading placeholders (Tailwind only, no hooks, no dependencies).
 *
 * Primitives (`Skeleton`, `SkeletonText`, `SkeletonCard`) are purely decorative
 * (`aria-hidden`). Page-level composites wrap them in `role="status"` with an
 * `sr-only` label so screen readers still announce the loading state.
 */

type ClassNameProps = { className?: string }

const BASE = 'animate-pulse bg-gray-200 dark:bg-gray-600 rounded'

export function Skeleton({ className = '' }: ClassNameProps) {
  return <div aria-hidden="true" className={`${BASE} ${className}`} />
}

export function SkeletonText({ lines = 2, className = '' }: { lines?: number } & ClassNameProps) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: ClassNameProps) {
  return (
    <div aria-hidden="true" className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-3">
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

function LoadingStatus({ className = '', children }: ClassNameProps & { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Ładowanie...</span>
      {children}
    </div>
  )
}

function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      {withActions && (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      )}
    </div>
  )
}

/** Meals page: header, filters bar, two accordion groups (first expanded with 4 cards). */
export function MealsListSkeleton() {
  return (
    <LoadingStatus className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Filters bar */}
      <div aria-hidden="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>

      {/* Accordion groups */}
      <div aria-hidden="true" className="space-y-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-5" />
          </div>
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-5" />
          </div>
        </div>
      </div>
    </LoadingStatus>
  )
}

function SlotRows() {
  return (
    <div aria-hidden="true" className="space-y-2 lg:hidden">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-l-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg sm:w-20 sm:flex-none" />
            <Skeleton className="h-8 flex-1 rounded-lg sm:w-20 sm:flex-none" />
            <Skeleton className="h-8 flex-1 rounded-lg sm:w-20 sm:flex-none" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SlotCards() {
  return (
    <div aria-hidden="true" className="hidden lg:grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-24" />
          </div>
          <SkeletonCard />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Day plan only (phones/tablets: 3 compact rows, desktop: 3-column grid of cards). */
export function PlannerSlotsSkeleton() {
  return (
    <LoadingStatus>
      <SlotRows />
      <SlotCards />
    </LoadingStatus>
  )
}

/** Planner: week strip (7 day circles) + day plan. */
export function PlannerSkeleton() {
  return (
    <LoadingStatus className="space-y-6">
      <div aria-hidden="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex flex-1 justify-center">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-1">
              <Skeleton className="h-2.5 w-5" />
              <Skeleton className="w-9 h-9 md:w-12 md:h-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <SlotRows />
        <SlotCards />
      </div>
    </LoadingStatus>
  )
}

/** Shopping list: header, generate panel, view options, 3 groups x 3 rows. */
export function ShoppingListSkeleton() {
  return (
    <LoadingStatus className="space-y-6">
      <PageHeaderSkeleton />

      {/* Generate panel */}
      <div aria-hidden="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* View options */}
      <div aria-hidden="true" className="flex gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Groups */}
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: 3 }, (_, g) => (
          <div key={g} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 3 }, (_, r) => (
                <div key={r} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </LoadingStatus>
  )
}

/** Products: header, form block, list of 6 rows. */
export function ProductsSkeleton() {
  return (
    <LoadingStatus className="space-y-6">
      <PageHeaderSkeleton />

      {/* Form block */}
      <div aria-hidden="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* List */}
      <div aria-hidden="true" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </LoadingStatus>
  )
}
