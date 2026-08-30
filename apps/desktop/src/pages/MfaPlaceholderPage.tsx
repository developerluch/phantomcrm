import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconShieldLock } from '@tabler/icons-react'
import { AuthBrandPanel } from './_AuthBrandPanel'

export default function MfaPlaceholderPage() {
  return (
    <div className="flex min-h-screen bg-black text-zinc-100">
      <AuthBrandPanel />

      <div className="flex flex-1 md:w-1/2 items-center justify-center p-6 md:p-12">
        <Card className="max-w-sm w-full bg-card/60 backdrop-blur-xl border-border/60">
          <CardHeader className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-[#7DD3FC]/15 flex items-center justify-center text-[#7DD3FC]">
              <IconShieldLock size={20} />
            </div>
            <CardTitle className="text-lg">Two-factor required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-400">
            <p>
              This account requires two-factor authentication. The TOTP entry
              screen is coming soon.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
