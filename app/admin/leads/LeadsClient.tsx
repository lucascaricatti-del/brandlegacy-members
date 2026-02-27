'use client'

import { useState } from 'react'

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  module_id: string | null
  module_title: string | null
  utm_source: string | null
  utm_campaign: string | null
  created_at: string
}

interface ModuleOption {
  id: string
  title: string
}

export default function LeadsClient({
  leads,
  modules,
}: {
  leads: Lead[]
  modules: ModuleOption[]
}) {
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<string>('all')

  const filtered = leads.filter((l) => {
    const matchesSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
    const matchesModule = moduleFilter === 'all' || l.module_id === moduleFilter
    return matchesSearch && matchesModule
  })

  function exportCSV() {
    const headers = ['Nome', 'Email', 'WhatsApp', 'Módulo', 'UTM Source', 'UTM Campaign', 'Data']
    const rows = filtered.map((l) => [
      l.name,
      l.email,
      l.phone ?? '',
      l.module_title ?? '',
      l.utm_source ?? '',
      l.utm_campaign ?? '',
      new Date(l.created_at).toLocaleDateString('pt-BR'),
    ])

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Leads</h1>
          <p className="text-text-muted text-sm mt-1">{leads.length} leads capturados</p>
        </div>
        <button
          onClick={exportCSV}
          className="px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-bg-base text-sm font-medium transition-colors shrink-0"
        >
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-brand-gold transition-colors"
        />
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg bg-bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-brand-gold transition-colors"
        >
          <option value="all">Todos os módulos</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-card border-b border-border">
                <th className="text-left px-4 py-3 text-text-muted font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Email</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium hidden md:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium hidden lg:table-cell">Módulo</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium hidden lg:table-cell">UTM</th>
                <th className="text-left px-4 py-3 text-text-muted font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-bg-card/50 transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{lead.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{lead.email}</td>
                    <td className="px-4 py-3 text-text-secondary hidden md:table-cell">{lead.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                      {lead.module_title ? (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold">
                          {lead.module_title}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs hidden lg:table-cell">
                      {lead.utm_source && <span className="block">{lead.utm_source}</span>}
                      {lead.utm_campaign && <span className="block text-text-muted/60">{lead.utm_campaign}</span>}
                      {!lead.utm_source && !lead.utm_campaign && '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
