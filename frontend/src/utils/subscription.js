export const isSubscriptionExpired = (user) => {
  if (!user || user.role === 'SuperAdmin') return false;
  if (user.subscriptionExpired) return true;
  if (user.companyIsActive === false) return true;
  if (user.subscriptionExpiry) {
    return new Date(user.subscriptionExpiry).getTime() < Date.now();
  }
  return false;
};
