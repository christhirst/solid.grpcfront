const { Surreal } = require('surrealdb');
async function run() {
  const db = new Surreal();
  await db.connect('http://127.0.0.1:8000', {
    authentication: { username: 'root', password: 'root' }
  });
  await db.use({ namespace: 'test', database: 'test' });
  const dbs = await db.query('SELECT * FROM dashboard');
  console.log('--- DASHBOARDS ---');
  console.log(JSON.stringify(dbs[0], null, 2));
}
run().catch(console.error);
