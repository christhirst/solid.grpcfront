function GET(event) {
  return new Response(JSON.stringify({
    status: "ok"
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
export {
  GET
};
//# sourceMappingURL=health-DlRq_6NL.js.map
