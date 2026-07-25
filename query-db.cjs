const { Surreal } = require('surrealdb');
async function run() {
  const db = new Surreal();
  await db.connect('wss://ux-ti-069ps2e29luilf8m9qq0o620g0.aws-euw1.surreal.cloud', {
    authentication: { username: 'admin', password: 'Moskwa-1Station' }
  });
  await db.use({ namespace: 'solidflow', database: 'main' });
  const dbs = await db.query('SELECT * FROM dashboard');
  console.log('--- DASHBOARDS ---');
  console.log(JSON.stringify(dbs[0], null, 2));
}
run().catch(console.error);
