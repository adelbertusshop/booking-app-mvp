export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">📅 BookingApp</h1>
        <p className="text-lg text-gray-600 mb-8">Inteligentny system rezerwacji wizyt</p>
        <a 
          href="/demo/book" 
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Zarezerwuj wizytę
        </a>
      </div>
    </main>
  )
}
