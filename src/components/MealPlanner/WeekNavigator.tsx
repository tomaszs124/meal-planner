'use client'

import { useState } from 'react'
import { addDays, startOfWeek, format, isSameDay, isToday } from 'date-fns'
import { pl } from 'date-fns/locale'

type DayProgress = {
  dateString: string  // Changed from Date to string
  consumedKcal: number
  plannedKcal: number
}

type WeekNavigatorProps = {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onWeekChange: (direction: 'prev' | 'next') => void
  daysProgress?: DayProgress[]
}

export default function WeekNavigator({ 
  selectedDate, 
  onDateSelect, 
  onWeekChange,
  daysProgress = []
}: WeekNavigatorProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Poniedziałek
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onWeekChange('prev')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Poprzedni tydzień"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-sm font-semibold text-gray-900">
          {format(weekStart, 'd MMM', { locale: pl })} - {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: pl })}
        </div>

        <button
          onClick={() => onWeekChange('next')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Następny tydzień"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isCurrentDay = isToday(day)
          
          // Find progress for this day using string comparison
          const dayString = format(day, 'yyyy-MM-dd')
          const dayProgress = daysProgress.find(p => p.dateString === dayString)
          const progressPercent = dayProgress && dayProgress.plannedKcal > 0
            ? Math.min(100, Math.round((dayProgress.consumedKcal / dayProgress.plannedKcal) * 100))
            : 0

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              className={`
                flex flex-col items-center p-1 md:p-2 rounded-lg transition-all border-2
                ${isSelected
                  ? 'border-blue-600'
                  : isCurrentDay
                  ? 'border-blue-400'
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span className={`text-[10px] md:text-xs font-medium mb-0.5 md:mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`}>
                {format(day, 'EEE', { locale: pl })}
              </span>
              
              {/* Progress circle with day number */}
              <div className="relative w-9 h-9 md:w-12 md:h-12 flex items-center justify-center">
                {/* Background circle */}
                <svg 
                  className="absolute w-9 h-9 md:w-12 md:h-12 -rotate-90" 
                  viewBox="0 0 48 48"
                  key={`${dayString}-${progressPercent}`}
                >
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="#E5E7EB"
                    strokeWidth="3"
                    fill="none"
                  />
                  {/* Progress circle - always render but with variable dash */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={progressPercent >= 100 ? '#10B981' : progressPercent > 0 ? '#3B82F6' : 'transparent'}
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
                  />
                </svg>
                
                {/* Day number */}
                <span className={`relative text-base md:text-lg font-bold z-10 ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
