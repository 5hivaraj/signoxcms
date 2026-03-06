import { cn } from '@/lib/utils';

interface StorageInfo {
  limitMB: number;
  usedMB: number;
  availableMB: number;
  maxMonthlyUsageMB?: number;
  monthlyUploadedMB?: number;
  monthlyQuotaRemainingMB?: number;
  quotaResetDate?: Date | string;
}

interface StorageIndicatorProps {
  storageInfo: StorageInfo;
  className?: string;
}

export function StorageIndicator({ storageInfo, className }: StorageIndicatorProps) {
  const { 
    limitMB, 
    usedMB, 
    availableMB,
    maxMonthlyUsageMB,
    monthlyUploadedMB,
    monthlyQuotaRemainingMB,
    quotaResetDate
  } = storageInfo;
  
  const storagePercentage = (usedMB / limitMB) * 100;
  const monthlyPercentage = maxMonthlyUsageMB && monthlyUploadedMB 
    ? (monthlyUploadedMB / maxMonthlyUsageMB) * 100 
    : 0;
  
  // Color based on usage percentage
  const getColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-700';
    if (percentage >= 75) return 'text-orange-700';
    if (percentage >= 50) return 'text-yellow-700';
    return 'text-green-700';
  };

  const formatResetDate = (date: Date | string | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Storage Usage (Disk Space) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Current Storage</span>
          <span className={cn('font-medium', getTextColor(storagePercentage))}>
            {usedMB.toFixed(1)}MB / {limitMB}MB
          </span>
        </div>
        
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className={cn('h-2 rounded-full transition-all duration-300', getColor(storagePercentage))}
            style={{ width: `${Math.min(storagePercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{availableMB.toFixed(1)}MB available</span>
          <span>{storagePercentage.toFixed(1)}% used</span>
        </div>
      </div>

      {/* Monthly Usage Quota */}
      {maxMonthlyUsageMB !== undefined && monthlyUploadedMB !== undefined && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Monthly Upload Quota</span>
            <span className={cn('font-medium', getTextColor(monthlyPercentage))}>
              {monthlyUploadedMB.toFixed(1)}MB / {maxMonthlyUsageMB}MB
            </span>
          </div>
          
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={cn('h-2 rounded-full transition-all duration-300', getColor(monthlyPercentage))}
              style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{monthlyQuotaRemainingMB?.toFixed(1)}MB remaining this month</span>
            <span>{monthlyPercentage.toFixed(1)}% used</span>
          </div>
          
          {quotaResetDate && (
            <div className="text-xs text-gray-500">
              Resets on {formatResetDate(quotaResetDate)}
            </div>
          )}
        </div>
      )}
      
      {/* Warnings */}
      {storagePercentage >= 90 && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
          ⚠️ Storage almost full! Delete some files to free up space.
        </div>
      )}
      
      {monthlyPercentage >= 90 && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
          ⚠️ Monthly upload quota almost exhausted! Resets on {formatResetDate(quotaResetDate)}.
        </div>
      )}
      
      {storagePercentage >= 75 && storagePercentage < 90 && (
        <div className="rounded-md bg-orange-50 p-2 text-xs text-orange-800">
          ⚠️ Storage usage is high. Consider managing your media files.
        </div>
      )}
    </div>
  );
}
