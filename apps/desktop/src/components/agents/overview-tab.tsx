import type { AgentDetail } from '../../types/agent'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export function OverviewTab({ agent }: { agent: AgentDetail }) {
  return (
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="activity">Activity ({agent.activity.length})</TabsTrigger>
        <TabsTrigger value="checkins">Check-ins ({agent.checkins.length})</TabsTrigger>
        <TabsTrigger value="setup">Setup ({agent.setup_items.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <div className="bg-popover rounded-xl p-5">
          <div className="grid grid-cols-2 gap-6">
            <Field label="Full Name" value={agent.full_name} />
            <Field label="Agency" value={agent.agency} />
            <Field label="Upline Manager" value={agent.upline_manager} />
            <Field label="Experience" value={agent.experience_level?.replace('_', ' ')} />
            <Field label="License Status" value={agent.license_status} />
            <Field label="NPN" value={agent.npn} />
            <Field label="License Number" value={agent.license_number} />
            <Field label="Resident State" value={agent.resident_state} />
            <Field label="Verified At" value={agent.verified_at?.slice(0, 10)} />
            <Field
              label="Contracting"
              value={
                agent.contracting_completed
                  ? 'Completed'
                  : agent.contracting_booked
                    ? 'Booked'
                    : 'Not started'
              }
            />
            <Field label="Setup" value={agent.setup_completed ? 'Complete' : 'In progress'} />
            <Field label="Activated At" value={agent.activated_at?.slice(0, 10)} />
            {agent.production_written && (
              <Field label="Production" value={agent.production_written} />
            )}
            {agent.lead_source && (
              <Field label="Lead Source" value={agent.lead_source.replace('_', ' ')} />
            )}
            {agent.vision_goals && (
              <div className="col-span-2">
                <Field label="Vision / Goals" value={agent.vision_goals} />
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="activity">
        <div className="bg-popover rounded-xl p-5">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {agent.activity.length === 0 ? (
              <p className="text-muted-foreground">No activity recorded.</p>
            ) : (
              agent.activity.map((event, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div className="flex-1">
                    <span className="text-foreground font-medium text-sm">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    {event.details && (
                      <p className="text-muted-foreground text-sm">{event.details}</p>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {event.created_at?.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="checkins">
        <div className="bg-popover rounded-xl p-5">
          <div className="space-y-3">
            {agent.checkins.length === 0 ? (
              <p className="text-muted-foreground">No check-ins yet.</p>
            ) : (
              agent.checkins.map((ci, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div>
                    <span className="text-foreground text-sm">Week of {ci.week_start}</span>
                    {ci.response && (
                      <span
                        className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${
                          ci.response === 'on_track'
                            ? 'bg-green-900/50 text-green-400'
                            : ci.response === 'need_help'
                              ? 'bg-orange-900/50 text-orange-400'
                              : 'bg-blue-900/50 text-blue-400'
                        }`}
                      >
                        {ci.response.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {ci.responded_at
                      ? `Responded ${ci.responded_at.slice(0, 10)}`
                      : ci.sent_at
                        ? 'No response'
                        : 'Not sent'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="setup">
        <div className="bg-popover rounded-xl p-5">
          <div className="space-y-3">
            {agent.setup_items.length === 0 ? (
              <p className="text-muted-foreground">No setup items tracked.</p>
            ) : (
              agent.setup_items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        item.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-border'
                      }`}
                    >
                      {item.completed && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-foreground text-sm">
                      {item.item_key.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {item.completed_at?.slice(0, 10) || ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-foreground">{value || '\u2014'}</div>
    </div>
  )
}
