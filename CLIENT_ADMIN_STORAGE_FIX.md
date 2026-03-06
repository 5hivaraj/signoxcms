# Client Admin Storage Display Fix

## Issue
Storage details were not visible in the Client Admin dashboard. The storage card showed "Loading storage info..." indefinitely.

## Root Cause
The `requireContentViewAccess` middleware in `backend/src/middleware/auth.middleware.js` only allowed:
- `USER_ADMIN` role
- `STAFF` role with specific staff roles (CONTENT_MANAGER, BROADCAST_MANAGER, CMS_VIEWER)

It did NOT allow `CLIENT_ADMIN` role to access the storage-info endpoint.

## Impact
CLIENT_ADMIN users could not:
- View storage information (GET `/api/media/storage-info`)
- View media library (GET `/api/media`)
- See their organization's storage usage and monthly quota

## Solution
Updated the `requireContentViewAccess` middleware to include CLIENT_ADMIN role.

### Code Changes

**File**: `backend/src/middleware/auth.middleware.js`

```javascript
/**
 * Require content view access
 * Allows: CLIENT_ADMIN, USER_ADMIN, and STAFF with content roles
 */
const requireContentViewAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // CLIENT_ADMIN can view content for their organization
  if (req.user.role === 'CLIENT_ADMIN') {
    return next();
  }
  // USER_ADMIN can view content for their team
  if (req.user.role === 'USER_ADMIN') {
    return next();
  }
  // STAFF with content roles can view content
  if (
    req.user.role === 'STAFF' &&
    ['CONTENT_MANAGER', 'BROADCAST_MANAGER', 'CMS_VIEWER'].includes(req.user.staffRole)
  ) {
    return next();
  }
  return res.status(403).json({
    message: 'Forbidden: Content viewing access required',
  });
};
```

## What CLIENT_ADMIN Can Now Access

With this fix, CLIENT_ADMIN can now:

1. **View Storage Info** (`GET /api/media/storage-info`)
   - Current storage usage
   - Storage limit
   - Monthly upload quota
   - Monthly usage
   - Quota reset date

2. **View Media Library** (`GET /api/media`)
   - List all media files in their organization
   - View media metadata
   - See file sizes and types

## What CLIENT_ADMIN Still Cannot Do

CLIENT_ADMIN still cannot:
- Upload media (requires USER_ADMIN or STAFF with CONTENT_MANAGER/BROADCAST_MANAGER)
- Delete media (requires USER_ADMIN or STAFF with CONTENT_MANAGER/BROADCAST_MANAGER)
- Update media (requires USER_ADMIN or STAFF with CONTENT_MANAGER/BROADCAST_MANAGER)

This is by design - CLIENT_ADMIN is for oversight and management, not content operations.

## Files Modified

- `backend/src/middleware/auth.middleware.js` - Added CLIENT_ADMIN to requireContentViewAccess

## Testing

To verify the fix:

1. Login as CLIENT_ADMIN
2. Navigate to Client Dashboard (`/client/dashboard`)
3. Scroll to "Storage & Monthly Usage" card
4. Should see:
   - Current storage usage with progress bar
   - Monthly upload quota with progress bar
   - Quota reset date
   - Color-coded warnings if approaching limits

## Related Features

This fix enables the dual storage quota system for CLIENT_ADMIN:
- Storage Limit: Maximum files on disk (e.g., 1GB)
- Monthly Usage Limit: Maximum uploads per month (e.g., 6GB)
- Both limits are independently configurable by SUPER_ADMIN
- Monthly quota resets on billing day

## Status
✅ Fixed - CLIENT_ADMIN can now view storage information in their dashboard
