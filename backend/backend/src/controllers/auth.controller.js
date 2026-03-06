const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// In-memory store for login attempts (in production, use Redis)
const loginAttempts = new Map();

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_TIME = parseInt(process.env.LOCKOUT_TIME) || 15 * 60 * 1000; // 15 minutes

// Helper function to check if IP is locked out
const isLockedOut = async (ip) => {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    console.warn(`High login attempts from IP: ${ip}`);
    
    // Add small delay instead of block
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return false;
};

// Helper function to record failed login attempt
const recordFailedAttempt = (ip) => {
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  loginAttempts.set(ip, attempts);
};

// Helper function to clear login attempts on successful login
const clearLoginAttempts = (ip) => {
  loginAttempts.delete(ip);
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check if IP is locked out
    if (await isLockedOut(clientIP)) {
      console.log(`Login attempt blocked: IP locked out - ${clientIP}`);
      return res.status(429).json({ 
        message: 'Too many failed login attempts. Please try again later.',
        lockoutTime: LOCKOUT_TIME / 1000 / 60 // minutes
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
     include: {
        clientProfile: true,
        managedByClientAdmin: {
          include: {
            clientProfile: true,
          },
        },
        createdByUserAdmin: {
          include: {
            managedByClientAdmin: {
              include: {
                clientProfile: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log(`Login attempt failed: User not found - ${email}`);
      recordFailedAttempt(clientIP);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user account is active
    if (!user.isActive) {
      console.log(`Login attempt failed: User account suspended - ${email}`);
      return res.status(401).json({ message: 'Account is suspended' });
    }

    // Check if parent Client Admin is active (for User Admins)
    if (user.role === 'USER_ADMIN' && user.managedByClientAdmin) {
      if (!user.managedByClientAdmin.isActive) {
        console.log(`Login attempt failed: Parent Client Admin suspended - ${email}`);
        return res.status(401).json({ message: 'Your organization account is suspended. Please contact support.' });
      }
      
      // Check if Client Admin's profile is active
      if (user.managedByClientAdmin.clientProfile) {
        if (!user.managedByClientAdmin.clientProfile.isActive) {
          console.log(`Login attempt failed: Client profile suspended - ${email}`);
          return res.status(401).json({ message: 'Your organization license is suspended. Please contact support.' });
        }
        
        // Check license expiry
        if (user.managedByClientAdmin.clientProfile.licenseExpiry && 
            new Date(user.managedByClientAdmin.clientProfile.licenseExpiry) < new Date()) {
          console.log(`Login attempt failed: Parent license expired - ${email}`, { 
            licenseExpiry: user.managedByClientAdmin.clientProfile.licenseExpiry 
          });
          return res.status(401).json({ message: 'Your organization license has expired. Please contact your administrator.' });
        }
      }
    }

    // Check if parent User Admin and Client Admin are active (for Staff)
    if (user.role === 'STAFF' && user.createdByUserAdmin) {
      // Check User Admin status
      if (!user.createdByUserAdmin.isActive) {
        console.log(`Login attempt failed: Parent User Admin suspended - ${email}`);
        return res.status(401).json({ message: 'Your manager account is suspended. Please contact support.' });
      }

      // Check Client Admin status
      if (user.createdByUserAdmin.managedByClientAdmin) {
        if (!user.createdByUserAdmin.managedByClientAdmin.isActive) {
          console.log(`Login attempt failed: Parent Client Admin suspended (via Staff) - ${email}`);
          return res.status(401).json({ message: 'Your organization account is suspended. Please contact support.' });
        }

        // Check Client Admin's profile
        if (user.createdByUserAdmin.managedByClientAdmin.clientProfile) {
          if (!user.createdByUserAdmin.managedByClientAdmin.clientProfile.isActive) {
            console.log(`Login attempt failed: Client profile suspended (via Staff) - ${email}`);
            return res.status(401).json({ message: 'Your organization license is suspended. Please contact support.' });
          }
          
          // Check license expiry
          if (user.createdByUserAdmin.managedByClientAdmin.clientProfile.licenseExpiry && 
              new Date(user.createdByUserAdmin.managedByClientAdmin.clientProfile.licenseExpiry) < new Date()) {
            console.log(`Login attempt failed: Organization license expired (via Staff) - ${email}`, { 
              licenseExpiry: user.createdByUserAdmin.managedByClientAdmin.clientProfile.licenseExpiry 
            });
            return res.status(401).json({ message: 'Your organization license has expired. Please contact your administrator.' });
          }
        }
      }
    }

    // Check if Client Admin's own profile is active
    if (user.role === 'CLIENT_ADMIN' && user.clientProfile) {
      if (!user.clientProfile.isActive) {
        console.log(`Login attempt failed: Client profile suspended - ${email}`);
        return res.status(401).json({ message: 'Your organization license is suspended. Please contact support.' });
      }
      
      // Check license expiry
      if (user.clientProfile.licenseExpiry && new Date(user.clientProfile.licenseExpiry) < new Date()) {
        console.log(`Login attempt failed: License expired - ${email}`, { licenseExpiry: user.clientProfile.licenseExpiry });
        return res.status(401).json({ message: 'Your license has expired. Please renew to continue.' });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login attempt failed: Invalid password - ${email}`);
      recordFailedAttempt(clientIP);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Clear failed attempts on successful login
    clearLoginAttempts(clientIP);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Fetch full user data with relations
    const userWithProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        clientProfile: true,
      },
    });

    console.log(`Login successful: ${email} from IP: ${clientIP}`);
    
    // Don't send sensitive data
    const { password: _, ...userResponse } = userWithProfile;
    
    // Convert BigInt to number for JSON serialization
    const clientProfileForResponse = userResponse.clientProfile ? {
      ...userResponse.clientProfile,
      monthlyUploadedBytes: Number(userResponse.clientProfile.monthlyUploadedBytes || 0)
    } : null;
    
    return res.json({
      accessToken: token,
      user: {
        id: userResponse.id,
        email: userResponse.email,
        role: userResponse.role,
        staffRole: userResponse.staffRole,
        isActive: userResponse.isActive,
        clientProfile: clientProfileForResponse,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
exports.me = async (req, res) => {
  try {
    // Fetch full user data from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        clientProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert BigInt to number for JSON serialization
    const clientProfileForResponse = user.clientProfile ? {
      ...user.clientProfile,
      monthlyUploadedBytes: Number(user.clientProfile.monthlyUploadedBytes || 0)
    } : null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        staffRole: user.staffRole,
        isActive: user.isActive,
        clientProfile: clientProfileForResponse,
      },
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
