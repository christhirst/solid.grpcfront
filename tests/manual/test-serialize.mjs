import { StringRecordId } from "surrealdb";
const id = new StringRecordId("workflow", "12345");
console.log(JSON.stringify({ id, name: "test" }));
