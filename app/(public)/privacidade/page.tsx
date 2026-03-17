import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — BrandLegacy Members',
  description: 'Política de privacidade da plataforma BrandLegacy Members.',
}

const sections = [
  {
    title: '1. Dados Coletados',
    content: `A BrandLegacy Members coleta diferentes categorias de dados para fornecer sua plataforma de gestão e análise de marketing digital:

**Dados de Cadastro**
Nome completo, endereço de e-mail e senha (armazenada como hash criptográfico — nunca em texto plano). Ao ser convidado para um workspace, seu e-mail é vinculado àquele ambiente.

**Dados de Integrações (fornecidos voluntariamente via OAuth)**
Quando você conecta plataformas externas, coletamos os dados necessários para exibir suas métricas:
• **Meta Ads** — access token, ID da conta de anúncios e métricas de campanhas (impressões, cliques, conversões, investimento, ROAS).
• **Google Ads** — access token, customer ID e métricas de campanhas.
• **Shopify** — access token, dados de pedidos e receita.
• **Yampi** — dados de pedidos, status, valor, método de pagamento e cupons.
• **Google Analytics 4 (GA4)** — sessões, usuários e dados de tráfego.

**Dados de Uso da Plataforma**
Metas mensais (armazenadas localmente no navegador via localStorage), planos de mídia, forecasts, métricas do plano de negócio e dados da calculadora estratégica.

**Dados de Equipe**
E-mails de membros convidados para workspaces, roles atribuídas e permissões de acesso.`,
  },
  {
    title: '2. Finalidade do Tratamento',
    content: `Todos os dados coletados são utilizados exclusivamente para:
• Exibir métricas e relatórios analíticos no dashboard pessoal do usuário.
• Consolidar dados de múltiplas plataformas em uma visão unificada.
• Permitir a gestão colaborativa de workspaces e equipes.
• Gerar forecasts, planos de mídia e análises estratégicas sob demanda do usuário.

Não utilizamos seus dados para finalidades publicitárias, perfilamento comportamental ou qualquer outro fim além do funcionamento da plataforma.`,
  },
  {
    title: '3. Armazenamento e Segurança',
    content: `• Os dados são armazenados no **Supabase**, hospedado em servidores seguros com criptografia em trânsito (TLS) e em repouso.
• Tokens de acesso às integrações são armazenados exclusivamente no servidor (server-side) e nunca expostos ao navegador do usuário.
• Utilizamos **Row Level Security (RLS)** no banco de dados, garantindo que cada usuário acesse apenas os dados dos workspaces aos quais pertence.
• Senhas são armazenadas como hash criptográfico irreversível — nunca temos acesso à sua senha em texto plano.
• Metas mensais e preferências de exibição são armazenadas localmente no navegador (localStorage) e não trafegam para nossos servidores.`,
  },
  {
    title: '4. Compartilhamento com Terceiros',
    content: `**Não vendemos, alugamos ou compartilhamos seus dados com terceiros.** Ponto final.

Os únicos acessos externos ocorrem nas chamadas de API às plataformas que você mesmo conectou (Meta, Google, Shopify, Yampi), exclusivamente para buscar suas métricas e exibi-las no seu dashboard.`,
  },
  {
    title: '5. Retenção de Dados',
    content: `Seus dados são mantidos enquanto sua conta estiver ativa na plataforma. Ao solicitar a exclusão da conta, todos os seus dados pessoais e tokens de integração serão removidos de nossos servidores em até 30 dias.

Dados agregados e anonimizados podem ser retidos para fins estatísticos internos.`,
  },
  {
    title: '6. Seus Direitos',
    content: `Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
• **Acesso** — Solicitar uma cópia de todos os dados que mantemos sobre você.
• **Correção** — Solicitar a correção de dados incompletos ou incorretos.
• **Exclusão** — Solicitar a remoção completa dos seus dados pessoais.
• **Revogação** — Desconectar qualquer integração a qualquer momento, revogando nosso acesso aos tokens e dados daquela plataforma.
• **Portabilidade** — Solicitar seus dados em formato estruturado.

Para exercer qualquer um desses direitos, entre em contato pelo e-mail informado na seção 9.`,
  },
  {
    title: '7. Integrações de Terceiros',
    content: `Ao conectar plataformas externas via OAuth, você autoriza a BrandLegacy Members a acessar dados específicos conforme os escopos solicitados. Cada plataforma possui sua própria política de privacidade:

• **Meta (Facebook/Instagram)** — https://www.facebook.com/privacy/policy
• **Google (Ads e Analytics)** — https://policies.google.com/privacy
• **Shopify** — https://www.shopify.com/legal/privacy
• **Yampi** — https://www.yampi.com.br/politica-de-privacidade

Você pode revogar o acesso de qualquer integração a qualquer momento diretamente na plataforma ou nas configurações da respectiva conta externa.`,
  },
  {
    title: '8. Segurança Técnica',
    content: `Adotamos as seguintes medidas para proteger seus dados:
• **Row Level Security (RLS)** — Políticas de segurança no nível do banco de dados que isolam os dados de cada workspace.
• **Tokens server-side** — Credenciais de integração processadas exclusivamente no servidor, sem exposição ao cliente.
• **HTTPS obrigatório** — Toda comunicação entre seu navegador e nossos servidores é criptografada.
• **Autenticação segura** — Gerenciada pelo Supabase Auth com suporte a sessões seguras e refresh tokens.
• **Princípio do menor privilégio** — Solicitamos apenas os escopos mínimos necessários para cada integração (ex.: ads_read em vez de ads_management para Meta Ads).`,
  },
  {
    title: '9. Contato',
    content: `Para dúvidas, solicitações ou exercício dos seus direitos relacionados a esta política, entre em contato:

**E-mail:** contato@brandlegacy.com.br
**Plataforma:** BrandLegacy Members
**Responsável:** BrandLegacy`,
  },
  {
    title: '10. Vigência e Atualizações',
    content: `Esta política de privacidade entra em vigor em **março de 2026** e pode ser atualizada periodicamente. Quaisquer alterações significativas serão comunicadas por e-mail ou notificação na plataforma.

A versão mais recente estará sempre disponível nesta página.`,
  },
]

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
          <div className="mb-2 text-sm font-medium tracking-widest uppercase text-brand-gold">
            Política de Privacidade
          </div>
          <h1 className="text-3xl font-bold text-text-primary md:text-4xl">
            BrandLegacy Members
          </h1>
          <p className="mt-3 text-text-secondary">
            Última atualização: março de 2026
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
        <p className="mb-10 text-text-secondary leading-relaxed">
          A BrandLegacy Members tem o compromisso de proteger a privacidade dos
          seus usuários. Esta política descreve como coletamos, utilizamos,
          armazenamos e protegemos seus dados ao utilizar nossa plataforma
          disponível em{' '}
          <span className="text-brand-gold">membros.brandlegacy.com.br</span>.
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-xl font-semibold text-text-primary">
                {section.title}
              </h2>
              <div className="prose-privacy text-text-secondary leading-relaxed whitespace-pre-line">
                {section.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={i} className="text-text-primary font-medium">
                        {part.slice(2, -2)}
                      </strong>
                    )
                  }
                  if (part.startsWith('https://')) {
                    return (
                      <a
                        key={i}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-gold underline decoration-brand-gold/30 hover:decoration-brand-gold"
                      >
                        {part}
                      </a>
                    )
                  }
                  return <span key={i}>{part}</span>
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-14 border-t border-border pt-8">
          <a
            href="/login"
            className="text-sm text-text-muted hover:text-brand-gold transition-colors"
          >
            &larr; Voltar para o login
          </a>
        </div>
      </main>
    </div>
  )
}
