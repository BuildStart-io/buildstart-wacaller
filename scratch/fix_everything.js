const { Client } = require('ssh2');

const dockerCompose = `
services:
  wacaller:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: wacaller-api
    restart: always
    ports:
      - "127.0.0.1:8080:8080"
      - "127.0.0.1:8090:8080"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgres://postgres:83e92d24de107ec7ad36e5b47f82fc9d@supabase-db:5432/postgres?search_path=whatsapp_infra&sslmode=disable
    networks:
      - default
      - supabase_default
    dns:
      - 1.1.1.1
      - 8.8.8.8
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

networks:
  supabase_default:
    external: true
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`
    systemctl stop buildstart-calling-agent.service && 
    systemctl disable buildstart-calling-agent.service && 
    cat > /opt/wacaller/docker-compose.yml && 
    cd /opt/wacaller && 
    docker compose up -d && 
    sed -i 's/wacaller.buildstart.io/buildstart-calling-agent.buildstart.io/' /root/supabase/supabase/docker/.env && 
    cd /root/supabase/supabase/docker && 
    docker compose restart edge-runtime
  `, (err, stream) => {
    if (err) throw err;
    stream.write(dockerCompose);
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
