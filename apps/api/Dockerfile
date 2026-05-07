FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# bust cache: v6 - CORS/rate-limit fix, public apply endpoint, pipeline automation, finance
RUN CGO_ENABLED=0 GOOS=linux go build -o /phantomcrm-api ./cmd/api

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /phantomcrm-api /phantomcrm-api
ENTRYPOINT ["/phantomcrm-api"]
