import http from "http";

const req = http.get("http://localhost:5555", (res) => {
  console.log("Prisma Studio HTTP status:", res.statusCode);
  process.exit(0);
});

req.on("error", (err) => {
  console.error("Prisma Studio error:", err.message);
  process.exit(1);
});
