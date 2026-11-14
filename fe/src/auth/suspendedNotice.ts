/**
 * Set when the server tells a signed-in user their account was suspended, so the sign-in screen
 * can explain why they were signed out. Read once.
 */
let pending = false;

export const markSuspended = () => {
  pending = true;
};

export const takeSuspendedNotice = (): boolean => {
  const was = pending;
  pending = false;
  return was;
};
