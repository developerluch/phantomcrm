import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { LEAD_PROGRAMS_BACKEND_ENABLED, useLeadProgramProfitability } from '../../hooks/useLeadPrograms'
import type { LeadProgramProfitability } from '../../types/portal'

interface Props {
  agents: { agentId: string; displayName: string }[]
}

function fmt$(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function persistencyColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-400'
  if (rate >= 0.8) return 'text-yellow-400'
  return 'text-red-400'
}

function plColor(value: number): string {
  return value >= 0 ? 'text-green-400' : 'text-red-400'
}

export default function AgentSalesView({ agents }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<string>('_all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: profitability, isLoading } = useLeadProgramProfitability({
    agentId: selectedAgent === '_all' ? undefined : selectedAgent,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  if (!LEAD_PROGRAMS_BACKEND_ENABLED) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Agent Profitability by Lead Program</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Lead program profitability is not available yet in the production backend.
          </div>
        </CardContent>
      </Card>
    )
  }

  const rows = profitability ?? []

  // Calculate totals
  const totals: Omit<LeadProgramProfitability, 'programId' | 'programName' | 'agentId'> = {
    totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
    totalLeads: rows.reduce((s, r) => s + r.totalLeads, 0),
    cpa: 0,
    closeRate: 0,
    submittedAP: rows.reduce((s, r) => s + r.submittedAP, 0),
    approvedAP: rows.reduce((s, r) => s + r.approvedAP, 0),
    issuedAP: rows.reduce((s, r) => s + r.issuedAP, 0),
    netCommPaid: rows.reduce((s, r) => s + r.netCommPaid, 0),
    netPL: rows.reduce((s, r) => s + r.netPL, 0),
    policiesSubmitted: rows.reduce((s, r) => s + r.policiesSubmitted, 0),
    policiesApproved: rows.reduce((s, r) => s + r.policiesApproved, 0),
    policiesIssued: rows.reduce((s, r) => s + r.policiesIssued, 0),
    stillOnBooks: rows.reduce((s, r) => s + r.stillOnBooks, 0),
    persistencyRate: 0,
  }
  totals.cpa = totals.totalLeads > 0 ? totals.totalSpend / totals.totalLeads : 0
  totals.closeRate = totals.totalLeads > 0 ? totals.policiesApproved / totals.totalLeads : 0
  totals.persistencyRate = totals.policiesIssued > 0 ? totals.stillOnBooks / totals.policiesIssued : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm font-semibold">Agent Profitability by Lead Program</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All agents (org-wide)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All agents (org-wide)</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.agentId} value={a.agentId}>{a.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36"
              placeholder="To"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 bg-muted/30 rounded animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Program</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Spend</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leads</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">CPA</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Close %</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sub AP</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appr AP</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Iss AP</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net Comm</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net P&L</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sub</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Appr</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Iss</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">On Books</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Persist %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.programId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-foreground font-medium">{row.programName}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(row.totalSpend)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-blue-400 tabular-nums">{fmt$(row.cpa)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtPct(row.closeRate)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmt$(row.submittedAP)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmt$(row.approvedAP)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmt$(row.issuedAP)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(row.netCommPaid)}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${plColor(row.netPL)}`}>{fmt$(row.netPL)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.policiesSubmitted}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.policiesApproved}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.policiesIssued}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{row.stillOnBooks}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${persistencyColor(row.persistencyRate)}`}>{fmtPct(row.persistencyRate)}</td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="border-t-2 border-border font-bold">
                    <td className="px-3 py-2 text-foreground">TOTALS</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(totals.totalSpend)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{totals.totalLeads}</td>
                    <td className="px-3 py-2 text-right text-blue-400 tabular-nums">{fmt$(totals.cpa)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmtPct(totals.closeRate)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(totals.submittedAP)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(totals.approvedAP)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(totals.issuedAP)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{fmt$(totals.netCommPaid)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${plColor(totals.netPL)}`}>{fmt$(totals.netPL)}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{totals.policiesSubmitted}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{totals.policiesApproved}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{totals.policiesIssued}</td>
                    <td className="px-3 py-2 text-right text-foreground tabular-nums">{totals.stillOnBooks}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${persistencyColor(totals.persistencyRate)}`}>{fmtPct(totals.persistencyRate)}</td>
                  </tr>
                )}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-3 py-12 text-center text-muted-foreground">
                      No profitability data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
