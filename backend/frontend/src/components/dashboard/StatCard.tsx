'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  gradient?: string;
}

export function StatCard({ title, value, subtitle, icon, className, gradient = 'from-yellow-400 to-orange-500' }: StatCardProps) {
  return (
    <div 
      className={cn(
        'rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-100',
        className
      )}
      data-aos="fade-up"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">{title}</p>
          <p className="text-4xl font-black text-gray-900 mb-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 leading-relaxed">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`bg-gradient-to-br ${gradient} p-4 rounded-2xl shadow-lg`}>
            <div className="text-white">{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}

