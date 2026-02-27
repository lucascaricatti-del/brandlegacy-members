export type IntegrationPlatform = 'meta_ads' | 'google_ads' | 'ga4' | 'shopify'

export type PlatformField = {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
}

export type PlatformConfig = {
  id: IntegrationPlatform
  name: string
  description: string
  color: string
  fields: PlatformField[]
  instructions: string
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook e Instagram Ads — gastos, impressões, cliques, conversões.',
    color: '#1877F2',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAAxxxxxxx...' },
      { key: 'account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789' },
    ],
    instructions:
      'Acesse o Facebook Business Manager > Configurações > Gerar Token de Acesso. ' +
      'O Account ID está em Configurações da conta de anúncios (formato act_XXXXXXXX).',
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Google Ads — gastos, cliques, impressões, conversões.',
    color: '#4285F4',
    fields: [
      { key: 'access_token', label: 'Refresh Token (OAuth2)', type: 'password', placeholder: '1//0xxxxxxx...' },
      { key: 'account_id', label: 'Customer ID', type: 'text', placeholder: '123-456-7890' },
      { key: 'developer_token', label: 'Developer Token', type: 'password', placeholder: 'xxxxxxxx' },
    ],
    instructions:
      'Necessita OAuth2 refresh token + Developer Token da Google Ads API. ' +
      'Customer ID está no canto superior direito do Google Ads (formato XXX-XXX-XXXX).',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'GA4 — sessões, usuários, taxa de conversão, páginas vistas.',
    color: '#E37400',
    fields: [
      { key: 'access_token', label: 'Service Account JSON (base64)', type: 'password', placeholder: 'eyJxxxxxxxxx...' },
      { key: 'account_id', label: 'Property ID', type: 'text', placeholder: '123456789' },
    ],
    instructions:
      'Crie uma Service Account no Google Cloud Console com acesso ao GA4. ' +
      'Exporte o JSON e converta para base64. O Property ID está em Admin > Detalhes da Propriedade.',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Shopify — pedidos, receita, ticket médio, produtos vendidos.',
    color: '#96BF48',
    fields: [
      { key: 'access_token', label: 'Admin API Access Token', type: 'password', placeholder: 'shpat_xxxxxxx...' },
      { key: 'account_id', label: 'Domínio da Loja', type: 'text', placeholder: 'minhaloja.myshopify.com' },
    ],
    instructions:
      'Crie um app privado em Configurações > Apps > Desenvolver apps. ' +
      'Gere um Admin API Access Token com permissão de leitura de Pedidos.',
  },
]

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p])) as Record<IntegrationPlatform, PlatformConfig>

export const PLATFORM_LABELS: Record<IntegrationPlatform, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  ga4: 'Google Analytics 4',
  shopify: 'Shopify',
}

export const PLATFORM_COLORS: Record<IntegrationPlatform, string> = {
  meta_ads: '#1877F2',
  google_ads: '#4285F4',
  ga4: '#E37400',
  shopify: '#96BF48',
}
