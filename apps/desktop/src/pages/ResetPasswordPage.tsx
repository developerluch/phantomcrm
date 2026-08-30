import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import {
  IconAlertTriangle,
  IconCircle,
  IconCircleCheck,
  IconEye,
  IconEyeOff,
  IconLock,
} from '@tabler/icons-react'
import { getApiBaseUrl } from '../services/config'
import { AuthBrandPanel } from './_AuthBrandPanel'
import { GlassInput } from './_GlassInput'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/\d/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div
      className={
        'flex items-center gap-2 text-xs ' +
        (met ? 'text-emerald-400' : 'text-muted-foreground')
      }
    >
      {met ? <IconCircleCheck size={14} /> : <IconCircle size={14} />}
      <span>{label}</span>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [invalidToken, setInvalidToken] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  })

  const newPwd = form.watch('newPassword')
  const confirmPwd = form.watch('confirmPassword')
  const checks = {
    length: newPwd.length >= 8,
    letter: /[A-Za-z]/.test(newPwd),
    number: /\d/.test(newPwd),
    match: newPwd.length > 0 && newPwd === confirmPwd,
  }

  useEffect(() => {
    if (!submitted) return
    const t = setTimeout(() => navigate('/login'), 2000)
    return () => clearTimeout(t)
  }, [submitted, navigate])

  async function onSubmit(values: FormValues) {
    if (!token) return
    setApiError(null)
    setInvalidToken(false)
    setLoading(true)
    try {
      const baseUrl = getApiBaseUrl()
      const res = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const message = body?.message ?? body?.error ?? `Reset failed (${res.status})`
        const isTokenError =
          res.status === 400 ||
          res.status === 401 ||
          res.status === 410 ||
          /token|expire|invalid/i.test(message)
        if (isTokenError) setInvalidToken(true)
        throw new Error(message)
      }
      setSubmitted(true)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Reset failed')
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
            <CardTitle className="text-xl text-foreground">Set a new password</CardTitle>
            <p className="text-xs text-muted-foreground">
              Choose a strong password you haven't used before.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!token ? (
              <>
                <Alert variant="destructive">
                  <IconAlertTriangle size={16} />
                  <AlertTitle>Invalid reset link</AlertTitle>
                  <AlertDescription className="text-xs">
                    This reset link is invalid or expired. Request a new one.
                  </AlertDescription>
                </Alert>
                <div className="text-center">
                  <Button variant="link" asChild className="px-0 text-xs">
                    <Link to="/forgot-password">Request a new reset link</Link>
                  </Button>
                </div>
              </>
            ) : submitted ? (
              <Alert className="border-emerald-500/30 bg-emerald-500/5 text-foreground">
                <IconCircleCheck size={18} className="text-emerald-400" />
                <AlertTitle className="text-emerald-300">Password updated</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Redirecting to sign in…
                </AlertDescription>
              </Alert>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">New password</FormLabel>
                        <FormControl>
                          <GlassInput
                            icon={IconLock}
                            type={showNew ? 'text' : 'password'}
                            autoComplete="new-password"
                            rightSlot={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={showNew ? 'Hide password' : 'Show password'}
                                onClick={() => setShowNew((v) => !v)}
                                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                              >
                                {showNew ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                              </Button>
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Confirm password</FormLabel>
                        <FormControl>
                          <GlassInput
                            icon={IconLock}
                            type={showConfirm ? 'text' : 'password'}
                            autoComplete="new-password"
                            rightSlot={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                onClick={() => setShowConfirm((v) => !v)}
                                className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                              >
                                {showConfirm ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                              </Button>
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-1 rounded-md border border-border/50 bg-card/40 p-3">
                    <Requirement met={checks.length} label="At least 8 characters" />
                    <Requirement met={checks.letter} label="Contains a letter" />
                    <Requirement met={checks.number} label="Contains a number" />
                    <Requirement met={checks.match} label="Passwords match" />
                  </div>

                  {apiError && (
                    <Alert variant="destructive">
                      <IconAlertTriangle size={16} />
                      <AlertDescription className="text-xs space-y-1">
                        <p>{apiError}</p>
                        {invalidToken && (
                          <Link
                            to="/forgot-password"
                            className="inline-block underline text-destructive"
                          >
                            Request a new reset link
                          </Link>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    variant="gradient"
                    className="w-full h-10 text-sm"
                    disabled={loading || !form.formState.isValid}
                  >
                    {loading ? 'Updating…' : 'Update password'}
                  </Button>
                </form>
              </Form>
            )}

            {!submitted && token && (
              <div className="text-center">
                <Button variant="link" asChild className="px-0 text-xs">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
