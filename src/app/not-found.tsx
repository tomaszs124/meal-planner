import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-sm border border-gray-200 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Nie ma takiej strony</h1>
        <p className="mt-2 text-sm text-gray-600">Adres jest nieprawidłowy albo strona została przeniesiona.</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Wróć do planu
        </Link>
      </div>
    </div>
  )
}
