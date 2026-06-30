import type { User } from '@supabase/supabase-js'

export type { User }

// Shared row shapes for the data we read out of Supabase. The project does not
// use generated DB types, so these are hand-maintained to cover the columns the
// UI actually touches. Monetary columns come back as strings (Postgres numeric),
// hence the `string` typing — callers use parseFloat on them.

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  role: string | null
  status: string
  created_at: string
}

export interface Listing {
  id: string
  seller_id: string
  name: string
  description: string | null
  cuisine: string
  price: string
  status: string
  image_url: string | null
  rating: number | null
  reviews_count: number | null
  featured: boolean | null
  halal: boolean | null
  vegan: boolean | null
  vegetarian: boolean | null
  spicy: boolean | null
  serves: number | null
  prep_time: string | null
  delivery_options: string[] | string | null
  delivery_radius_miles: number | null
  allergens: string[] | null
  created_at: string
  profiles?: Pick<Profile, 'full_name'> | null
}

export interface Order {
  id: string
  buyer_id: string
  seller_id: string
  driver_id: string | null
  listing_id: string
  status: string
  quantity: number
  total_amount: string
  seller_payout: string
  platform_commission: string
  delivery_fee: string
  service_fee: string
  delivery_type: string | null
  delivery_address: string | null
  collection_code: string | null
  notes: string | null
  created_at: string
  listings?: Pick<Listing, 'name' | 'cuisine'> | null
  profiles?: Pick<Profile, 'full_name'> | null
}

export interface LoyaltyPoint {
  id: string
  buyer_id: string
  order_id: string | null
  points: number
  type: 'earned' | 'redeemed'
  description: string | null
  created_at: string
}

export interface Review {
  id: string
  buyer_id: string
  seller_id: string
  order_id: string
  rating: number
  comment: string | null
  verified: boolean | null
  created_at: string
  profiles?: Pick<Profile, 'full_name'> | null
  orders?: { listings?: Pick<Listing, 'name'> | null } | null
}
