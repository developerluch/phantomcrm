import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  IconShieldCheck,
  IconFolderOpen,
  IconExternalLink,
  IconKey,
  IconLink,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

const QUICK_LINKS = [
  {
    title: 'PolicyHQ',
    description: 'Access carrier quoting and policy management',
    icon: IconShieldCheck,
    to: '/policy-hq',
    color: 'text-emerald-400',
  },
  {
    title: 'Document Vault',
    description: 'Store and manage documents, contracts, and templates',
    icon: IconFolderOpen,
    to: '/documents',
    color: 'text-blue-400',
  },
]

export default function MiscPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="text-xl font-semibold">Misc</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quick access to tools, resources, and external links
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => (
          <Card
            key={link.title}
            className="bg-card/50 backdrop-blur border-border/50 hover:border-border transition-colors cursor-pointer group"
            onClick={() => navigate(link.to)}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <link.icon size={20} className={link.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm group-hover:text-foreground transition-colors">
                  {link.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {link.description}
                </p>
              </div>
              <IconExternalLink size={14} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Saved Links</h2>
        <Card className="bg-card/50 backdrop-blur border-border/50 border-dashed">
          <CardContent className="p-6 text-center">
            <IconLink size={24} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Save frequently used eApp links, carrier portals, and login pages here
            </p>
            <Button variant="outline" size="sm" className="mt-3" disabled>
              Add Link (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Quick Logins</h2>
        <Card className="bg-card/50 backdrop-blur border-border/50 border-dashed">
          <CardContent className="p-6 text-center">
            <IconKey size={24} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Store quick-access login credentials for carrier portals and tools
            </p>
            <Button variant="outline" size="sm" className="mt-3" disabled>
              Add Login (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
