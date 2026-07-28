# Build stage
# Pinned to the Go version this project targets. Alpine keeps the toolchain small.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Copy the module file first so `go mod download` is cached independently of
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source and build a static, stripped binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

# Runtime stage
# Alpine (not distroless) so we get a shell + busybox wget for the healthcheck
# and easy debugging. We can harden to distroless later.
FROM alpine:3.21
WORKDIR /app
COPY --from=build /out/server /app/server

# Documentation only; the real port comes from the PORT env (set by compose).
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/app/server"]
