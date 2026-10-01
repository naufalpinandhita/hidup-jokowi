const fs = require("fs");

const express = require("express");
const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "evaluasi.db");

const POS_LIST = [
  "Mars",
  "Arti Lambang",
  "Janji",
  "Kode Etik",
  "Nadar",
  "Mountaineering",
  "PAB",
  "PPGD",
  "SAR",
  "Survival",
  "Kosidan",
  "Makorsasi",
];

const PARTICIPANTS_FILE = path.join(__dirname, "participants.json");

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY,
    pos TEXT NOT NULL,
    participant TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
    notes TEXT DEFAULT '',
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_eval_participant ON evaluations(participant);
  CREATE INDEX IF NOT EXISTS idx_eval_pos ON evaluations(pos);
  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function loadParticipantNamesFromFile() {
  try {
    const raw = fs.readFileSync(PARTICIPANTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((name) => String(name || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function seedParticipants() {
  const names = loadParticipantNamesFromFile();
  if (names.length === 0) return 0;

  const insert = db.prepare("INSERT OR IGNORE INTO participants (name) VALUES (?)");
  let inserted = 0;
  db.exec("BEGIN");
  for (const name of names) {
    const result = insert.run(name);
    inserted += Number(result.changes || 0);
  }
  db.exec("COMMIT");
  return inserted;
}

const seededCount = seedParticipants();

function getParticipants() {
  return db
    .prepare("SELECT id, name FROM participants ORDER BY name ASC")
    .all()
    .map((row) => row.name);
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function normalizeParticipant(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function buildRecap(rows, participantNames = []) {
  const byParticipant = new Map();

  const ensureEntry = (name) => {
    const key = normalizeParticipant(name);
    if (!key) return null;
    if (!byParticipant.has(key)) {
      byParticipant.set(key, {
        participant: key,
        scores: {},
        notes: [],
        evaluationCount: 0,
      });
    }
    return byParticipant.get(key);
  };

  for (const name of participantNames) {
    ensureEntry(name);
  }

  for (const row of rows) {
    const entry = ensureEntry(row.participant);
    if (!entry) continue;

    if (!entry.scores[row.pos]) {
      entry.scores[row.pos] = { sum: 0, count: 0 };
    }
    entry.scores[row.pos].sum += row.score;
    entry.scores[row.pos].count += 1;
    entry.evaluationCount += 1;

    if (row.notes && String(row.notes).trim()) {
      entry.notes.push({
        pos: row.pos,
        notes: String(row.notes).trim(),
        score: row.score,
        timestamp: row.timestamp,
      });
    }
  }

  const materialAgg = {};
  for (const pos of POS_LIST) {
    materialAgg[pos] = { sum: 0, count: 0, scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  const recap = [];
  for (const entry of byParticipant.values()) {
    const perPos = {};
    let total = 0;
    let posCount = 0;

    for (const pos of POS_LIST) {
      const agg = entry.scores[pos];
      if (!agg || agg.count === 0) {
        perPos[pos] = null;
        continue;
      }
      const avg = Math.round((agg.sum / agg.count) * 100) / 100;
      perPos[pos] = avg;
      total += avg;
      posCount += 1;

      materialAgg[pos].sum += agg.sum;
      materialAgg[pos].count += agg.count;
      const roundedScore = Math.round(avg);
      if (materialAgg[pos].scores[roundedScore] !== undefined) {
        materialAgg[pos].scores[roundedScore] += 1;
      }
    }

    const overall = posCount > 0 ? Math.round((total / posCount) * 100) / 100 : null;

    let status = "Belum dinilai";
    if (posCount === POS_LIST.length) status = "Lengkap";
    else if (posCount > 0) status = "Belum lengkap";

    recap.push({
      participant: entry.participant,
      scores: perPos,
      overall,
      notes: entry.notes,
      evaluatedMaterials: posCount,
      totalMaterials: POS_LIST.length,
      evaluationCount: entry.evaluationCount,
      status,
    });
  }

  recap.sort((a, b) => {
    if (a.overall === null && b.overall === null) {
      return a.participant.localeCompare(b.participant);
    }
    if (a.overall === null) return 1;
    if (b.overall === null) return -1;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.participant.localeCompare(b.participant);
  });

  recap.forEach((row, index) => {
    row.rank = row.overall === null ? null : index + 1;
  });

  const materialStats = POS_LIST.map((pos) => {
    const agg = materialAgg[pos];
    const average = agg.count > 0 ? Math.round((agg.sum / agg.count) * 100) / 100 : null;
    return {
      material: pos,
      average,
      evaluated: agg.count,
      notEvaluated: recap.length - agg.count,
      distribution: agg.scores,
    };
  });

  const evaluatedRows = recap.filter((row) => row.overall !== null);
  const overallAverage =
    evaluatedRows.length > 0
      ? Math.round(
          (evaluatedRows.reduce((sum, row) => sum + row.overall, 0) / evaluatedRows.length) * 100
        ) / 100
      : null;

  const completeCount = recap.filter((row) => row.status === "Lengkap").length;
  const partialCount = recap.filter((row) => row.status === "Belum lengkap").length;
  const notEvaluatedCount = recap.filter((row) => row.status === "Belum dinilai").length;

  const stats = {
    totalParticipants: recap.length,
    totalEvaluations: rows.length,
    evaluatedParticipants: evaluatedRows.length,
    completeCount,
    partialCount,
    notEvaluatedCount,
    overallAverage,
    materialStats,
  };

  return { recap, stats };
}

function toCsv(recap) {
  const headers = [
    "Peringkat",
    "Peserta",
    "Status",
    "Materi Dinilai",
    ...POS_LIST,
    "Rata-rata",
    "Catatan",
  ];

  const escape = (val) => {
    const s = val === null || val === undefined ? "" : String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of recap) {
    const notes = (row.notes || [])
      .map((n) => `[${n.pos}] ${n.notes}`)
      .join(" | ");
    lines.push(
      [
        row.rank === null ? "" : row.rank,
        row.participant,
        row.status,
        `${row.evaluatedMaterials}/${row.totalMaterials}`,
        ...POS_LIST.map((pos) => (row.scores[pos] === null || row.scores[pos] === undefined ? "" : row.scores[pos])),
        row.overall === null ? "" : row.overall,
        notes,
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

app.post("/api/submit-evaluations", (req, res) => {
  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    return res.status(400).json({ status: "error", message: "Payload harus berupa array data evaluasi." });
  }

  const insert = db.prepare(`
    INSERT INTO evaluations (id, pos, participant, score, notes, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  try {
    db.exec("BEGIN");
    for (const item of body) {
      const id = Number(item.id);
      const pos = String(item.pos || "").trim();
      const participant = normalizeParticipant(item.participant);
      const score = Number(item.score);
      const notes = item.notes === null || item.notes === undefined ? "" : String(item.notes).trim();
      const timestamp = String(item.timestamp || new Date().toISOString());

      if (!Number.isFinite(id) || !pos || !participant || !Number.isFinite(score) || score < 1 || score > 5) {
        throw new Error("Data tidak valid. Pastikan id, pos, participant, dan score (1-5) terisi.");
      }

      insert.run(id, pos, participant, score, notes, timestamp);
      count += 1;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    return res.status(400).json({ status: "error", message: err.message || "Gagal menyimpan data." });
  }

  return res.status(201).json({ status: "success", count });
});

app.get("/api/recap", (req, res) => {
  const format = String(req.query.format || "json").toLowerCase();
  const rows = db
    .prepare(
      `SELECT id, pos, participant, score, notes, timestamp
       FROM evaluations
       ORDER BY participant ASC, timestamp ASC, id ASC`
    )
    .all();

  const participantNames = getParticipants();
  const { recap, stats } = buildRecap(rows, participantNames);

  if (format === "csv") {
    const csv = toCsv(recap);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="rekap-penilaian-${stamp}.csv"`);
    return res.send(csv);
  }

  return res.json({
    status: "success",
    generatedAt: new Date().toISOString(),
    positions: POS_LIST,
    stats,
    total: recap.length,
    data: recap,
  });
});

app.get("/api/evaluations", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, pos, participant, score, notes, timestamp
       FROM evaluations
       ORDER BY timestamp DESC, id DESC`
    )
    .all();
  return res.json({ status: "success", count: rows.length, data: rows });
});

app.get("/api/health", (_req, res) => {
  const count = db.prepare("SELECT COUNT(*) AS c FROM evaluations").get().c;
  const participants = db.prepare("SELECT COUNT(*) AS c FROM participants").get().c;
  return res.json({ status: "ok", total: count, participants });
});

app.get("/api/participants", (_req, res) => {
  const names = getParticipants();
  return res.json({ status: "success", count: names.length, data: names });
});

app.listen(PORT, "0.0.0.0", () => {
  const ip = getLanIP();
  console.log("========================================");
  console.log(" Penilaian Tes Divisi - Server Aktif");
  console.log("----------------------------------------");
  console.log(` Penguji    : http://${ip}:${PORT}/`);
  console.log(` Dashboard  : http://${ip}:${PORT}/dashboard`);
  console.log(` API Health : http://${ip}:${PORT}/api/health`);
  console.log(` Database   : ${DB_PATH}`);
  console.log(` Peserta    : ${getParticipants().length} nama (seed +${seededCount})`);
  console.log("========================================");
});
