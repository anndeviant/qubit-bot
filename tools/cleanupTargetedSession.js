#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {
    sessionDir: "session",
    apply: false,
    includeGroupMemory: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--group" && next) {
      args.group = next;
      i += 1;
      continue;
    }

    if (token === "--participant" && next) {
      args.participant = next;
      i += 1;
      continue;
    }

    if (token === "--sessionDir" && next) {
      args.sessionDir = next;
      i += 1;
      continue;
    }

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--includeGroupMemory") {
      args.includeGroupMemory = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown arg: ${token}`);
  }

  return args;
}

function getParticipantNumericId(participantRaw) {
  const base = String(participantRaw || "").trim();
  if (!base) return "";

  // Accept values like 210745723723960, 210745723723960@lid, 210745723723960@s.whatsapp.net.
  const firstPart = base.split("@")[0];
  const onlyDigits = (firstPart.match(/\d+/g) || []).join("");
  return onlyDigits;
}

function listFiles(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((name) => fs.statSync(path.join(dirPath, name)).isFile());
}

function collectTargets(fileNames, group, participantId, includeGroupMemory) {
  const targets = [];

  for (const name of fileNames) {
    const isSessionFile =
      name.startsWith(`session-${participantId}.`) && name.endsWith(".json");
    const isSenderKeyFile =
      name.startsWith(`sender-key-${group}--${participantId}--`) &&
      name.endsWith(".json");
    const isGroupMemoryFile =
      includeGroupMemory && name === `sender-key-memory-${group}.json`;

    if (isSessionFile || isSenderKeyFile || isGroupMemoryFile) {
      targets.push(name);
    }
  }

  return targets;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function backupAndDelete(sessionPath, filesToDelete) {
  const backupRoot = path.join(
    sessionPath,
    "_backup-targeted",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );

  ensureDir(backupRoot);

  for (const file of filesToDelete) {
    const source = path.join(sessionPath, file);
    const backup = path.join(backupRoot, file);
    fs.copyFileSync(source, backup);
  }

  for (const file of filesToDelete) {
    const source = path.join(sessionPath, file);
    fs.unlinkSync(source);
  }

  return backupRoot;
}

function printHelp() {
  console.log("Targeted session cleanup for Baileys multi-file auth state");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node tools/cleanupTargetedSession.js --group <groupJid> --participant <participantIdOrJid> [--sessionDir session] [--includeGroupMemory] [--apply]",
  );
  console.log("");
  console.log("Examples:");
  console.log(
    "  node tools/cleanupTargetedSession.js --group 6287773091264-1598407185@g.us --participant 210745723723960@lid",
  );
  console.log(
    "  node tools/cleanupTargetedSession.js --group 6287773091264-1598407185@g.us --participant 210745723723960@lid --apply",
  );
  console.log(
    "  node tools/cleanupTargetedSession.js --group 6287773091264-1598407185@g.us --participant 210745723723960 --includeGroupMemory --apply",
  );
  console.log("");
  console.log("Notes:");
  console.log("  - Dry run is default. Add --apply to actually delete files.");
  console.log(
    "  - Deleted files are backed up under session/_backup-targeted/<timestamp>/.",
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.group || !args.participant) {
    throw new Error(
      "Both --group and --participant are required. Use --help for usage.",
    );
  }

  const participantId = getParticipantNumericId(args.participant);
  if (!participantId) {
    throw new Error(`Cannot parse participant id from: ${args.participant}`);
  }

  const sessionPath = path.resolve(process.cwd(), args.sessionDir);
  if (!fs.existsSync(sessionPath) || !fs.statSync(sessionPath).isDirectory()) {
    throw new Error(`Session directory not found: ${sessionPath}`);
  }

  const files = listFiles(sessionPath);
  const targets = collectTargets(
    files,
    args.group,
    participantId,
    args.includeGroupMemory,
  );

  console.log(`Session dir    : ${sessionPath}`);
  console.log(`Group          : ${args.group}`);
  console.log(`Participant    : ${args.participant}`);
  console.log(`Numeric id     : ${participantId}`);
  console.log(`Mode           : ${args.apply ? "APPLY" : "DRY RUN"}`);
  console.log(
    `Group memory   : ${args.includeGroupMemory ? "included" : "excluded"}`,
  );
  console.log("");

  if (targets.length === 0) {
    console.log("No matching files found. Nothing to clean.");
    return;
  }

  console.log("Matched files:");
  for (const file of targets) {
    console.log(`  - ${file}`);
  }

  if (!args.apply) {
    console.log("");
    console.log("Dry run complete. Re-run with --apply to execute cleanup.");
    return;
  }

  const backupPath = backupAndDelete(sessionPath, targets);
  console.log("");
  console.log(`Deleted ${targets.length} file(s).`);
  console.log(`Backup folder: ${backupPath}`);
}

try {
  main();
} catch (error) {
  console.error("Cleanup failed:", error.message);
  process.exitCode = 1;
}
