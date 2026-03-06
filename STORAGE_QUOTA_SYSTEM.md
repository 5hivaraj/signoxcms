# Dual Storage Quota System

## Overview

The system now implements a **dual-quota system** for client storage management:

1. **Storage Limit** - Maximum disk space for files at any given time
2. **Monthly Usage Limit** - Maximum data that can be uploaded per month (resets monthly)

Both limits are independently configurable by super admins and both are enforced during uploads.

## How It Works

### Storage Limit (Disk Space)
- Tracks current files on disk
- Decreases when files are deleted
- Prevents storing more than the allocated disk space

### Monthly Usage Limit (Bandwidth Quota)
- Tracks cumulative uploads for the current month
- **Does NOT decrease** when files are deleted
- Resets automatically on the billing day each month
- Prevents excessive upload/delete cycling

### Example Scenario

**Client Configuration:**
- Storage Limit: 1GB
- Monthly Usage Limit: 6GB
- Billing Day: 1st of month

**January Activities:**
```
Upload 1GB  → Storage: 1GB/1GB, Monthly: 1GB/6GB ✅
Delete 1GB  → Storage: 0GB/1GB,  Monthly: 1GB/6GB
Upload 1GB  → Storage: 1GB/1GB, Monthly: 2GB/6GB ✅
Delete 1GB  → Storage: 0GB/1GB,  Monthly: 2GB/6GB
... (repeat 4 more times)
Upload 1GB  → Storage: 1GB/1GB, Monthly: 6GB/6GB ✅
Delete 1GB  → Storage: 0GB/1GB,  Monthly: 6GB/6GB
Upload 100MB → ❌ REJECTED - Monthly quota exhausted!
```

**February 1st:**
- Monthly usage resets to 0GB/6GB
- Can upload up to 6GB again for February

## Database Schema Changes

### ClientProfile Model

New fields added:
```prisma
maxMonthlyUsageMB    Int     @default(150)  // Monthly upload limit
monthlyUploadedBytes BigInt  @default(0)    // Current month's uploads
usageQuotaResetDate  DateTime @default(now()) // Last reset date
billingDayOfMonth    Int     @default(1)    // Day to reset (1-28)
```

## API Changes

### Storage Info Response

The `getClientStorageInfo()` function now returns:

```javascript
{
  // Storage (disk space)
  limitMB: 1024,
  usedMB: 500,
  availableMB: 524,
  
  // Monthly usage (bandwidth)
  maxMonthlyUsageMB: 6144,
  monthlyUploadedMB: 5120,
  monthlyQuotaRemainingMB: 1024,
  quotaResetDate: "2026-02-01T00:00:00Z"
}
```

### Upload Validation

Before allowing upload, the system checks:
1. ✅ File size ≤ Available storage
2. ✅ File size ≤ Monthly quota remaining

Both checks must pass for upload to succeed.

## Super Admin Configuration

Super admins can configure both limits independently for each client:

### Create Client
- Storage Limit (MB): Controls disk space
- Monthly Usage Limit (MB): Controls monthly uploads
- Default ratio: 6x (e.g., 1GB storage = 6GB monthly usage)

### Edit Client
Both limits can be adjusted at any time:
- Increasing limits takes effect immediately
- Decreasing limits applies to new uploads

## Frontend Display

### Storage Indicator Component

Shows two separate progress bars:

1. **Current Storage** - Files on disk
   - Green: < 50%
   - Yellow: 50-75%
   - Orange: 75-90%
   - Red: ≥ 90%

2. **Monthly Upload Quota** - Uploads this month
   - Same color coding
   - Shows reset date
   - Warns when approaching limit

### Error Messages

**Storage Full:**
```
Cannot upload. Storage limit reached (1GB / 1GB). 
Please delete some files to free up space.
```

**Monthly Quota Exhausted:**
```
Cannot upload. Monthly usage quota exhausted (6GB / 6GB). 
You've uploaded 6GB this month. Quota resets on February 1, 2026.
```

## Migration

### For Existing Installations

1. **Update Prisma Schema:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Run Migration Script:**
   ```bash
   node scripts/migrateMonthlyUsageQuota.js
   ```

   This script will:
   - Set `maxMonthlyUsageMB` to 6x storage limit
   - Set `monthlyUploadedBytes` to current storage (conservative)
   - Set `billingDayOfMonth` to 1
   - Set `usageQuotaResetDate` to now

3. **Restart Backend:**
   ```bash
   npm run dev
   ```

### Migration Behavior

The migration uses a **conservative approach**:
- Sets initial monthly usage to current storage
- Ensures existing clients don't immediately hit limits
- Allows gradual transition to new system

## Implementation Details

### Automatic Reset

The system automatically resets monthly quota:
- Checked on every upload attempt
- Resets if current date ≥ next reset date
- Handles edge cases (e.g., Feb 30 → Feb 28)

### Manual Reset

Super admins can manually reset by editing the client profile (future feature).

### Quota Tracking

Monthly uploads are tracked by:
1. Checking quota before upload
2. Incrementing counter after successful upload
3. Never decrementing on delete

## Use Cases

### Prevents Abuse
Users can't bypass storage limits by repeatedly uploading and deleting files.

### Bandwidth Control
Limits data transfer per month, useful for CDN cost management.

### Fair Usage
Ensures clients use the service within reasonable bounds.

### Scalable Pricing
Different tiers can have different storage:usage ratios:
- Basic: 1GB storage, 6GB monthly (6x)
- Pro: 5GB storage, 50GB monthly (10x)
- Enterprise: 20GB storage, 200GB monthly (10x)

## Testing

### Test Scenarios

1. **Normal Upload:**
   - Upload within both limits → Success

2. **Storage Full:**
   - Upload when storage full → Rejected with storage error

3. **Monthly Quota Exhausted:**
   - Upload when quota exhausted → Rejected with quota error

4. **Both Limits Reached:**
   - Upload when both full → Rejected with appropriate error

5. **Monthly Reset:**
   - Wait for reset date → Quota resets, can upload again

6. **Delete and Re-upload:**
   - Delete files → Storage decreases, quota unchanged
   - Re-upload → Quota increases, storage increases

## Monitoring

### Recommended Metrics

- Average monthly usage per client
- Clients approaching storage limit
- Clients approaching monthly quota
- Quota reset frequency
- Upload/delete patterns

## Future Enhancements

1. **Custom Billing Cycles:**
   - Per-client billing day configuration
   - Anniversary-based billing

2. **Usage Analytics:**
   - Historical usage graphs
   - Trend analysis
   - Predictive alerts

3. **Quota Rollover:**
   - Unused quota carries to next month
   - Configurable rollover limits

4. **Temporary Quota Boost:**
   - One-time quota increases
   - Promotional allowances

5. **Usage Notifications:**
   - Email alerts at 75%, 90%, 100%
   - Webhook notifications

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Verify Prisma schema is up to date
3. Ensure migration script ran successfully
4. Check client profile has all new fields populated
