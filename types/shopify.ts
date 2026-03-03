// ── Supabase row ──
export interface ShopifyIntegration {
  shop_domain: string
  access_token: string
}

// ── ShopifyQL GraphQL response ──
export interface ShopifyQLColumn {
  name: string
  dataType: string
}

export interface ShopifyQLResponse {
  data?: {
    shopifyqlQuery: {
      tableData: {
        rowData: string[][]
        columns: ShopifyQLColumn[]
      } | null
      parseErrors: { code: string; message: string; field: string }[] | null
    }
  }
  errors?: { message: string }[]
}

// ── REST Orders ──
export interface ShopifyLineItem {
  id: number
  product_id: number | null
  title: string
  variant_title: string | null
  quantity: number
  price: string
}

export interface ShopifyCustomer {
  id: number
  email: string
  first_name: string
  last_name: string
}

export interface ShopifyOrder {
  id: number
  created_at: string
  total_price: string
  total_line_items_price: string
  line_items: ShopifyLineItem[]
  customer: ShopifyCustomer | null
}

// ── Aggregated product ──
export interface ShopifyProduct {
  product_id: string
  title: string
  variant: string
  quantity_sold: number
  revenue: number
  orders_count: number
}

// ── Unified response ──
export interface ShopifyAnalyticsResponse {
  period: { start: string; end: string }
  sessions: number | null
  orders: { total: number; paid: number }
  revenue: number
  average_order_value: number
  conversion_rate: number | null
  top_products: ShopifyProduct[]
  warning?: string
}
