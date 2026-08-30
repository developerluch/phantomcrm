import { motion, useReducedMotion } from 'framer-motion'
import {
  IconShieldLock,
  IconLoader2,
  IconExternalLink,
} from '@tabler/icons-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useStartNiprVerification } from '../hooks/useNiprVerification'
import { useAuthStore } from '../store'
import { clearTokens as vaultClearTokens } from '../services/tokenVault'

export default function VerifyNpnPage() {
  const reduce = useReducedMotion()
  const start = useStartNiprVerification()

  const entry = reduce
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: 'easeOut' as const },
      }

  async function handleSignOut() {
    useAuthStore.getState().clearAuth()
    await vaultClearTokens()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-6 py-12">
      <motion.div {...entry} className="w-full max-w-md">
        <Card className="bg-card/50 backdrop-blur border-border/60 shadow-2xl shadow-black/40 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DEFF9A]/60 to-transparent"
          />
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#DEFF9A]/10 border border-[#DEFF9A]/30 mx-auto">
              <IconShieldLock size={22} className="text-[#DEFF9A]" />
            </div>
            <CardTitle className="text-center text-xl">
              Verify your insurance license
            </CardTitle>
            <CardDescription className="text-center leading-relaxed">
              Phantom requires every agent to identify themselves against the
              National Insurance Producer Registry (NIPR) before accessing the
              app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Clicking below opens an isolated NIPR window. Phantom never
              receives or stores your SSN — only your NPN and canonical name.
            </p>

            {start.isError && (
              <Alert variant="destructive">
                <AlertTitle>Verification failed</AlertTitle>
                <AlertDescription>
                  {start.error instanceof Error
                    ? start.error.message
                    : 'Something went wrong. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={start.isPending}
              onClick={() => start.mutate()}
            >
              {start.isPending ? (
                <>
                  <IconLoader2 size={18} className="mr-2 animate-spin" />
                  Opening NIPR…
                </>
              ) : (
                <>
                  <IconExternalLink size={18} className="mr-2" />
                  Verify with NIPR
                </>
              )}
            </Button>

            <Separator className="bg-border/60" />

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Don't have an NPN yet?
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
