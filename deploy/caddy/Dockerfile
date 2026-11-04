# Caddy amb el mòdul de DuckDNS: el router no redirigeix els ports 80 i 443,
# i per això el certificat s'ha de demanar per DNS.
FROM caddy:2.11-builder-alpine AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns@v0.5.0

FROM caddy:2.11-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
