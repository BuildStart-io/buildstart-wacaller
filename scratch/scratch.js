const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:2jAm38abeNBLA27HbGeP@178.104.127.220:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    await client.query('ALTER TABLE wacaller_customization.products ADD COLUMN IF NOT EXISTS add_to_calling_agent BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE wacaller_customization.faqs ADD COLUMN IF NOT EXISTS add_to_calling_agent BOOLEAN DEFAULT true;');
    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
