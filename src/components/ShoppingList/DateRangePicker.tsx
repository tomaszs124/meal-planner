'use client'

import { useEffect, useState, useRef } from 'react'
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

// Date Range Picker Component
export default function DateRangePicker({ 
  startDate, 
  endDate, 
  onStartChange, 
  onEndChange 
}: { 
  startDate: string
  endDate: string
  onStartChange: (date: string) => void
  onEndChange: (date: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    
    if (selectingStart) {
      onStartChange(dateStr)
      onEndChange(dateStr)
      setSelectingStart(false)
    } else {
      const start = parseISO(startDate)
      if (day < start) {
        onStartChange(dateStr)
      } else {
        onEndChange(dateStr)
      }
      setIsOpen(false)
      setSelectingStart(true)
    }
  }

  const start = parseISO(startDate)
  const end = parseISO(endDate)

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Zakres dat
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-3 rounded-lg border border-gray-300 bg-white hover:border-gray-400 transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm text-gray-700">
          {format(start, 'd MMM yyyy', { locale: pl })} → {format(end, 'd MMM yyyy', { locale: pl })}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-80">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">
              {format(currentMonth, 'LLLL yyyy', { locale: pl })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 p-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isStart = isSameDay(day, start)
              const isEnd = isSameDay(day, end)
              const isInRange = day >= start && day <= end
              
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    p-2 text-sm rounded transition-colors
                    ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${isStart || isEnd ? 'bg-blue-600 text-white font-bold' : ''}
                    ${isInRange && !isStart && !isEnd ? 'bg-blue-100' : ''}
                    ${isCurrentMonth && !isInRange ? 'hover:bg-gray-100' : ''}
                  `}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500 text-center">
            {selectingStart ? 'Wybierz datę początkową' : 'Wybierz datę końcową'}
          </div>
        </div>
      )}
    </div>
  )
}
