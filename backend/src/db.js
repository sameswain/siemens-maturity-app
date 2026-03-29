import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { seedDatabase } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = process.env.DB_PATH || join(__dirname, "../maturity.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    weight REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sub_dimensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    theme_id INTEGER NOT NULL REFERENCES themes(id),
    name TEXT NOT NULL,
    description TEXT,
    weight REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sub_dimension_id INTEGER NOT NULL REFERENCES sub_dimensions(id),
    text TEXT NOT NULL,
    ord INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS engagements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    consultant_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engagement_id INTEGER NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id),
    current_score REAL,
    target_score REAL,
    notes TEXT,
    UNIQUE(engagement_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    product TEXT NOT NULL,
    vendor TEXT,
    user_tier INTEGER,
    annual_cost_usd REAL,
    cloud_available TEXT NOT NULL DEFAULT 'unknown',
    cloud_product_name TEXT,
    migration_complexity TEXT DEFAULT 'medium',
    migration_path TEXT DEFAULT 'migrate',
    migration_notes TEXT,
    phase INTEGER DEFAULT 2,
    is_critical INTEGER DEFAULT 0,
    agentic_opportunity TEXT,
    ord INTEGER
  );

  CREATE TABLE IF NOT EXISTS app_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engagement_id INTEGER NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    application_id INTEGER NOT NULL REFERENCES applications(id),
    business_criticality TEXT DEFAULT 'medium',
    current_usage_score INTEGER DEFAULT 3,
    cloud_readiness_score INTEGER DEFAULT 3,
    migration_priority INTEGER DEFAULT 3,
    consultant_notes TEXT,
    recommended_action TEXT,
    estimated_effort_days INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(engagement_id, application_id)
  );
`);

seedDatabase(db);

export default db;
