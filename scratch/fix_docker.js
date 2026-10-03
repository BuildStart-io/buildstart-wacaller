const { Client } = require('ssh2');

const dockerfile = `
# Multi-stage build for WacallerAPI
FROM golang:alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build standalone binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o server ./cmd/server

# Production image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server /app/server

# Create directory for SQLite database and persistent data (if needed by WhatsApp)
RUN mkdir -p /app/data

EXPOSE 8080

VOLUME ["/app/data"]

ENTRYPOINT ["/app/server"]
CMD ["-addr", ":8080"]
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cat > /opt/wacaller/Dockerfile && sed -i 's/8090:8090/8080:8080/' /opt/wacaller/docker-compose.yml && cd /opt/wacaller && docker compose up -d --build`, (err, stream) => {
    if (err) throw err;
    stream.write(dockerfile);
    stream.end();
    
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT: ' + out);
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '178.104.127.220',
  port: 22,
  username: 'root',
  password: 'JXRMVeRM7Wcq'
});
