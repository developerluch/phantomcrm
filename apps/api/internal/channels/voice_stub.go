package channels

import (
	"context"
	"fmt"
)

// VoiceStubSender is a placeholder for the voice channel; the real
// implementation lands in M2C alongside the dialer integration. Until then
// it returns ErrUnsupported so the registry can surface the channel as
// known-but-not-yet-callable.
type VoiceStubSender struct {
	provider string
}

// NewVoiceStubSender returns a stub for the given provider name (e.g.
// "wavv", "twilio"). The provider value is only used for registry keys.
func NewVoiceStubSender(provider string) *VoiceStubSender {
	if provider == "" {
		provider = "stub"
	}
	return &VoiceStubSender{provider: provider}
}

func (s *VoiceStubSender) Name() Channel    { return ChannelVoice }
func (s *VoiceStubSender) Provider() string { return s.provider }

func (s *VoiceStubSender) CanSend(_ context.Context, _ Recipient) error {
	return fmt.Errorf("%w: voice channel ships in M2C", ErrUnsupported)
}

func (s *VoiceStubSender) Send(_ context.Context, _ SendRequest) (SendReceipt, error) {
	return SendReceipt{}, fmt.Errorf("%w: voice channel ships in M2C", ErrUnsupported)
}
