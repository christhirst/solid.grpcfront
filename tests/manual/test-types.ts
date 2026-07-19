import { Surreal, StringRecordId } from "surrealdb";
const db = new Surreal();
const id = new StringRecordId("tb", "id");
async function test() {
  await db.create(id, {});
  await db.merge(id, {});
  await db.delete(id);
  await db.select(id);
}
