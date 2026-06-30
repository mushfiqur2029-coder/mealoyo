// Loyalty points helpers — single source of truth for the earn/redeem maths so
// the dish checkout, dashboard card and points history page all agree.
//
// EARN:   floor(food-subtotal × 11) points per order, awarded once the order is
//         delivered (see public.award_loyalty_points). ~11 points per £1.
// REDEEM: 100 points = £1.00 off. Redemption is done in whole-pound steps so the
//         points spent are always a clean multiple of 100.

export const POINTS_PER_POUND_EARN = 11
export const POINTS_PER_POUND_REDEEM = 100

/** £ value of a points balance, e.g. 250 pts → £2.50. */
export function pointsToPounds(points: number): number {
  return points / POINTS_PER_POUND_REDEEM
}

/** Points needed to discount a given number of whole pounds. */
export function poundsToPoints(pounds: number): number {
  return Math.round(pounds * POINTS_PER_POUND_REDEEM)
}

/**
 * Largest whole-pound discount a buyer can apply to an order, capped by both
 * their balance and the order's food subtotal (so the total never goes
 * negative and the seller payout is unaffected).
 */
export function maxRedeemablePounds(balance: number, subtotal: number): number {
  const byBalance = Math.floor(balance / POINTS_PER_POUND_REDEEM)
  const bySubtotal = Math.floor(subtotal)
  return Math.max(0, Math.min(byBalance, bySubtotal))
}
