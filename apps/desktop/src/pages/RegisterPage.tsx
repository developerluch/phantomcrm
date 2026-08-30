import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type RegisterFormData } from '../lib/schemas'
import { useAuthStore } from '../store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getApiBaseUrl } from '../services/config'
import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconUser,
} from '@tabler/icons-react'
import { AuthBrandPanel } from './_AuthBrandPanel'
import { GlassInput } from './_GlassInput'
import {
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
} from '../services/tokenVault'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  })

  async function onValid(data: RegisterFormData) {
    setServerError(null)
    setLoading(true)

    try {
      const baseUrl = getApiBaseUrl()
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: data.displayName.trim(),
          email: data.email.trim(),
          password: data.password,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? body?.error ?? `Registration failed (${res.status})`)
      }

      const result = await res.json()
      const { user, accessToken, refreshToken } = result

      await vaultSetAccessToken(accessToken)
      await vaultSetRefreshToken(refreshToken)

      setAuth(user, accessToken, refreshToken)
      navigate('/')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Registration failed')
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
            <CardTitle className="text-xl text-foreground">Create your account</CardTitle>
            <p className="text-xs text-muted-foreground">Get started with Phantom</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(onValid)} className="space-y-3">
              <div>
                <GlassInput
                  icon={IconUser}
                  type="text"
                  placeholder="Display name"
                  autoComplete="name"
                  {...register('displayName')}
                />
                {errors.displayName && (
                  <p className="text-xs text-red-400 mt-1">{errors.displayName.message}</p>
                )}
              </div>
              <div>
                <GlassInput
                  icon={IconMail}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <GlassInput
                  icon={IconLock}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="new-password"
                  rightSlot={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </Button>
                  }
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
                )}
              </div>
              <div>
                <GlassInput
                  icon={IconLock}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  rightSlot={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </Button>
                  }
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && <p className="text-xs text-red-400">{serverError}</p>}

              <Button
                type="submit"
                variant="gradient"
                className="w-full h-10 text-sm"
                disabled={loading || !isValid}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
