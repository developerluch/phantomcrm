import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { IconAlertTriangle, IconCircleCheck, IconMail } from '@tabler/icons-react'
import { getApiBaseUrl } from '../services/config'
import { AuthBrandPanel } from './_AuthBrandPanel'
import { GlassInput } from './_GlassInput'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: FormValues) {
    setNetworkError(null)
    setLoading(true)
    try {
      const baseUrl = getApiBaseUrl()
      const res = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email.trim() }),
      })
      if (!res.ok && res.status >= 500) {
        throw new Error('We could not reach the server. Please try again.')
      }
      setSubmitted(true)
    } catch (err: unknown) {
      setNetworkError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AuthBrandPanel />

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-1 lg:w-1/2 items-center justify-center p-6 lg:p-12"
      >
        <Card className="w-full max-w-[360px] bg-card/60 backdrop-blur-xl border-border/60 shadow-2xl">
          <CardHeader className="space-y-2 pb-4">
            <CardTitle className="text-xl text-foreground">Reset your password</CardTitle>
            <p className="text-xs text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitted ? (
              <Alert className="border-emerald-500/30 bg-emerald-500/5 text-foreground">
                <IconCircleCheck size={18} className="text-emerald-400" />
                <AlertTitle className="text-emerald-300">Check your email</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  If an account exists for that address, we've sent a reset link. It
                  expires in 1 hour.
                </AlertDescription>
              </Alert>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email address</FormLabel>
                        <FormControl>
                          <GlassInput
                            icon={IconMail}
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {networkError && (
                    <Alert variant="destructive">
                      <IconAlertTriangle size={16} />
                      <AlertDescription className="text-xs">{networkError}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full h-10 text-sm"
                    disabled={loading}
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              </Form>
            )}

            <div className="text-center">
              <Button variant="link" asChild className="px-0 text-xs">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
