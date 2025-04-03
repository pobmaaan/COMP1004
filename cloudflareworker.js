export default {
    async fetch(request, env) {
      const url = new URL(request.url);
  
      // Handle storing events in KV
      if (request.method === "PUT" && url.pathname === "/api/store-events") {
        try {
          const jsonData = await request.json();
          await env.userDeadlines.put("deadlines.json", JSON.stringify(jsonData));
          return new Response("Events saved successfully!", {
            status: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "PUT, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            }
          });
        } catch (error) {
          return new Response(`Error storing events: ${error.message}`, {
            status: 500
          });
        }
      }
  
      // Handle retrieving events from KV
      if (request.method === "GET" && url.pathname === "/api/get-events") {
        try {
          const data = await env.userDeadlines.get("deadlines.json");
          return new Response(data || "{}", {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          return new Response(`Error fetching events: ${error.message}`, {
            status: 500
          });
        }
      }
  
      // Handle CORS Preflight Request (OPTIONS)
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }
  
      // Fallback for invalid requests
      return new Response("Invalid request", { status: 400 });
    }
  };
  