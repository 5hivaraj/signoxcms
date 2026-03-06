/**
 * Timezone utilities for SignoX
 * All times are standardized to India Standard Time (IST)
 */

const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current time in IST format (HH:MM)
 * @returns {string} Current time in HH:MM format
 */
function getCurrentTimeIST() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    timeZone: INDIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get current day in IST
 * @returns {string} Current day name in lowercase (e.g., 'monday')
 */
function getCurrentDayIST() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: INDIA_TIMEZONE
  }).toLowerCase();
}

/**
 * Get current date and time in IST
 * @returns {object} Object with time, day, and formatted strings
 */
function getCurrentDateTimeIST() {
  const now = new Date();
  
  const time = getCurrentTimeIST();
  const day = getCurrentDayIST();
  
  const fullDateTime = now.toLocaleString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return {
    time,
    day,
    fullDateTime,
    utcTime: now.toISOString(),
    timezone: INDIA_TIMEZONE
  };
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 * @param {string} timeString - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time in HH:MM format
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if current time is within a time range (IST)
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {boolean} True if current time is within range
 */
function isCurrentTimeInRange(startTime, endTime) {
  const currentTime = getCurrentTimeIST();
  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Format date for IST display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateIST(date) {
  return date.toLocaleDateString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format time for IST display
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
function formatTimeIST(date) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: INDIA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

module.exports = {
  INDIA_TIMEZONE,
  getCurrentTimeIST,
  getCurrentDayIST,
  getCurrentDateTimeIST,
  timeToMinutes,
  minutesToTime,
  isCurrentTimeInRange,
  formatDateIST,
  formatTimeIST
};