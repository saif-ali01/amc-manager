// utils/itemCalc.js

/**
 * The "Expiring" threshold is the LARGEST daysBefore value configured
 * in the item's own reminders, so the badge turns amber exactly when
 * the first reminder would fire. Falls back to 30 if no reminders.
 */
function getExpiringThreshold(item) {
  if (!item.reminders || item.reminders.length === 0) return 30;
  const days = item.reminders.map(r => r.daysBefore).filter(d => typeof d === 'number');
  return days.length ? Math.max(...days) : 30;
}

function getDiffDays(endDate, now = new Date()) {
  return Math.ceil((new Date(endDate) - now) / (1000 * 60 * 60 * 24));
}

/**
 * Get the status of an item.
 * 
 * For postpaid items, we add a 30‑day grace period after the endDate
 * before considering it "Expired". This reflects the typical billing cycle
 * where the invoice arrives after the usage period.
 */
function getStatus(item, now = new Date()) {
  const end = new Date(item.endDate);
  const diffDays = getDiffDays(item.endDate, now);
  const threshold = getExpiringThreshold(item);

  // Grace period for postpaid (30 days after endDate)
  const graceDays = item.billingType === 'postpaid' ? 30 : 0;
  const expiredDate = new Date(end);
  expiredDate.setDate(expiredDate.getDate() + graceDays);

  if (expiredDate < now) return 'Expired';
  if (diffDays <= threshold) return 'Expiring';
  return 'Active';
}

/**
 * Prepaid: full cost paid upfront. Value DEPLETES over the term.
 *   remainingValue = cost * (daysRemaining / totalDays)
 *   usedValue      = cost - remainingValue
 *
 * Postpaid: cost is billed at the end based on usage. Value ACCRUES.
 *   accruedValue   = cost * (daysElapsed / totalDays)
 *   remainingValue = cost - accruedValue
 */
function calculateValue(item, now = new Date()) {
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  const cost = item.cost || 0;
  const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

  let daysElapsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
  daysElapsed = Math.min(Math.max(daysElapsed, 0), totalDays);
  const daysRemaining = totalDays - daysElapsed;

  if (item.billingType === 'postpaid') {
    const accruedValue = Math.round((cost * daysElapsed) / totalDays);
    return {
      billingType: 'postpaid',
      totalDays,
      daysElapsed,
      daysRemaining,
      accruedValue,
      remainingValue: cost - accruedValue,
    };
  }

  // prepaid (default)
  const remainingValue = Math.round((cost * daysRemaining) / totalDays);
  return {
    billingType: 'prepaid',
    totalDays,
    daysElapsed,
    daysRemaining,
    usedValue: cost - remainingValue,
    remainingValue,
  };
}

module.exports = { getExpiringThreshold, getDiffDays, getStatus, calculateValue };