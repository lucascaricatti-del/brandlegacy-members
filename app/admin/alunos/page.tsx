import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentActions from './StudentActions'
import type { AdminManagedRole } from '@/lib/types/database'

export default async function AlunosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: students } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const all = students ?? []
  const alunos = all.filter((s) => s.role === 'student')
  const admins = all.filter((s) => s.role === 'admin')

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Alunos</h1>
        <p className="text-text-secondary mt-1">
          {alunos.length} {alunos.length === 1 ? 'aluno' : 'alunos'} · {admins.length} {admins.length === 1 ? 'admin' : 'admins'}
        </p>
      </div>

      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        {all.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">
            Nenhum aluno cadastrado ainda.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Aluno</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Email</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Perfil</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Status</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3 uppercase tracking-wider">Entrada</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {all.map((student) => (
                <tr key={student.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                        <span className="text-brand-gold text-xs font-semibold">
                          {student.name[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-text-primary text-sm">{student.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-secondary">{student.email}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${student.role === 'admin' ? 'bg-brand-gold/15 text-brand-gold' : 'bg-bg-surface text-text-muted'}`}>
                      {student.role === 'admin' ? 'Admin' : 'Aluno'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${student.is_active ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                      {student.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-muted">
                    {new Date(student.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-4">
                    <StudentActions
                      studentId={student.id}
                      isActive={student.is_active}
                      role={student.role as AdminManagedRole}
                      currentUserId={user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
