export const isAdminRole = (role) => ['admin', 'super_admin'].includes(role);

export const isOrderOwnerOrAdmin = (order, user) => {
  if (!order || !user) return false;
  const orderUserId = order.user?._id?.toString() || order.user?.toString();
  return orderUserId === user._id.toString() || isAdminRole(user.role);
};
