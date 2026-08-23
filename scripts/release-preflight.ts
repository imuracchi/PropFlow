import mysql from "mysql2/promise";

const requiredEnv = ["DATABASE_URL", "JWT_SECRET", "SITE_URL"] as const;
const missing = requiredEnv.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`必須環境変数が不足しています: ${missing.join(", ")}`);
}

const siteUrl = new URL(process.env.SITE_URL!);
if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
  throw new Error("SITE_URL は本番では https:// を指定してください");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  const [databaseRows] = await connection.query<Array<{ databaseName: string }>>("SELECT DATABASE() AS databaseName");
  const databaseName = databaseRows[0]?.databaseName;
  if (!databaseName) throw new Error("接続先DB名を取得できません");

  const requiredColumns = [
    ["properties", "published"],
    ["properties", "publishedAt"],
    ["properties", "ownerDeletedAt"],
    ["properties", "dealPrice"],
    ["properties", "visibilityScope"],
    ["properties", "proposalTargetUserId"],
    ["properties", "proposalRequestId"],
    ["property_files", "visible"],
    ["property_files", "category"],
    ["dm_read_status", "flagged"],
    ["users", "businessCardBase64"],
    ["users", "notifyPropertySearch"],
    ["property_search_requests", "publishedAt"],
    ["property_search_requests", "adminHidden"],
    ["property_search_proposals", "viewedAt"],
  ] as const;
  const [columnRows] = await connection.query<Array<{ tableName: string; columnName: string }>>(
    "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?",
    [databaseName],
  );
  const columns = new Set(columnRows.map(row => `${row.tableName}.${row.columnName}`));
  const missingColumns = requiredColumns.filter(([table, column]) => !columns.has(`${table}.${column}`));
  if (missingColumns.length) {
    throw new Error(`DB移行が未完了です: ${missingColumns.map(parts => parts.join(".")).join(", ")}`);
  }

  const requiredTables = [
    "property_exclusions",
    "generated_documents",
    "property_reads",
    "property_name_snapshots",
    "search_logs",
    "broadcast_logs",
    "broadcast_schedules",
    "property_search_requests",
    "property_search_proposals",
    "property_search_digest_deliveries",
    "dm_notification_batches",
  ];
  const [tableRows] = await connection.query<Array<{ tableName: string }>>(
    "SELECT TABLE_NAME AS tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [databaseName],
  );
  const tables = new Set(tableRows.map(row => row.tableName));
  const missingTables = requiredTables.filter(table => !tables.has(table));
  if (missingTables.length) throw new Error(`必要なテーブルがありません: ${missingTables.join(", ")}`);

  await connection.query("SELECT id FROM users LIMIT 1");
  await connection.query("SELECT id FROM properties LIMIT 1");
  console.log(`PASS: database connection (${databaseName})`);
  console.log("PASS: required tables and columns");
  console.log(`PASS: SITE_URL (${siteUrl.origin})`);
  console.log("Production preflight completed successfully.");
} finally {
  await connection.end();
}
