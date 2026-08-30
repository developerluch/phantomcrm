FROM golang:1.24.1-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /phantomcrm-api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S phantomcrm \
    && adduser -S -G phantomcrm phantomcrm
COPY --from=builder --chown=phantomcrm:phantomcrm /phantomcrm-api /phantomcrm-api
USER phantomcrm
ENTRYPOINT ["/phantomcrm-api"]
