const { Surreal } = require('surrealdb');
async function run() {
  const db = new Surreal();
  await db.connect('wss://ux-ti-06g5t3b4ldol77m9fqh7a91jv8.azure-gwc.surreal.cloud', {
    //
    authentication: { username: 'solid', password: 'sol1d' }
  });
  await db.use({ namespace: 'solidflow', database: 'main' });
  const dbs = await db.query('SELECT * FROM dashboard');
  console.log('--- DASHBOARDS ---');
  console.log(JSON.stringify(dbs[0], null, 2));
}
run().catch(console.error);
