if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "FATAL: DATABASE_URL is missing. On Render: Environment → add DATABASE_URL from Postgres → Connect → Internal Database URL, then redeploy.",
  );
  process.exit(1);
}
