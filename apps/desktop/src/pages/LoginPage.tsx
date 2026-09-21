import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  getApiBaseUrl,
  getDiscordRedirectUri,
  getDiscordClientId,
  getGoogleClientId,
  getGoogleRedirectUri,
} from '../services/config'
import {
  IconBrandDiscord,
  IconBrandGoogle,
  IconLoader2,
} from '@tabler/icons-react'
import { AuthBrandPanel } from './_AuthBrandPanel'
import { useApiHealth, useSplashGone } from '@/components/SplashGate'
import {
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
} from '../services/tokenVault'

const loginSchema = z.object({
  email: z.string().min(1, { message: 'Enter your email' }).email({ message: 'Enter a valid email' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
})
type LoginValues = z.infer<typeof loginSchema>

function buildDiscordOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getDiscordClientId(),
    redirect_uri: getDiscordRedirectUri(),
    response_type: 'code',
    scope: 'identify email',
  })
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

function buildGoogleOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [awaitingDiscord, setAwaitingDiscord] = useState(false)
  // Discord sign-in is optional: hide the button when no client id is configured.
  const discordEnabled = Boolean(getDiscordClientId())
  const [awaitingGoogle, setAwaitingGoogle] = useState(false)
  const reduce = useReducedMotion()
  // splashGone flips true the moment the splash finishes its exit
  // animation (or 1s after API readiness as a safety net). Form elements
  // gate their entrance on this signal instead of hardcoded wall-clock
  // delays — the form is therefore guaranteed to be interactive
  // immediately when there is no splash and to land cleanly when there
  // is one. The `step` arg is a small relative offset (0, 1, 2, ...)
  // that produces a 60ms-per-step inner stagger without coupling to
  // splash timing.
  const splashGone = useSplashGone()
  // True when the splash hit MAX_DURATION (5s) without the API responding.
  // Surfaced via banner above the form so the user has a heads-up before
  // their first sign-in attempt fails on a network error.
  const { apiUnreachable } = useApiHealth()
  const stagger = (step: number) =>
    reduce
      ? {
          initial: { opacity: 1, y: 0 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0 },
        }
      : {
          initial: { opacity: 0, y: 6 },
          animate: splashGone ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 },
          transition: {
            duration: 0.45,
            delay: splashGone ? step * 0.06 : 0,
            ease: 'easeOut' as const,
          },
        }

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    try {
      const baseUrl = getApiBaseUrl()
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (res.status === 401) {
        form.setError('password', { message: 'Invalid email or password' })
        return
      }
      if (res.status === 412) {
        navigate('/auth/mfa')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        form.setError('root', {
          message: body?.message ?? body?.error ?? `Sign-in failed (${res.status})`,
        })
        return
      }

      const data = await res.json()
      const { user, accessToken, refreshToken } = data
      await vaultSetAccessToken(accessToken)
      await vaultSetRefreshToken(refreshToken)
      setAuth(user, accessToken, refreshToken)
      navigate('/')
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Sign-in failed',
      })
    }
  }

  async function handleDiscordLogin() {
    const url = buildDiscordOAuthUrl()
    if (window.electronAPI?.discordOAuth) {
      setAwaitingDiscord(true)
      try {
        await window.electronAPI.discordOAuth(url)
      } finally {
        setAwaitingDiscord(false)
      }
    } else {
      window.location.href = url
    }
  }

  async function handleGoogleLogin() {
    const googleClientId = getGoogleClientId()
    if (!googleClientId) {
      form.setError('root', {
        message: 'Google sign-in is missing its client ID. Set VITE_GOOGLE_CLIENT_ID and restart Phantom.',
      })
      return
    }

    const url = buildGoogleOAuthUrl()
    setAwaitingGoogle(true)
    form.clearErrors('root')
    try {
      if (window.electronAPI?.googleOAuth) {
        const code = await window.electronAPI.googleOAuth(url)
        if (!code) {
          form.setError('root', { message: 'Google sign-in was cancelled.' })
        }
      } else {
        window.location.href = url
      }
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Failed to start Google sign-in',
      })
    } finally {
      setAwaitingGoogle(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-black text-zinc-100">
      <AuthBrandPanel />

      <div className="flex flex-1 md:w-1/2 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm space-y-6">
          {apiUnreachable && (
            <motion.div
              {...stagger(0)}
              role="status"
              className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300/90"
            >
              We're having trouble reaching the server. Sign-in may not work
              right away.
            </motion.div>
          )}

          <div className="space-y-1">
            <motion.h2
              {...stagger(0)}
              className="text-xl font-semibold text-zinc-100"
            >
              Sign in to Phantom
            </motion.h2>
            <motion.p {...stagger(1)} className="text-xs text-zinc-500">
              Welcome back. Sign in to your workspace.
            </motion.p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <motion.div {...stagger(2)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          className="focus-visible:ring-white/30 motion-safe:placeholder:transition-transform motion-safe:placeholder:duration-200 motion-safe:focus:placeholder:-translate-y-0.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div {...stagger(3)}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="focus-visible:ring-white/30 motion-safe:placeholder:transition-transform motion-safe:placeholder:duration-200 motion-safe:focus:placeholder:-translate-y-0.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </motion.div>

              <motion.div {...stagger(4)} className="flex justify-end -mt-1">
                <Button variant="link" asChild className="px-0 text-xs h-auto">
                  <Link to="/forgot-password">Forgot password?</Link>
                </Button>
              </motion.div>

              {form.formState.errors.root && (
                <p className="text-xs text-red-400">
                  {form.formState.errors.root.message}
                </p>
              )}

              <motion.div {...stagger(5)}>
                <Button
                  type="submit"
                  className="relative overflow-hidden w-full h-10 text-sm bg-white text-black hover:bg-zinc-200 transition-colors before:pointer-events-none before:absolute before:inset-y-0 before:-left-full before:w-full before:bg-gradient-to-r before:from-transparent before:via-black/10 before:to-transparent before:transition-transform before:duration-[1200ms] before:ease-out hover:before:translate-x-[200%] motion-reduce:before:hidden"
                  disabled={form.formState.isSubmitting}
                >
                  <span className="relative z-10">
                    {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
                  </span>
                </Button>
              </motion.div>
            </form>
          </Form>

          <motion.div {...stagger(6)} className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-medium">
              or continue with
            </span>
            <Separator className="flex-1" />
          </motion.div>

          <motion.div {...stagger(7)} className={discordEnabled ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-1 gap-2.5'}>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 text-xs bg-card/40 hover:bg-card/70 border-border/60"
              onClick={handleGoogleLogin}
              disabled={awaitingGoogle}
            >
              {awaitingGoogle ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconBrandGoogle size={16} />
              )}
              Google
            </Button>
            {discordEnabled && (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 text-xs bg-card/40 hover:bg-card/70 border-border/60"
                onClick={handleDiscordLogin}
                disabled={awaitingDiscord}
              >
                {awaitingDiscord ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconBrandDiscord size={16} />
                )}
                Discord
              </Button>
            )}
          </motion.div>

          <motion.p
            {...stagger(8)}
            className="text-center text-xs text-zinc-500"
          >
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-zinc-100 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              Register
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  )
}
