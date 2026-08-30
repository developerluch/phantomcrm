import { useLocation, useNavigate } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PolicyPageSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeValue =
    location.pathname === '/policy-hq/book'
      ? 'book'
      : location.pathname === '/expenses'
        ? 'finance'
        : 'dashboard'

  return (
    <Tabs
      value={activeValue}
      onValueChange={(value) => {
        if (value === 'book') navigate('/policy-hq/book')
        else if (value === 'finance') navigate('/expenses')
        else navigate('/policy-hq')
      }}
    >
      <TabsList className="bg-card/50 backdrop-blur border border-border/50">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="book">Book of Business</TabsTrigger>
        <TabsTrigger value="finance">Lead Spend & Finances</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
