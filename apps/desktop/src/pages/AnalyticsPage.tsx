import { useConversionAnalytics, useSourceAnalytics, useTrendsAnalytics, useStageDurationAnalytics } from '../hooks/useAnalytics'
import { api } from '../services/api'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, Cell,
  PieChart, Pie,
  Area, AreaChart,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconDownload, IconChartPie } from '@tabler/icons-react'

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

const conversionChartConfig = {
  count: { label: "Count", color: "#3b82f6" },
} satisfies ChartConfig

const sourceChartConfig = {
  count: { label: "Count", color: "#3b82f6" },
} satisfies ChartConfig

const trendsChartConfig = {
  count: { label: "New Agents", color: "#3b82f6" },
} satisfies ChartConfig

const stageDurationChartConfig = {
  avgDays: { label: "Avg Days", color: "#8b5cf6" },
} satisfies ChartConfig

export default function AnalyticsPage() {
  const { data: conversion = [], isLoading: loadingConv } = useConversionAnalytics()
  const { data: sources = [], isLoading: loadingSrc } = useSourceAnalytics()
  const { data: trends = [], isLoading: loadingTrend } = useTrendsAnalytics()
  const { data: stageDuration = [], isLoading: loadingDur } = useStageDurationAnalytics()

  const handleExport = async () => {
    try {
      const blob = await api.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phantom-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch {
      toast.error('Failed to export CSV')
    }
  }

  const isLoading = loadingConv || loadingSrc || loadingTrend || loadingDur

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Pipeline conversion, sources, and trends</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <IconDownload size={16} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversion Funnel</CardTitle>
            <CardDescription>Stage progression with conversion %</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={conversionChartConfig} className="h-[230px] w-full">
              <BarChart data={conversion}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {conversion.map((entry, i) => (
                    <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Source Breakdown</CardTitle>
            <CardDescription>Where recruits come from</CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length > 0 ? (
              <ChartContainer config={sourceChartConfig} className="h-[230px] w-full">
                <PieChart>
                  <Pie
                    data={sources}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ source, count }) => `${source}: ${count}`}
                    labelLine={false}
                  >
                    {sources.map((_entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="source" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[230px] text-muted-foreground">
                <div className="text-center">
                  <IconChartPie size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No source data</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Weekly Trends</CardTitle>
            <CardDescription>New agents over time (6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendsChartConfig} className="h-[230px] w-full">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="count" stroke="var(--color-count)" fill="url(#trendGradient)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Stage Duration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Avg Stage Duration</CardTitle>
            <CardDescription>Average days spent in each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageDurationChartConfig} className="h-[230px] w-full">
              <BarChart data={stageDuration} layout="vertical">
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                  {stageDuration.map((entry, i) => (
                    <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
