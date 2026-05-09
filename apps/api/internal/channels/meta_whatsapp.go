package channels

import (
	"context"
	"fmt"
)

// MetaWhatsAppSender is a stub for the Meta Business WhatsApp provider.
// It registers the (whatsapp, meta) tuple so the registry can advertise
// the provider, but every operation returns ErrUnsupported until Meta
// Business verification lands (post-M2A).
type MetaWhatsAppSender struct{}

func NewMetaWhatsAppSender() *MetaWhatsAppSender { return &MetaWhatsAppSender{} }

func (s *MetaWhatsAppSender) Name() Channel    { return ChannelWhatsApp }
func (s *MetaWhatsAppSender) Provider() string { return "meta" }

func (s *MetaWhatsAppSender) CanSend(_ context.Context, _ Recipient) error {
	return fmt.Errorf("%w: meta whatsapp pending business verification", ErrUnsupported)
}

func (s *MetaWhatsAppSender) Send(_ context.Context, _ SendRequest) (SendReceipt, error) {
	return SendReceipt{}, fmt.Errorf("%w: meta whatsapp pending business verification", ErrUnsupported)
}
