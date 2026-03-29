import { getDb } from "~/lib/db";
import { APIEvent } from "@solidjs/start/server";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();

    // Perform a simple query to verify the connection is alive
    const result = await db.query("RETURN time::now();");

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Successfully connected to SurrealDB",
        time: result[0],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Failed to connect to SurrealDB",
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
