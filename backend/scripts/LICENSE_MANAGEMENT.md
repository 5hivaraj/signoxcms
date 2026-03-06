# License Management System

## Overview

The SignoX platform now includes automatic license expiration checking and enforcement. When a Client Admin's license expires:

1. The Client Admin account is automatically suspended
2. All User Admins under that Client Admin are blocked from access
3. All Staff users under those User Admins are blocked from access
4. Users receive clear error messages about the license expiration

## Automatic License Checking

The system automatically checks for expired licenses:
- **Frequency**: Every hour (at minute 0)
- **Action**: Automatically suspends expired client profiles
- **Logging**: All suspensions are logged with client details

The license check service runs automatically when the backend starts in production mode.

## Manual License Management

Use the `manageLicenses.js` script to manage client licenses:

### List All Licenses

```bash
cd backend
node scripts/manageLicenses.js list
```

This shows:
- Client ID and email
- License status (Active, Expired, Suspended, Expiring Soon)
- Days until expiry or days expired
- Max displays, users, and storage limits

### Extend a License

Extend a license by a number of days:

```bash
node scripts/manageLicenses.js extend <clientId> <days>
```

Example:
```bash
node scripts/manageLicenses.js extend CL-IXP9R0 30
```

This will:
- Add the specified days to the current expiry date
- Automatically reactivate the license if it was suspended

### Set Specific Expiry Date

Set a specific expiry date:

```bash
node scripts/manageLicenses.js set-expiry <clientId> <YYYY-MM-DD>
```

Example:
```bash
node scripts/manageLicenses.js set-expiry CL-IXP9R0 2026-12-31
```

### Manually Suspend a License

Immediately suspend a license:

```bash
node scripts/manageLicenses.js suspend <clientId>
```

Example:
```bash
node scripts/manageLicenses.js suspend CL-IXP9R0
```

### Manually Activate a License

Reactivate a suspended license:

```bash
node scripts/manageLicenses.js activate <clientId>
```

Example:
```bash
node scripts/manageLicenses.js activate CL-IXP9R0
```

## How It Works

### 1. Login Check
When a user tries to log in, the system checks:
- If the user account is active
- If the Client Admin's license is active
- If the Client Admin's license has expired
- For User Admins and Staff, it checks their parent Client Admin's license

### 2. Authentication Check
On every authenticated request, the system verifies:
- User account status
- License status
- License expiry date

This ensures that even if a user is already logged in, they will be blocked once the license expires.

### 3. Automatic Suspension
The cron job runs every hour and:
- Finds all active client profiles with expired licenses
- Suspends them automatically
- Logs the suspension with details

## Error Messages

Users will see different messages based on their role:

- **Client Admin**: "Your license has expired. Please renew to continue."
- **User Admin**: "Your organization license has expired. Please contact your administrator."
- **Staff**: "Your organization license has expired. Please contact your administrator."

## Database Schema

The license information is stored in the `ClientProfile` model:

```prisma
model ClientProfile {
  licenseExpiry DateTime?  // When the license expires
  isActive      Boolean    // Whether the license is active
  // ... other fields
}
```

## Testing

To test the license expiration:

1. Set a license to expire in the past:
```bash
node scripts/manageLicenses.js set-expiry CL-IXP9R0 2026-01-01
```

2. Wait for the hourly cron job or restart the backend to trigger immediate check

3. Try to log in with that client admin or any user under them

4. Extend the license to restore access:
```bash
node scripts/manageLicenses.js extend CL-IXP9R0 30
```

## Production Deployment

The license check service is automatically enabled in production mode. Make sure:

1. `NODE_ENV=production` is set in your environment
2. The backend server is running continuously
3. Monitor logs for license expiration events

## Notifications (Future Enhancement)

Consider adding:
- Email notifications 7 days before expiry
- Email notifications 1 day before expiry
- Email notification on expiry
- Dashboard warnings for expiring licenses
