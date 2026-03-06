const validator = require('validator');

/**
 * Input validation middleware
 */

// Email validation
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return validator.isEmail(email) && email.length <= 254;
};

// Password validation
const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
};

// Name validation
const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 1 && name.length <= 100;
};

// ID validation (MongoDB ObjectId)
const validateObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// URL validation
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return validator.isURL(url, { protocols: ['http', 'https'] });
};

// Sanitize string input
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return validator.escape(str.trim());
};

// Validate login input
const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  
  const errors = [];
  
  if (!validateEmail(email)) {
    errors.push('Valid email is required');
  }
  
  if (!password || password.length < 1) {
    errors.push('Password is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors 
    });
  }
  
  // Sanitize inputs
  req.body.email = email.toLowerCase().trim();
  
  next();
};

// Validate user creation input
const validateUserInput = (req, res, next) => {
  const { email, password, role, name } = req.body;
  
  const errors = [];
  
  if (!validateEmail(email)) {
    errors.push('Valid email is required');
  }
  
  if (!validatePassword(password)) {
    errors.push('Password must be 8-128 characters long');
  }
  
  if (name && !validateName(name)) {
    errors.push('Name must be 1-100 characters long');
  }
  
  const validRoles = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'USER_ADMIN', 'STAFF'];
  if (role && !validRoles.includes(role)) {
    errors.push('Invalid role specified');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors 
    });
  }
  
  // Sanitize inputs
  req.body.email = email.toLowerCase().trim();
  if (name) req.body.name = sanitizeString(name);
  
  next();
};

// Validate media upload
const validateMediaInput = (req, res, next) => {
  const { name, description } = req.body;
  
  const errors = [];
  
  if (name && !validateName(name)) {
    errors.push('Media name must be 1-100 characters long');
  }
  
  if (description && description.length > 500) {
    errors.push('Description must be less than 500 characters');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors 
    });
  }
  
  // Sanitize inputs
  if (name) req.body.name = sanitizeString(name);
  if (description) req.body.description = sanitizeString(description);
  
  next();
};

// Validate ObjectId parameter
const validateObjectIdParam = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!validateObjectId(id)) {
      return res.status(400).json({ 
        message: `Invalid ${paramName} format` 
      });
    }
    
    next();
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateObjectId,
  validateUrl,
  sanitizeString,
  validateLoginInput,
  validateUserInput,
  validateMediaInput,
  validateObjectIdParam,
};