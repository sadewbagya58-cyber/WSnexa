export const CUSTOMER_FAVORITE_INTENT_COOKIE = 'wsnexa_favorite_intent';

export interface FavoriteIntentData {
  venueProfileId: string;
  returnUrl?: string;
  createdAt: string;
}
